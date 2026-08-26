import { constants, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  compileSemanticBookletCatalogCoverage,
  encodeSemanticBookletCatalogCoverage,
  verifySemanticBookletCatalogCoverage,
} from "./booklet-catalog-coverage-semantic.mjs";
import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { readBoundedFile, writeContainedFile } from "./part-identification-io.mjs";
import { verifyCurrentPrefix50SemanticClosure } from "./part-identification-prefix50-semantic-closure-current.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = "catalog-coverage.json";
const MAXIMUM_COVERAGE_BYTES = 2 * 1024 * 1024;

function option(argv, name, fallback) {
  const flag = `--${name}`;
  const positions = argv.flatMap((value, index) => (value === flag ? [index] : []));
  if (positions.length > 1) {
    throw new Error(`${flag} may be supplied once; received ${positions.length} occurrences.`);
  }
  if (positions.length === 0) return fallback;
  const at = positions[0];
  if (at === argv.length - 1 || argv[at + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return argv[at + 1];
}

export function semanticBookletCatalogCoverageUsage() {
  return [
    "Usage: node scripts/booklet-catalog-coverage-semantic-cli.mjs [--last-step 1..50]",
    "",
    "Replays the exact local prefix-50 semantic identity chain and current catalog without a model or browser,",
    "retains all 359 printed-step source/index commitments, and publishes only the requested prefix.",
  ].join("\n");
}

function archiveCounterevidence(nextBytes, outputRoot = OUTPUT_ROOT) {
  const currentPath = join(outputRoot, OUTPUT_FILE);
  if (!existsSync(currentPath)) return null;
  const currentBytes = readBoundedFile(currentPath, {
    label: "Existing catalog coverage counterevidence",
    maxBytes: MAXIMUM_COVERAGE_BYTES,
  });
  if (currentBytes.equals(nextBytes)) return null;
  const digest = sha256Digest(currentBytes);
  const historyRoot = join(outputRoot, "history");
  const archiveName = `catalog-coverage-stale-${digest.slice("sha256:".length, "sha256:".length + 8)}.json`;
  const archivePath = join(historyRoot, archiveName);
  mkdirSync(historyRoot, { recursive: true });
  if (existsSync(archivePath)) {
    const archivedBytes = readBoundedFile(archivePath, {
      label: "Existing catalog coverage history artifact",
      maxBytes: MAXIMUM_COVERAGE_BYTES,
    });
    if (!archivedBytes.equals(currentBytes)) {
      throw new Error(
        `Coverage counterevidence path ${archivePath} already exists with different bytes; preserve both artifacts under distinct reviewed names before replacement.`,
      );
    }
  } else {
    copyFileSync(currentPath, archivePath, constants.COPYFILE_EXCL);
    const archivedBytes = readBoundedFile(archivePath, {
      label: "New catalog coverage history artifact",
      maxBytes: MAXIMUM_COVERAGE_BYTES,
    });
    if (!archivedBytes.equals(currentBytes)) {
      throw new Error(
        `Coverage counterevidence ${archivePath} did not reproduce after its exclusive copy; current coverage was not replaced.`,
      );
    }
  }
  return { archivePath, bytes: currentBytes.length, digest };
}

export const __testOnly = Object.freeze({ archiveCounterevidence });

export async function runSemanticBookletCatalogCoverageCli(
  argv = process.argv.slice(2),
  context = {},
) {
  if (argv.includes("--help") || argv.includes("-h")) {
    (context.stdout ?? console.log)(semanticBookletCatalogCoverageUsage());
    return 0;
  }
  const lastStepText = option(argv, "last-step", "50");
  const lastStep = Number(lastStepText);
  if (!Number.isSafeInteger(lastStep) || lastStep < 1 || lastStep > 50) {
    throw new Error(
      `--last-step must be a safe integer from 1 through 50; received ${JSON.stringify(lastStepText)}.`,
    );
  }
  const semantic = await verifyCurrentPrefix50SemanticClosure();
  const input = {
    elementResolutionBytes: semantic.elementResolutionBytes,
    lastStep,
    manifestBytes: semantic.manifestBytes,
    semanticClosure: semantic.verified,
  };
  const report = await compileSemanticBookletCatalogCoverage(input);
  const bytes = encodeSemanticBookletCatalogCoverage(report);
  await verifySemanticBookletCatalogCoverage({ ...input, coverageBytes: bytes });
  const archived = archiveCounterevidence(bytes);
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeContainedFile(OUTPUT_ROOT, OUTPUT_FILE, bytes, {
    label: "Semantic catalog coverage report",
    pathLabel: "Semantic catalog coverage report path",
    maxBytes: MAXIMUM_COVERAGE_BYTES,
  });
  if (archived !== null) {
    console.log(
      `preserved prior coverage at ${archived.archivePath}: ${archived.bytes} bytes at ${archived.digest}`,
    );
  }
  console.log(
    [
      `coverage ${bytes.length} bytes at ${sha256Digest(bytes)}`,
      `steps covered ${report.coverage.stepsCovered}/${report.coverage.stepsTotal}`,
      `covered prefix ${report.coverage.coveredPrefixLength}`,
      `pieces placeable ${report.coverage.piecesPlaceable}/${report.coverage.piecesTotal}`,
      `semantic callouts ${report.calloutsConsidered}`,
      `unidentified ${report.calloutsUnidentified}`,
    ].join(" | "),
  );
  return report;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runSemanticBookletCatalogCoverageCli();
