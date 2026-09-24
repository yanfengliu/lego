#!/usr/bin/env node
/**
 * Writes or checks packages/catalog/src/ldraw-interchange-frames.generated.ts:
 * the LDraw-to-catalog frame of every parametric catalog part, measured from
 * the byte-pinned official LDraw archive by ldraw-catalog-frame-derivation.mjs.
 *
 *   node scripts/derive-ldraw-catalog-frames.mjs --official <ldraw-complete-2026-07.zip> --write
 *   LEGO_RUN_EVIDENCE=1 node scripts/derive-ldraw-catalog-frames.mjs --official <ldraw-complete-2026-07.zip> --check
 *
 * `--check` needs the pinned archive, which a clean clone lacks, so like the
 * other run-evidence checks it runs only under LEGO_RUN_EVIDENCE=1 and
 * otherwise says it did not run.
 *
 * `--official` defaults to LEGO_LDRAW_OFFICIAL_ARCHIVE, then
 * C:/tmp/ldraw-complete-2026-07.zip. The archive is read locally and never
 * committed; only the per-part orientation id, three integers and the root
 * file's identity and attribution reach the generated file. Mesh-backed parts
 * are left out: their `assetToCatalogFrame` already is this frame.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  deriveLdrawCatalogFrame,
  expandLdrawPartForFrame,
} from "./ldraw-catalog-frame-derivation.mjs";
import { openExactLdrawArchive } from "./part-identification-prefix50-ldraw-catalog-frames-archive.mjs";

export const LDRAW_FRAME_ARCHIVE_PIN = Object.freeze({
  logicalName: "ldraw-complete-2026-07.zip",
  bytes: 144_722_356,
  sha256: "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
});
export const DEFAULT_OFFICIAL_ARCHIVE = "C:/tmp/ldraw-complete-2026-07.zip";

/** Where the pinned archive is read from without --official: LEGO_LDRAW_OFFICIAL_ARCHIVE, else the default. */
export function officialArchivePath(env = process.env) {
  return env.LEGO_LDRAW_OFFICIAL_ARCHIVE ?? DEFAULT_OFFICIAL_ARCHIVE;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const GENERATED_PATH = resolve(
  ROOT,
  "packages/catalog/src/ldraw-interchange-frames.generated.ts",
);
const MESH_GENERATOR = "builtin:preloaded-mesh-reference/1";

function parseArguments(argv) {
  const options = {
    official: officialArchivePath(),
    mode: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--official" && index + 1 < argv.length) options.official = argv[++index];
    else if (argument === "--write" || argument === "--check") options.mode = argument.slice(2);
    else {
      throw new Error(
        `derive-ldraw-catalog-frames: unknown argument ${JSON.stringify(argument)}; use --official <zip> with --write or --check.`,
      );
    }
  }
  if (options.mode === null) {
    throw new Error(
      "derive-ldraw-catalog-frames: say --write (regenerate) or --check (compare with the committed file).",
    );
  }
  return options;
}

/**
 * Whether `LEGO_RUN_EVIDENCE` opts in, read the way scripts/run-evidence-gate.mjs
 * reads it for tests (that module imports vitest): unset, "" or "0" is off, "1"
 * is on, and anything else is refused by name.
 */
export function runEvidenceOptedIn(value) {
  if (value === undefined || value === "" || value === "0") return false;
  if (value === "1") return true;
  throw new Error(
    `LEGO_RUN_EVIDENCE is ${JSON.stringify(value)}; set it to 1 to run --check against the pinned archive, or leave it unset (or 0) to skip it.`,
  );
}

/** The pinned archive's bytes, refused unless they are exactly the pinned archive. */
export function readPinnedArchive(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    throw new Error(
      `Cannot read the official LDraw archive at ${path} (${error.code ?? error.message}); pass --official <${LDRAW_FRAME_ARCHIVE_PIN.logicalName}> or set LEGO_LDRAW_OFFICIAL_ARCHIVE.`,
      { cause: error },
    );
  }
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (bytes.length !== LDRAW_FRAME_ARCHIVE_PIN.bytes || digest !== LDRAW_FRAME_ARCHIVE_PIN.sha256) {
    throw new Error(
      `${path} is ${bytes.length} bytes at ${digest}, not the pinned ${LDRAW_FRAME_ARCHIVE_PIN.logicalName} (${LDRAW_FRAME_ARCHIVE_PIN.bytes} bytes at ${LDRAW_FRAME_ARCHIVE_PIN.sha256}); frames are derived only from the pinned archive.`,
    );
  }
  return bytes;
}

async function loadCatalog() {
  const { registerBookletHooks } = await import(
    pathToFileURL(resolve(ROOT, "tools/booklet/node-hooks.mjs")).href
  );
  registerBookletHooks();
  return import(pathToFileURL(resolve(ROOT, "packages/catalog/src/index.ts")).href);
}

