import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MEASURED_FARTHER_ORIGIN_EXACT_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS,
} from "../apps/web/e2e/real-build-farther-origin-source-manifest.ts";
import { inspectAppPackageSourceBytes } from "./check-bom-source-policy.mjs";
import { checkedSourcePopulation } from "./check-bom-source-population.mjs";

const normalizePath = (value) => value.replaceAll("\\", "/");

const reviewedSourceExtensions = [
  ".cs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ps1",
  ".py",
  ".ts",
  ".tsx",
  ".txt",
];

const outOfCensusBytePreservingControls = [
  "THIRD_PARTY_NOTICES.md",
  "docs/bundled-geometry-notices.md",
];

const bytePreservingSourcePath = (path) =>
  [
    "apps/web/src/assembly/enumerate-placements.test.ts",
    "apps/web/src/manual-commands.test.ts",
    "apps/web/src/viewport/placement-ghost.ts",
    "packages/brick-kernel/src/build-sequence.ts",
    "scripts/proper_orientations_generated.py",
    ...outOfCensusBytePreservingControls,
  ].includes(path) ||
  path.startsWith("apps/web/test/fixtures/") ||
  path.startsWith("scripts/fixtures/") ||
  path.startsWith("packages/catalog/src/quarantine/") ||
  /(?:^|\/)[^/]*\.generated\.[^/]+$/u.test(path);

function checkAttributes(repositoryRoot, paths) {
  const output = execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${normalizePath(repositoryRoot)}`,
      "check-attr",
      "-z",
      "text",
      "eol",
      "--stdin",
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      input: `${paths.join("\0")}\0`,
      maxBuffer: 16 * 1_024 * 1_024,
    },
  );
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length !== paths.length * 6) {
    throw new Error(
      `git check-attr returned ${fields.length} fields for ${paths.length} paths; expected ${paths.length * 6}`,
    );
  }
  const attributes = new Map();
  for (let index = 0; index < fields.length; index += 3) {
    const path = normalizePath(fields[index]);
    const name = fields[index + 1];
    const value = fields[index + 2];
    const row = attributes.get(path) ?? {};
    row[name] = value;
    attributes.set(path, row);
  }
  return attributes;
}

describe("fresh-checkout source attributes", () => {
  it("keeps every attested or BOM-reviewed source extension LF without weakening exact-byte exceptions", () => {
    const repositoryRoot = process.cwd();
    const sourcePaths = [
      ...checkedSourcePopulation(repositoryRoot),
      ...MEASURED_FARTHER_ORIGIN_EXACT_SOURCE_PATHS,
      ...MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS,
      ...MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS,
      ...outOfCensusBytePreservingControls,
    ]
      .map(normalizePath)
      .filter((path) => inspectAppPackageSourceBytes(path, Buffer.alloc(0)).length === 0);
    const applicablePaths = [...new Set(sourcePaths)].sort();
    const observedExtensions = [...new Set(applicablePaths.map((path) => extname(path)))].sort();
    expect(
      observedExtensions.every((extension) => reviewedSourceExtensions.includes(extension)),
    ).toBe(true);
    expect(
      reviewedSourceExtensions.every(
        (extension) =>
          inspectAppPackageSourceBytes(`scripts/probe${extension}`, Buffer.alloc(0)).length === 0,
      ),
    ).toBe(true);
    const extensionProbes = reviewedSourceExtensions.map(
      (extension) => `scripts/__source_checkout_attribute_probe__/source${extension}`,
    );
    const attributes = checkAttributes(repositoryRoot, [...applicablePaths, ...extensionProbes]);

    for (const probe of extensionProbes) {
      expect(attributes.get(probe), probe).toEqual({ text: "set", eol: "lf" });
    }
    for (const path of applicablePaths) {
      expect(attributes.get(path), path).toEqual({
        text: bytePreservingSourcePath(path) ? "unset" : "set",
        eol: "lf",
      });
      if (!bytePreservingSourcePath(path)) {
        expect(
          readFileSync(path).includes(Buffer.from("\r\n")),
          `${path} contains CRLF worktree bytes even though its clean-checkout contract is LF; normalize the existing worktree before deriving byte-addressed source or BOM evidence`,
        ).toBe(false);
      }
    }
  }, 30_000);
});
