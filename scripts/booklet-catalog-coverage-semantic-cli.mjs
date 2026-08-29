import { pathToFileURL } from "node:url";

import {
  bytesFromVerifiedSemanticBookletCatalogCoverage,
  compileSemanticBookletCatalogCoverage,
  encodeSemanticBookletCatalogCoverage,
  inspectVerifiedSemanticBookletCatalogCoverage,
  isVerifiedSemanticBookletCatalogCoverage,
  verifyOpaqueSemanticBookletCatalogCoverage,
} from "./booklet-catalog-coverage-semantic.mjs";
import { publishContainedArtifactWithoutOverwrite } from "./part-identification-counterevidence-archive.mjs";
import { verifyCurrentPrefix50SemanticClosure } from "./part-identification-prefix50-semantic-closure-current.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = "catalog-coverage.json";
const MAXIMUM_COVERAGE_BYTES = 2 * 1024 * 1024;

export function semanticBookletCatalogCoverageUsage() {
  return [
    "Usage: node scripts/booklet-catalog-coverage-semantic-cli.mjs",
    "",
    "Replays exactly the first 50 printed steps and the current catalog without a model or browser,",
    "retains all 359 printed-step source/index commitments, and never overwrites differing current evidence.",
  ].join("\n");
}

function publishVerifiedCoverage(verified) {
  if (!isVerifiedSemanticBookletCatalogCoverage(verified)) {
    throw new TypeError(
      "Semantic catalog coverage publication requires its opaque in-memory verifier result.",
    );
  }
  return publishContainedArtifactWithoutOverwrite({
    archiveNameStem: "catalog-coverage",
    currentFile: OUTPUT_FILE,
    label: "Semantic catalog coverage",
    maxBytes: MAXIMUM_COVERAGE_BYTES,
    nextBytes: bytesFromVerifiedSemanticBookletCatalogCoverage(verified),
    outputRoot: OUTPUT_ROOT,
  });
}

export async function runSemanticBookletCatalogCoverageCli(
  argv = process.argv.slice(2),
  context = {},
) {
  const stdout = context.stdout ?? console.log;
  if (argv.length !== 0) {
    throw new TypeError("Semantic catalog coverage generation accepts no caller arguments.");
  }
  const semantic = await verifyCurrentPrefix50SemanticClosure();
  const input = {
    elementResolutionBytes: semantic.elementResolutionBytes,
    lastStep: 50,
    manifestBytes: semantic.manifestBytes,
    semanticClosure: semantic.verified,
  };
  const report = await compileSemanticBookletCatalogCoverage(input);
  const bytes = encodeSemanticBookletCatalogCoverage(report);
  const verified = await verifyOpaqueSemanticBookletCatalogCoverage({
    ...input,
    coverageBytes: bytes,
  });
  if (!isVerifiedSemanticBookletCatalogCoverage(verified)) {
    throw new TypeError(
      "Semantic catalog coverage verifier did not return its opaque authority object; retained evidence was not touched.",
    );
  }
  const verifiedBytes = bytesFromVerifiedSemanticBookletCatalogCoverage(verified);
  if (!verifiedBytes.equals(bytes)) {
    throw new TypeError(
      "Semantic catalog coverage verifier bytes differ from the fresh reproduction; retained evidence was not touched.",
    );
  }
  const inspection = inspectVerifiedSemanticBookletCatalogCoverage(verified);
  const publication = publishVerifiedCoverage(verified);
  if (publication.state === "review-required") {
    throw new TypeError(
      `Semantic catalog coverage retained differing current evidence at ${publication.currentPath}; verified replacement candidate is ${publication.candidate.path} at ${publication.digest}. Review and move the retained current file explicitly before rerunning; automation never overwrites an existing differing pathname.`,
    );
  }
  stdout(
    [
      `${publication.state === "published-current" ? "wrote" : "verified"} coverage ${verifiedBytes.length} bytes at ${inspection.digest}`,
      `steps covered ${inspection.artifact.coverage.stepsCovered}/${inspection.artifact.coverage.stepsTotal}`,
      `covered prefix ${inspection.artifact.coverage.coveredPrefixLength}`,
      `pieces placeable ${inspection.artifact.coverage.piecesPlaceable}/${inspection.artifact.coverage.piecesTotal}`,
      `semantic callouts ${inspection.artifact.calloutsConsidered}`,
      `unidentified ${inspection.artifact.calloutsUnidentified}`,
    ].join(" | "),
  );
  return report;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runSemanticBookletCatalogCoverageCli();