/** One derived row per parametric catalog part, sorted by LDraw id. */
export function deriveRows(catalog, archive) {
  const rows = [];
  const failures = [];
  for (const definition of catalog.PART_DEFINITIONS) {
    if (definition.geometry.generatorId === MESH_GENERATOR) continue;
    const ldrawId = definition.aliases.find(({ namespace }) => namespace === "ldraw")?.value;
    if (ldrawId === undefined) {
      failures.push(
        `${definition.id}: has no "ldraw" alias, so no official LDraw file names it and no frame can be measured; add its LDraw id as an alias ({ namespace: "ldraw", value: "<id>.dat" })`,
      );
      continue;
    }
    try {
      const expanded = expandLdrawPartForFrame(archive, ldrawId);
      const frame = deriveLdrawCatalogFrame(definition, expanded, catalog.PROPER_ORIENTATIONS);
      // A redirect stub draws nothing: attribution goes to the part it moved to.
      const attributed = expanded.resolvedRoot?.header ?? expanded.header;
      rows.push({
        ldrawId,
        orientationId: frame.orientationId,
        translationLdu: frame.translationLdu,
        basis: frame.basis,
        candidates: frame.candidates,
        rootSha256: expanded.root.sha256,
        rootBytes: expanded.root.bytes,
        closureFileCount: expanded.closureFileCount,
        ...(expanded.resolvedRoot === undefined
          ? {}
          : {
              resolvedRoot: {
                ldrawId: expanded.resolvedRoot.path.split("/").pop(),
                sha256: expanded.resolvedRoot.sha256,
                bytes: expanded.resolvedRoot.bytes,
              },
            }),
        title: attributed.title,
        author: attributed.author,
        ldrawOrg: attributed.ldrawOrg,
        licenseExpression: attributed.licenseExpression,
        ...(frame.why === undefined ? {} : { why: frame.why }),
      });
    } catch (error) {
      failures.push(`${definition.id} (${ldrawId}): ${error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `No frame for ${failures.length} parametric part(s):\n- ${failures.join("\n- ")}`,
    );
  }
  return rows.sort((left, right) =>
    left.ldrawId < right.ldrawId ? -1 : left.ldrawId > right.ldrawId ? 1 : 0,
  );
}

export function renderGenerated(rows) {
  const lines = rows.map(
    (row) =>
      `  // prettier-ignore\n  { ldrawId: ${JSON.stringify(row.ldrawId)}, orientationId: ${JSON.stringify(row.orientationId)}, translationLdu: [${row.translationLdu.join(", ")}], basis: ${JSON.stringify(row.basis)}, candidates: ${row.candidates}, rootSha256: ${JSON.stringify(row.rootSha256)}, rootBytes: ${row.rootBytes}, closureFileCount: ${row.closureFileCount}, ${row.resolvedRoot === undefined ? "" : `resolvedRoot: { ldrawId: ${JSON.stringify(row.resolvedRoot.ldrawId)}, sha256: ${JSON.stringify(row.resolvedRoot.sha256)}, bytes: ${row.resolvedRoot.bytes} }, `}title: ${JSON.stringify(row.title)}, author: ${JSON.stringify(row.author)}, ldrawOrg: ${JSON.stringify(row.ldrawOrg)}, licenseExpression: ${JSON.stringify(row.licenseExpression)}${row.why === undefined ? "" : `, why: ${JSON.stringify(row.why)}`} },`,
  );
  return `// Generated by scripts/derive-ldraw-catalog-frames.mjs from the byte-pinned official
// LDraw archive ${LDRAW_FRAME_ARCHIVE_PIN.logicalName} (${LDRAW_FRAME_ARCHIVE_PIN.bytes} bytes,
// ${LDRAW_FRAME_ARCHIVE_PIN.sha256}). Do not hand-edit. Reproduce with:
//
//   node scripts/derive-ldraw-catalog-frames.mjs --official <${LDRAW_FRAME_ARCHIVE_PIN.logicalName}> --write
//
// and check with --check. Each row is measurement only: the orientation and
// whole-LDU offset that put the file's extent and studs on the catalog part
// (catalog = O * ldraw + t), plus the root file's identity and attribution. A
// redirect stub's row also names the part it moved to, whose header it attributes,
// and a reviewed choice's row carries its why.

import type { LdrawInterchangeFrameRow } from "./ldraw-interchange-frames.ts";

export const LDRAW_INTERCHANGE_FRAME_ARCHIVE = {
  logicalName: ${JSON.stringify(LDRAW_FRAME_ARCHIVE_PIN.logicalName)},
  bytes: ${LDRAW_FRAME_ARCHIVE_PIN.bytes},
  sha256: ${JSON.stringify(LDRAW_FRAME_ARCHIVE_PIN.sha256)},
} as const;

/** One row per parametric catalog part, by LDraw id. */
export const LDRAW_INTERCHANGE_FRAME_ROWS: readonly LdrawInterchangeFrameRow[] = Object.freeze([
${lines.join("\n")}
]);
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "check" && !runEvidenceOptedIn(process.env.LEGO_RUN_EVIDENCE)) {
    process.stdout.write(
      `derive-ldraw-catalog-frames --check did not run: it reads the pinned official LDraw archive (${LDRAW_FRAME_ARCHIVE_PIN.logicalName}), which a clean clone lacks. Set LEGO_RUN_EVIDENCE=1 to run it.
`,
    );
    return;
  }
  const archive = openExactLdrawArchive(readPinnedArchive(options.official));
  const catalog = await loadCatalog();
  const text = renderGenerated(deriveRows(catalog, archive));
  if (options.mode === "write") {
    writeFileSync(GENERATED_PATH, text, "utf8");
    process.stdout.write(`wrote ${GENERATED_PATH}\n`);
    return;
  }
  let committed = "";
  try {
    committed = readFileSync(GENERATED_PATH, "utf8").replaceAll("\r\n", "\n");
  } catch {
    // An absent file is drift like any other.
  }
  if (committed !== text) {
    throw new Error(
      `${GENERATED_PATH} does not match the frames the pinned archive gives; rerun with --write and review the diff.`,
    );
  }
  process.stdout.write(`frames match: ${GENERATED_PATH}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
