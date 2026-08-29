import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "../packages/catalog/src/index.ts";
import {
  diffConnectionPairs,
  diffConnectionSemantics,
  projectConnectionSemantics,
} from "../packages/brick-kernel/src/connection-semantics-projection.ts";
import { canonicalDigest } from "../packages/brick-kernel/src/canonical.ts";
import { createBuiltinTruthSnapshot } from "../packages/brick-kernel/src/factory.ts";
import { getReviewedHistoricalCatalogRoster } from "../packages/brick-kernel/src/historical-catalog-rosters.ts";
import {
  CURRENT_CONNECTION_SEMANTICS_AUTHORITY,
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
} from "../packages/brick-kernel/src/historical-connection-semantics.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS } from "../packages/brick-kernel/src/migration.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, "output");
const printOnly = process.argv.includes("--print");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${String(result.status)}${detail === "" ? "" : `:\n${detail}`}`,
    );
  }
}

function assertContainedTemporaryRoot(path) {
  const canonicalOutput = realpathSync(outputRoot);
  const canonicalPath = realpathSync(path);
  const relation = relative(canonicalOutput, canonicalPath);
  if (relation === "" || relation.startsWith(`..${sep}`) || relation === "..") {
    throw new Error(
      `Refusing cleanup outside the ignored output root ${canonicalOutput}; resolved ${canonicalPath}.`,
    );
  }
}

async function importHistoricalCatalog(sourceCommit, temporaryRoot) {
  const extractionRoot = join(temporaryRoot, sourceCommit);
  const archivePath = join(temporaryRoot, `${sourceCommit}.tar`);
  mkdirSync(extractionRoot, { recursive: true });
  run("git", [
    "-c",
    `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
    "archive",
    "--format=tar",
    `--output=${archivePath}`,
    sourceCommit,
    "package.json",
    "packages/catalog/package.json",
    "packages/catalog/src",
  ]);
  run("tar", ["-xf", archivePath, "-C", extractionRoot]);
  const catalogUrl = pathToFileURL(join(extractionRoot, "packages/catalog/src/catalog.ts"));
  const constantsUrl = pathToFileURL(join(extractionRoot, "packages/catalog/src/constants.ts"));
  const [{ PART_DEFINITIONS: historicalParts }, constants] = await Promise.all([
    import(`${catalogUrl.href}?commit=${sourceCommit}`),
    import(`${constantsUrl.href}?commit=${sourceCommit}`),
  ]);
  if (!Array.isArray(historicalParts)) {
    throw new Error(`${sourceCommit} did not export PART_DEFINITIONS from catalog.ts.`);
  }
  return {
    parts: historicalParts,
    pairRules: Array.isArray(constants.CONNECTOR_PAIR_RULES)
      ? constants.CONNECTOR_PAIR_RULES
      : undefined,
  };
}

async function deriveAuthorities() {
  mkdirSync(outputRoot, { recursive: true });
  const temporaryRoot = mkdtempSync(join(outputRoot, "historical-connector-check-"));
  try {
    const target = projectConnectionSemantics(
      PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    const authorities = [];
    for (const snapshot of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const roster = getReviewedHistoricalCatalogRoster(snapshot.truthHash);
      if (roster === undefined) {
        throw new Error(`Reviewed truth ${snapshot.truthHash} has no exact historical roster.`);
      }
      const historical = await importHistoricalCatalog(snapshot.sourceCommit, temporaryRoot);
      const historicalPartIds = historical.parts.map(({ id }) => id);
      if (JSON.stringify(historicalPartIds) !== JSON.stringify(roster.catalogPartIds)) {
        throw new Error(
          `${snapshot.sourceCommit} catalog roster differs from the pinned roster for ${snapshot.truthHash}.`,
        );
      }
      const targetParts = PART_DEFINITIONS.filter(({ id }) => roster.catalogPartIds.includes(id));
      if (targetParts.length !== roster.catalogPartIds.length) {
        throw new Error(
          `Current catalog no longer contains every source part for ${snapshot.truthHash}.`,
        );
      }
      const sourceProjection = projectConnectionSemantics(
        historical.parts,
        historical.pairRules,
        "reviewed-historical",
      );
      const historicalSemanticConnectorKinds = [
        ...new Set(
          historical.parts.flatMap(({ connectors }) =>
            connectors.flatMap(({ kind, compatibleKinds }) => [kind, ...compatibleKinds]),
          ),
        ),
      ];
      const targetProjection = projectConnectionSemantics(
        targetParts,
        CONNECTOR_PAIR_RULES,
        "live-strict",
        { semanticConnectorKinds: historicalSemanticConnectorKinds },
      );
      authorities.push({
        truthHash: snapshot.truthHash,
        sourceCommit: snapshot.sourceCommit,
        sourceEndpointCount: sourceProjection.endpointCount,
        sourceEndpointMapDigest: sourceProjection.endpointMapDigest,
        sourcePairCount: sourceProjection.pairCount,
        sourcePairMapDigest: sourceProjection.pairMapDigest,
        endpointDeltas: diffConnectionSemantics(sourceProjection, targetProjection),
        pairDeltas: diffConnectionPairs(sourceProjection, targetProjection),
      });
    }
    return {
      target: {
        truthHash: canonicalDigest(createBuiltinTruthSnapshot()),
        endpointCount: target.endpointCount,
        endpointMapDigest: target.endpointMapDigest,
        pairCount: target.pairCount,
        pairMapDigest: target.pairMapDigest,
      },
      authorities,
    };
  } finally {
    assertContainedTemporaryRoot(temporaryRoot);
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  const derived = await deriveAuthorities();
  if (printOnly) {
    process.stdout.write(`${JSON.stringify(derived, null, 2)}\n`);
  } else {
    const expectedTruthHashes = REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(
      ({ truthHash }) => truthHash,
    );
    const authorityTruthHashes = Object.keys(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
    );
    if (!isDeepStrictEqual(authorityTruthHashes, expectedTruthHashes)) {
      throw new Error(
        `Connector authority truth-hash rows ${JSON.stringify(authorityTruthHashes)} do not exactly match reviewed snapshots ${JSON.stringify(expectedTruthHashes)}.`,
      );
    }
    if (!isDeepStrictEqual(derived.target, CURRENT_CONNECTION_SEMANTICS_AUTHORITY)) {
      throw new Error(
        `Current connector authority is stale. Expected ${JSON.stringify(CURRENT_CONNECTION_SEMANTICS_AUTHORITY)}, derived ${JSON.stringify(derived.target)}.`,
      );
    }
    const expectedAuthorities = expectedTruthHashes.map((truthHash) => ({
      truthHash,
      ...REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[truthHash],
    }));
    if (!isDeepStrictEqual(derived.authorities, expectedAuthorities)) {
      throw new Error(
        `Historical connector authority is stale. Run npm run migration-history:check -- --print, inspect the complete source/current delta, and update only after review.`,
      );
    }
    const changedRows = derived.authorities.filter(
      ({ endpointDeltas, pairDeltas }) => endpointDeltas.length > 0 || pairDeltas.length > 0,
    );
    const endpointDeltaCount = changedRows.reduce(
      (count, { endpointDeltas }) => count + endpointDeltas.length,
      0,
    );
    process.stdout.write(
      `Historical connector authority verified: ${derived.authorities.length} source truths, ${derived.target.endpointCount} current endpoints, ${endpointDeltaCount} truth-row endpoint deltas, 0 pair deltas.\n`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Historical connection-semantics check failed: ${message}\n`);
  process.exitCode = 1;
}
