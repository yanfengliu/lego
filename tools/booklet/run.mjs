import { registerBookletHooks } from "./node-hooks.mjs";

/**
 * Entry point of `npm run booklet`. Registers the resolution hooks Node's type
 * stripping needs for this repository's TypeScript, then runs the harness.
 * Flags: --write-baseline rewrites the set's baseline (headline counts only);
 * --set <id> runs a set of tools/player/sets.ts other than its first.
 */
const argv = process.argv.slice(2);
let set;
const unknown = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--write-baseline") continue;
  if (argv[index] === "--set" && index + 1 < argv.length) set = argv[++index];
  else unknown.push(argv[index]);
}
if (unknown.length > 0) {
  process.stderr.write(
    `npm run booklet: unknown argument(s) ${unknown.join(" ")}; the flags are --write-baseline and --set <id>.\n`,
  );
  process.exit(2);
}
registerBookletHooks();
const { runBooklet } = await import(new URL("./main.ts", import.meta.url).href);
try {
  process.exitCode = await runBooklet({
    writeBaseline: argv.includes("--write-baseline"),
    ...(set === undefined ? {} : { set }),
  });
} catch (error) {
  process.stderr.write(
    `npm run booklet failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
