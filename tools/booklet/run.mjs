import { registerBookletHooks } from "./node-hooks.mjs";

/**
 * Entry point of `npm run booklet`. Registers the resolution hooks Node's type
 * stripping needs for this repository's TypeScript, then runs the harness.
 * Flags: --write-baseline rewrites status/booklet-baseline.json (headline counts only).
 */
const unknown = process.argv.slice(2).filter((argument) => argument !== "--write-baseline");
if (unknown.length > 0) {
  process.stderr.write(
    `npm run booklet: unknown argument(s) ${unknown.join(" ")}; the only flag is --write-baseline.\n`,
  );
  process.exit(2);
}
registerBookletHooks();
const { runBooklet } = await import(new URL("./main.ts", import.meta.url).href);
try {
  process.exitCode = await runBooklet({ writeBaseline: process.argv.includes("--write-baseline") });
} catch (error) {
  process.stderr.write(
    `npm run booklet failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
