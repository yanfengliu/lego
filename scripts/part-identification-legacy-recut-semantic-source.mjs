import { isDeepStrictEqual } from "node:util";

import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import { sha256Digest } from "./part-identification-legacy-recut-source.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

export const LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES = 2 * 1024 * 1024;
export const LEGACY_RECUT_SEMANTIC_OFFICIAL_XML_FULL_DECODES_PER_MODEL_INDEX = 2;
export const LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_DECODE_BYTES =
  LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES *
  LEGACY_RECUT_SEMANTIC_OFFICIAL_XML_FULL_DECODES_PER_MODEL_INDEX;

export const CURRENT_LEGACY_RECUT_SEMANTIC_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  lastStep: 50,
  expectedPrintedSteps: 359,
  legacyRecut: Object.freeze({
    path: "output/part-identification/legacy-recut.json",
    schemaVersion: "lego.part-identification-legacy-recut/1",
    bytes: 102_513,
    digest: "sha256:1f7a0fdcb2d665bd3fd30b8e5666307a18c884607640e6b229ef2077f3ebbc8c",
  }),
  officialModel: Object.freeze({
    path: "output/official-model/vx1087034_21066_a.xml",
    bytes: 1_903_169,
    digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  }),
  expectedAccounting: Object.freeze({
    sourcePartArtRelations: 187,
    sourcePartArtPieces: 320,
    officialInventoryBricks: 1_465,
    officialSequencedIdentities: 1_464,
    officialPrefixPieces: 320,
    legacyAcceptedSameRelations: 73,
    legacyAcceptedSamePieces: 113,
    semanticIdentityRelations: 70,
    semanticIdentityPieces: 107,
    semanticExactPngRelations: 24,
    semanticExactPngPieces: 25,
    semanticBottomRecutRelations: 46,
    semanticBottomRecutPieces: 82,
    officialConflictRelations: 3,
    officialConflictPieces: 6,
    officialConflictExactPngRelations: 1,
    officialConflictExactPngPieces: 1,
    officialConflictBottomRecutRelations: 2,
    officialConflictBottomRecutPieces: 5,
    legacyRefusedSameRelations: 1,
    legacyRefusedSamePieces: 2,
    retainedDifferentRelations: 9,
    retainedDifferentPieces: 11,
    retainedUnjudgeableRelations: 2,
    retainedUnjudgeablePieces: 4,
  }),
  expectedPerCompileWork: Object.freeze({
    legacyRecutCropImages: 170,
    legacyRecutDecodePixels: 14_611_220,
    legacyRecutDecodePixelLimit: 16_777_216,
    officialModelIndexCalls: 1,
    officialModelInputBytes: 1_903_169,
    officialModelInputByteLimit: LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES,
    officialXmlFullDecodes: LEGACY_RECUT_SEMANTIC_OFFICIAL_XML_FULL_DECODES_PER_MODEL_INDEX,
    officialXmlDecodedBytes: 3_806_338,
    officialXmlDecodeByteLimit: LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_DECODE_BYTES,
  }),
  expectedOfficialCutCommitment: Object.freeze({
    rows: 50,
    bytes: 12_506,
    digest: "sha256:c584fff9cfbf5890fcf41087e8cc863f5c659b6aeee2b71c428c496cb990c9f5",
  }),
  expectedSemanticCommitment: Object.freeze({
    rows: 70,
    bytes: 30_640,
    digest: "sha256:4a2215b00c2fcc15b0fc1177cb112c4443800f7d278d220ec6ff7c60b98c8da0",
  }),
  expectedQuarantineCommitment: Object.freeze({
    rows: 4,
    bytes: 2_225,
    digest: "sha256:e8a7129f75691835c8ad9a0e9fb24773aa70a7886a408c5d49b073ffbf1cae23",
  }),
  expectedArtifact: Object.freeze({
    bytes: 42_105,
    digest: "sha256:e92ef982f9039b7fd94fb2cdca23fa5e56fb34fb6820ef4fa7ee9b999a0a63ea",
  }),
});

