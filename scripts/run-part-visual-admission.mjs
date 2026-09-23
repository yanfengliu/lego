import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import { PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS } from "./part-visual-admission-targets.mjs";

const ALL_PARTS = PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
  return null;
}

function parseArguments(arguments_) {
  const parsed = { parts: [] };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!["--official", "--unofficial", "--output", "--parts"].includes(argument)) {
      return fail(
        `Unknown visual-admission argument ${JSON.stringify(argument)}. Expected --official <zip> --unofficial <zip> --output <ignored-root> [--parts <id,...>].`,
      );
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return fail(`Visual-admission argument ${argument} requires a value.`);
    }
    index += 1;
    if (argument === "--parts") parsed.parts.push(...value.split(","));
    else parsed[argument.slice(2)] = value;
  }
  for (const required of ["official", "unofficial", "output"]) {
    if (typeof parsed[required] !== "string" || parsed[required].length === 0) {
      return fail(`Visual admission requires --${required} with a non-empty value.`);
    }
  }
  return parsed;
}

function exactArchive(path, label) {
  const absolute = resolve(path);
  let info;
  try {
    info = lstatSync(absolute);
  } catch (error) {
    return fail(`${label} archive is missing or unreadable at ${absolute}: ${String(error)}.`);
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    return fail(`${label} archive must be an ordinary file, not a link or directory: ${absolute}.`);
  }
  return realpathSync.native(absolute);
}

const parsed = parseArguments(process.argv.slice(2));
if (parsed === null) process.exit();
const official = exactArchive(parsed.official, "Official");
const unofficial = exactArchive(parsed.unofficial, "Unofficial");
if (official === null || unofficial === null) process.exit();
const repository = realpathSync.native(process.cwd());
const output = resolve(parsed.output);
const relativeOutput = relative(repository, output).replaceAll("\\", "/");
if (!/^(?:output|test-results)\/[A-Za-z0-9._@/-]+$/u.test(relativeOutput)) {
  fail(
    `Visual-admission output must be a strict descendant of ignored output/ or test-results/: ${output}.`,
  );
  process.exit();
}
const parts = parsed.parts.length === 0 ? ALL_PARTS : parsed.parts;
if (
  parts.some((part) => !ALL_PARTS.includes(part)) ||
  new Set(parts).size !== parts.length ||
  parts.some((part) => part.length === 0)
) {
  fail(
    `Visual-admission --parts must be unique admitted ids from ${JSON.stringify(ALL_PARTS)}; received ${JSON.stringify(parts)}.`,
  );
  process.exit();
}

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "apps/web/e2e/part-visual-admission.spec.ts",
    "--grep",
    "opt-in real archive",
  ],
  {
    cwd: repository,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      LEGO_PART_VISUAL_ADMISSION_REQUIRED: "1",
      LEGO_PART_VISUAL_ADMISSION_OFFICIAL_ARCHIVE: official,
      LEGO_PART_VISUAL_ADMISSION_UNOFFICIAL_ARCHIVE: unofficial,
      LEGO_PART_VISUAL_ADMISSION_OUTPUT_ROOT: output,
      LEGO_PART_VISUAL_ADMISSION_PART_IDS: JSON.stringify(parts),
    },
  },
);
if (result.error !== undefined) {
  fail(`Visual-admission Playwright process could not start: ${result.error.message}.`);
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
