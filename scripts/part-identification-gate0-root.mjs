import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = realpathSync(fileURLToPath(new URL("..", import.meta.url)));

export const PART_IDENTIFICATION_GATE0_DEFAULT_ROOT = resolve(
  REPOSITORY_ROOT,
  "var/state/part-identification-gate0",
);