function assertPinnedBytes(bytes, pin, label) {
  const payload = Buffer.from(bytes);
  const observedDigest = sha256Digest(payload);
  if (payload.length !== pin.bytes || observedDigest !== pin.digest) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte artifact at ${pin.digest}; received ${payload.length} bytes at ${observedDigest}. Restore the retained source instead of substituting another model or run.`,
    );
  }
  return payload;
}

function commitmentFor(rows) {
  const bytes = Buffer.from(`${JSON.stringify(rows)}\n`);
  return Object.freeze({ rows: rows.length, bytes: bytes.length, digest: sha256Digest(bytes) });
}

function prefixQuantities(currentRows, lastStep) {
  const quantities = new Map(Array.from({ length: lastStep }, (_, index) => [index + 1, 0]));
  let relations = 0;
  let pieces = 0;
  for (const row of currentRows.values()) {
    if (row.evidenceKind !== "part-art" || row.stepNumber > lastStep) continue;
    if (row.stepNumber < 1 || !quantities.has(row.stepNumber)) {
      throw new Error(
        `Current source part-art row ${row.identity} has invalid printed step ${JSON.stringify(row.stepNumber)} inside the semantic prefix.`,
      );
    }
    quantities.set(row.stepNumber, quantities.get(row.stepNumber) + row.quantity);
    relations += 1;
    pieces += row.quantity;
  }
  return { quantities, relations, pieces };
}

/** Derive exact per-step element multisets without assigning a callout to a physical Brick. */
export async function deriveOfficialPrefixCut(currentRows, officialModelBytes, pins) {
  const payload = assertPinnedBytes(officialModelBytes, pins.officialModel, "Official model XML");
  const [actionModule, officialModule] = await Promise.all([
    importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-action-ledger.ts")),
    importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-official.ts")),
  ]);
  const official = officialModule.parseOfficialModelIndex(payload);
  const failures = officialModule.validateOfficialModelAccounting(official);
  if (failures.length > 0) {
    throw new Error(
      `Official model accounting rejected the semantic cut: ${failures.map((failure) => failure.code).join(", ")}.`,
    );
  }
  const identities = actionModule.flattenOfficialBuilderIdentities(official);
  const prefix = prefixQuantities(currentRows, pins.lastStep);
  const stepCuts = [];
  const availability = new Map();
  let cursor = 0;
  for (let stepNumber = 1; stepNumber <= pins.lastStep; stepNumber += 1) {
    const quantity = prefix.quantities.get(stepNumber);
    const selected = identities.slice(cursor, cursor + quantity);
    if (selected.length !== quantity) {
      throw new Error(
        `Official Builder order ends after ${cursor + selected.length} identities, before the exact ${cursor + quantity}-piece cut through printed step ${stepNumber}.`,
      );
    }
    const byElement = new Map();
    for (const identity of selected) {
      const brick = official.bricks[identity.brickRef];
      if (brick === undefined) {
        throw new Error(
          `Official Builder identity ${identity.brickRef} at printed step ${stepNumber} has no physical Brick record.`,
        );
      }
      if (brick.itemNos.length !== 1) {
        throw new Error(
          `Official Brick ${identity.brickRef} at printed step ${stepNumber} has ${brick.itemNos.length} item numbers; exact semantic corroboration requires one.`,
        );
      }
      const elementId = brick.itemNos[0];
      const prior = byElement.get(elementId);
      if (prior !== undefined && prior.designId !== brick.designId) {
        throw new Error(
          `Official printed step ${stepNumber} assigns element ${elementId} to both design ${prior.designId} and ${brick.designId}; semantic identity is not unique.`,
        );
      }
      byElement.set(elementId, {
        elementId,
        designId: brick.designId,
        quantity: (prior?.quantity ?? 0) + 1,
      });
    }
    const elements = [...byElement.values()].sort((left, right) =>
      left.elementId < right.elementId ? -1 : left.elementId > right.elementId ? 1 : 0,
    );
    stepCuts.push({ stepNumber, quantity, elements });
    for (const element of elements) {
      availability.set(`${stepNumber}\0${element.elementId}`, element);
    }
    cursor += quantity;
  }
  const officialCutCommitment = commitmentFor(stepCuts);
  return Object.freeze({
    stepCuts,
    availability,
    officialCutCommitment,
    sourceRelations: prefix.relations,
    sourcePieces: prefix.pieces,
    officialInventoryBricks: Object.keys(official.bricks).length,
    officialSequencedIdentities: identities.length,
    officialPrefixPieces: cursor,
    officialModelIndexCalls: 1,
    officialModelInputBytes: payload.length,
    officialModelInputByteLimit: LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES,
    officialXmlFullDecodes: LEGACY_RECUT_SEMANTIC_OFFICIAL_XML_FULL_DECODES_PER_MODEL_INDEX,
    officialXmlDecodedBytes:
      payload.length * LEGACY_RECUT_SEMANTIC_OFFICIAL_XML_FULL_DECODES_PER_MODEL_INDEX,
    officialXmlDecodeByteLimit: LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_DECODE_BYTES,
  });
}

function compactRelation(row) {
  return {
    n: row.n,
    identity: row.identity,
    pageNumber: row.pageNumber,
    stepNumber: row.stepNumber,
    quantity: row.quantity,
    elementId: row.elementId,
    comparisonMethod: row.comparison.method,
    legacyCropSha256: row.legacyCrop.sha256,
    currentCropSha256: row.currentCrop.sha256,
  };
}

function relationOrder(left, right) {
  return (
    left.n - right.n ||
    (left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0)
  );
}

/** Cross-check accepted-same relations as groups so capacity never chooses a partial winner. */
export function classifySemanticRelations(recut, availability, lastStep) {
  const acceptedSame = recut.relations.filter(
    (row) => row.verdict === "same" && row.comparisonDisposition === "accepted",
  );
  const refusedSame = recut.relations.filter(
    (row) => row.verdict === "same" && row.comparisonDisposition === "refused",
  );
  const claims = new Map();
  for (const row of acceptedSame) {
    if (row.stepNumber < 1 || row.stepNumber > lastStep) {
      throw new Error(
        `Legacy-recut accepted-same relation ${row.n}/${row.identity} is outside the published step-1-${lastStep} semantic prefix.`,
      );
    }
    const key = `${row.stepNumber}\0${row.elementId}`;
    const group = claims.get(key) ?? [];
    group.push(row);
    claims.set(key, group);
  }
  const semanticRelations = [];
  const quarantinedSameRelations = refusedSame.map((row) => ({
    ...compactRelation(row),
    quarantineReason: "legacy-recut-comparison-refused",
    legacyRefusalReason: row.comparison.reason,
    retainedDifferingPixels: row.comparison.retainedDifferingPixels ?? 0,
    maximumChannelDelta: row.comparison.maximumChannelDelta ?? 0,
    officialStepElementQuantity: null,
    relationGroupClaimedQuantity: null,
  }));
  for (const [key, rows] of claims) {
    const official = availability.get(key);
    const claimedQuantity = rows.reduce((total, row) => total + row.quantity, 0);
    const officialQuantity = official?.quantity ?? 0;
    if (officialQuantity >= claimedQuantity) {
      for (const row of rows) {
        semanticRelations.push({
          ...compactRelation(row),
          officialDesignId: official.designId,
          officialStepElementQuantity: officialQuantity,
          relationGroupClaimedQuantity: claimedQuantity,
        });
      }
    } else {
      for (const row of rows) {
        quarantinedSameRelations.push({
          ...compactRelation(row),
          quarantineReason: "official-step-element-capacity-insufficient",
          legacyRefusalReason: null,
          retainedDifferingPixels: row.comparison.retainedDifferingPixels ?? 0,
          maximumChannelDelta: row.comparison.maximumChannelDelta ?? 0,
          officialStepElementQuantity: officialQuantity,
          relationGroupClaimedQuantity: claimedQuantity,
        });
      }
    }
  }
  semanticRelations.sort(relationOrder);
  quarantinedSameRelations.sort(relationOrder);
  return Object.freeze({
    semanticRelations,
    quarantinedSameRelations,
    semanticCommitment: commitmentFor(semanticRelations),
    quarantineCommitment: commitmentFor(quarantinedSameRelations),
  });
}

export function assertPinnedSemanticResult(result, pins) {
  for (const [label, observed, expected] of [
    ["accounting", result.accounting, pins.expectedAccounting],
    ["per-compile work", result.perCompileWork, pins.expectedPerCompileWork],
    ["official-cut commitment", result.officialCutCommitment, pins.expectedOfficialCutCommitment],
    ["semantic commitment", result.semanticCommitment, pins.expectedSemanticCommitment],
    ["quarantine commitment", result.quarantineCommitment, pins.expectedQuarantineCommitment],
  ]) {
    if (expected !== null && !isDeepStrictEqual(observed, expected)) {
      throw new Error(
        `Legacy-recut semantic ${label} does not reproduce its production pin. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(observed)}. Re-review exact relations and official cuts instead of preserving aggregate counts.`,
      );
    }
  }
}
