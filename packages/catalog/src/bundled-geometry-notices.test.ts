import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS } from "./index.js";
import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";

const NOTICES_PATH = resolve(import.meta.dirname, "../../../docs/bundled-geometry-notices.md");

/**
 * The attribution CC BY 4.0 requires, rendered from the catalog it describes.
 *
 * A notices file nobody regenerates is the failure mode this exists to prevent:
 * the document is derived here, so admitting or removing a bundled file moves it
 * in the same commit or turns this test red.
 */
function renderNotices(): string {
  const meshParts = PART_DEFINITIONS.filter(
    ({ geometry }) => geometry.generatorId === "builtin:preloaded-mesh-reference/1",
  );
  const fileByPath = new Map(BUNDLED_LDRAW_SOURCE_FILES.map((file) => [file.path, file]));
  const partRows = meshParts.map((part) => {
    const ldrawId = part.aliases.find(({ namespace }) => namespace === "ldraw")!.value;
    const closure = BUNDLED_LDRAW_CLOSURES[ldrawId.replace(".dat", "")]!;
    const root = fileByPath.get(`parts/${ldrawId}`)!;
    return `| \`${part.id}\` | \`${ldrawId}\` | ${root.title} | ${root.author} | ${closure.length} |`;
  });
  const fileRows = BUNDLED_LDRAW_SOURCE_FILES.map(
    (file) =>
      `| \`${file.path}\` | ${file.title} | ${file.author} | ${file.ldrawOrg} | \`${file.sha256.replace("sha256:", "")}\` |`,
  );
  return [
    "# Bundled geometry notices",
    "",
    "> Generated from the catalog by `packages/catalog/src/bundled-geometry-notices.test.ts`, which fails if this file and the catalog disagree. Do not edit by hand.",
    "",
    "The render mesh of the parts below is real LDraw geometry, bundled and redistributed under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). CC BY 4.0 requires attribution, so every file whose triangles are bundled is named here with its author, title and content hash rather than flattened into project-owned data.",
    "",
    "Permission to reuse this geometry is **not** permission to train on it. That right is not held, and no bundled file is designated as a model-training or benchmark corpus.",
    "",
    "The geometry is Layer 1 only: it is what the app draws and what the palette previews, and it is never consulted for connector, collision, bounds or validator truth.",
    "",
    `Source archive: \`${BUNDLED_LDRAW_ARCHIVE.version}\`, ${BUNDLED_LDRAW_ARCHIVE.bytes} bytes, \`${BUNDLED_LDRAW_ARCHIVE.sha256}\`, from ${BUNDLED_LDRAW_ARCHIVE.source}.`,
    "",
    "## Bundled parts",
    "",
    "| Catalog part | LDraw file | Title | Author | Closure files |",
    "| --- | --- | --- | --- | --- |",
    ...partRows,
    "",
    "## Every bundled file",
    "",
    `All ${BUNDLED_LDRAW_SOURCE_FILES.length} files below declare CC BY 4.0 in their own header.`,
    "",
    "| File | Title | Author | LDraw.org status | SHA-256 |",
    "| --- | --- | --- | --- | --- |",
    ...fileRows,
    "",
  ].join("\n");
}

describe("bundled geometry notices", () => {
  it("reproduces docs/bundled-geometry-notices.md from the catalog", () => {
    expect(readFileSync(NOTICES_PATH, "utf8")).toBe(renderNotices());
  });

  it("names every part whose geometry is bundled and no part whose geometry is not", () => {
    const notices = readFileSync(NOTICES_PATH, "utf8");

    for (const part of PART_DEFINITIONS) {
      const bundled = part.geometry.generatorId === "builtin:preloaded-mesh-reference/1";
      expect([part.id, notices.includes(`\`${part.id}\``)]).toEqual([part.id, bundled]);
    }
  });
});
