import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { registerBookletHooks } from "../booklet/node-hooks.mjs";

/**
 * `npm start`: make each set's player data current, then serve the player.
 *
 * For every set in tools/player/sets.ts it compares the data's stamp.json
 * with the inputs and generating code now (tools/player/freshness.ts); when
 * the data is missing or stale it runs `npm run booklet --set <id>`. Then it
 * starts the Vite dev server on 127.0.0.1 (port 5173, or PORT), prints its
 * URL and opens the player in the default browser (not with --no-open).
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const unknown = argv.filter((argument) => argument !== "--no-open");
if (unknown.length > 0) {
  process.stderr.write(
    `npm start: unknown argument(s) ${unknown.join(" ")}; the only flag is --no-open.\n`,
  );
  process.exit(2);
}

registerBookletHooks();
const { PLAYER_SETS, playerOutputDir, setInputPaths } = await import("./sets.ts");
const { currentPlayerStamp, stalenessOf } = await import("./freshness.ts");
const { mainCheckoutRoot } = await import("../booklet/inputs.ts");
const { officialArchivePath } = await import("../../scripts/derive-ldraw-catalog-frames.mjs");

const inputRoot = mainCheckoutRoot(ROOT);
const staleness = (set) =>
  stalenessOf(
    playerOutputDir(set, ROOT, process.env),
    currentPlayerStamp(
      set,
      {
        ...setInputPaths(set, inputRoot, process.env),
        library: officialArchivePath(process.env),
      },
      ROOT,
    ),
  );

for (const set of PLAYER_SETS) {
  const before = staleness(set);
  if (before === null) {
    process.stdout.write(`Player data for set ${set.id} is current.\n`);
    continue;
  }
  process.stdout.write(
    `Player data for set ${set.id} is not current (${before}); generating it with npm run booklet, which takes about half a minute.\n`,
  );
  spawnSync(process.execPath, [resolve(ROOT, "tools/booklet/run.mjs"), "--set", set.id], {
    cwd: ROOT,
    stdio: "inherit",
  });
  const after = staleness(set);
  if (after === null) continue;
  const directory = playerOutputDir(set, ROOT, process.env);
  if (
    !existsSync(resolve(directory, "steps.json")) ||
    !existsSync(resolve(directory, "model.mpd"))
  ) {
    process.stderr.write(
      `npm start: could not generate player data for set ${set.id} (${after}); the [player] line above says why.\n`,
    );
    process.exit(1);
  }
  process.stderr.write(
    `npm start: player data for set ${set.id} is still not current (${after}); serving the data from the last successful run. The [player] line above says why.\n`,
  );
}

const { createServer } = await import("vite");
const port = process.env.PORT === undefined ? 5173 : Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  process.stderr.write(
    `npm start: PORT is ${JSON.stringify(process.env.PORT)}; set it to a port number.\n`,
  );
  process.exit(2);
}
let server;
try {
  server = await createServer({
    configFile: resolve(ROOT, "apps/web/vite.config.ts"),
    root: resolve(ROOT, "apps/web"),
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      open: argv.includes("--no-open") ? false : "/",
    },
  });
  await server.listen();
} catch (error) {
  process.stderr.write(
    `npm start: the dev server could not start on 127.0.0.1:${port} (${error instanceof Error ? error.message : String(error)}); stop whatever holds the port or run with PORT=<another port>.\n`,
  );
  process.exit(1);
}
process.stdout.write("\nBuild player:\n");
server.printUrls();
server.bindCLIShortcuts({ print: true });
