import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const lockfilePath = resolve(root, "package-lock.json");
const noticesPath = resolve(root, "THIRD_PARTY_NOTICES.md");

function packageNameFromLockPath(lockPath) {
  const marker = "node_modules/";
  const index = lockPath.lastIndexOf(marker);
  return index < 0 ? lockPath : lockPath.slice(index + marker.length);
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function renderNotices(lockfile) {
  const dependencies = Object.entries(lockfile.packages ?? {})
    .filter(([lockPath, entry]) => lockPath.includes("node_modules/") && !entry.link)
    .map(([lockPath, entry]) => ({
      name: entry.name ?? packageNameFromLockPath(lockPath),
      version: entry.version,
      license: entry.license,
      source: entry.resolved,
    }))
    .sort((left, right) => {
      const leftKey = `${left.name}@${left.version}`;
      const rightKey = `${right.name}@${right.version}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  const incomplete = dependencies.filter(
    ({ name, version, license, source }) => !name || !version || !license || !source,
  );
  if (incomplete.length > 0) {
    throw new Error(
      `Cannot generate complete notices for: ${incomplete
        .map(({ name, version }) => `${name ?? "unknown"}@${version ?? "unknown"}`)
        .join(", ")}`,
    );
  }

  const rows = dependencies.map(
    ({ name, version, license, source }) =>
      `| ${markdownCell(name)} | ${markdownCell(version)} | ${markdownCell(license)} | ${markdownCell(source)} |`,
  );

  return `${[
    "# Third-party notices",
    "",
    "> Generated from `package-lock.json` by `scripts/generate-third-party-notices.mjs`. Do not edit by hand.",
    "",
    "This inventory records the exact installed npm dependency graph. The corresponding license texts remain in each installed package and must be preserved by any future distributable packaging step.",
    "",
    "| Package | Version | Declared license | Registry source |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n")}`;
}

const lockfile = JSON.parse(await readFile(lockfilePath, "utf8"));
const expected = renderNotices(lockfile);

if (process.argv.includes("--check")) {
  let actual;
  try {
    actual = await readFile(noticesPath, "utf8");
  } catch {
    console.error("THIRD_PARTY_NOTICES.md is missing; run the notices generator.");
    process.exitCode = 1;
  }

  if (actual !== undefined && actual !== expected) {
    console.error("THIRD_PARTY_NOTICES.md is stale; run the notices generator.");
    process.exitCode = 1;
  }
} else {
  await writeFile(noticesPath, expected, "utf8");
  console.log(`Wrote ${dependenciesCount(expected)} dependency notices.`);
}

function dependenciesCount(notices) {
  return notices.split("\n").filter((line) => line.startsWith("| ")).length - 2;
}
