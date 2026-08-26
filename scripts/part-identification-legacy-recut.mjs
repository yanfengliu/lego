import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  assertSelectedDecodeBudget,
  authenticateLegacyRecutInputs,
  createLegacyRecutCropComparator,
  sha256Digest,
} from "./part-identification-legacy-recut-source.mjs";
import { assertPairJudgedTruthFromParsedJson } from "./part-identification-pair-judged.mjs";

export { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";

export const PART_IDENTIFICATION_LEGACY_RECUT_SCHEMA = "lego.part-identification-legacy-recut/1";

const COMPILE_INPUT_KEYS = [
  "calloutRoot",
  "currentManifestBytes",
  "legacyManifestBytes",
  "truthBytes",
];
const VERIFY_INPUT_KEYS = [...COMPILE_INPUT_KEYS, "artifactBytes"].sort();

const AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  answerArtifactsConsumed: false,
  legacyAnswerV4Accepted: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  semanticIdentity: false,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
});

function relationRow({ truth, legacy, current, comparison }) {
  return {
    n: truth.n,
    judgedCropSha256: truth.judgedCropSha256,
    elementId: truth.elementId,
    verdict: truth.same === undefined ? "unjudgeable" : truth.same ? "same" : "different",
    comparisonDisposition: comparison.method === "refused" ? "refused" : "accepted",
    identity: legacy.identity,
    pageNumber: legacy.pageNumber,
    stepNumber: legacy.stepNumber,
    quantity: legacy.quantity,
    legacyCrop: {
      file: legacy.file,
      sha256: legacy.sha256,
      byteLength: legacy.byteLength,
      widthPx: legacy.widthPx,
      heightPx: legacy.heightPx,
    },
    currentCrop: {
      file: current.file,
      sha256: current.sha256,
      byteLength: current.byteLength,
      widthPx: current.widthPx,
      heightPx: current.heightPx,
    },
    comparison,
    ...(truth.reason === undefined ? {} : { unjudgeableReason: truth.reason }),
  };
}

function tally(rows, { verdict = null, disposition = null, method = null } = {}) {
  const selected = rows.filter(
    (row) =>
      (verdict === null || row.verdict === verdict) &&
      (disposition === null || row.comparisonDisposition === disposition) &&
      (method === null || row.comparison.method === method),
  );
  return {
    relations: selected.length,
    pieces: selected.reduce((total, row) => total + row.quantity, 0),
  };
}

function accountingFor(relations, unjudgeable, truth, decodeWork) {
  const retainedSame = tally(relations, { verdict: "same" });
  const retainedDifferent = tally(relations, { verdict: "different" });
  const acceptedSame = tally(relations, { verdict: "same", disposition: "accepted" });
  const acceptedSameExact = tally(relations, {
    verdict: "same",
    disposition: "accepted",
    method: "exact-png-bytes",
  });
  const acceptedSameRecut = tally(relations, {
    verdict: "same",
    disposition: "accepted",
    method: "exact-bottom-background-recut",
  });
  const acceptedDifferent = tally(relations, {
    verdict: "different",
    disposition: "accepted",
  });
  const acceptedDifferentExact = tally(relations, {
    verdict: "different",
    disposition: "accepted",
    method: "exact-png-bytes",
  });
  const acceptedDifferentRecut = tally(relations, {
    verdict: "different",
    disposition: "accepted",
    method: "exact-bottom-background-recut",
  });
  const refusedSame = tally(relations, { verdict: "same", disposition: "refused" });
  const refusedDifferent = tally(relations, {
    verdict: "different",
    disposition: "refused",
  });
  const refused = tally(relations, { disposition: "refused" });
  return {
    truthVerdicts: truth.verdicts.length,
    truthUnjudgeable: truth.unjudgeable.length,
    verdictRelations: relations.length,
    verdictPieces: relations.reduce((total, row) => total + row.quantity, 0),
    retainedSameRelations: retainedSame.relations,
    retainedSamePieces: retainedSame.pieces,
    retainedDifferentRelations: retainedDifferent.relations,
    retainedDifferentPieces: retainedDifferent.pieces,
    acceptedSameRelations: acceptedSame.relations,
    acceptedSamePieces: acceptedSame.pieces,
    acceptedSameExactPngRelations: acceptedSameExact.relations,
    acceptedSameExactPngPieces: acceptedSameExact.pieces,
    acceptedSameBottomRecutRelations: acceptedSameRecut.relations,
    acceptedSameBottomRecutPieces: acceptedSameRecut.pieces,
    acceptedDifferentRelations: acceptedDifferent.relations,
    acceptedDifferentPieces: acceptedDifferent.pieces,
    acceptedDifferentExactPngRelations: acceptedDifferentExact.relations,
    acceptedDifferentExactPngPieces: acceptedDifferentExact.pieces,
    acceptedDifferentBottomRecutRelations: acceptedDifferentRecut.relations,
    acceptedDifferentBottomRecutPieces: acceptedDifferentRecut.pieces,
    refusedSameRelations: refusedSame.relations,
    refusedSamePieces: refusedSame.pieces,
    refusedDifferentRelations: refusedDifferent.relations,
    refusedDifferentPieces: refusedDifferent.pieces,
    refusedRelations: refused.relations,
    refusedPieces: refused.pieces,
    unjudgeableRelations: unjudgeable.length,
    unjudgeablePieces: unjudgeable.reduce((total, row) => total + row.quantity, 0),
    perCompileSelectedCropImages: decodeWork.images,
    perCompileDecodePixels: decodeWork.pixels,
    perCompileDecodePixelLimit: decodeWork.limit,
  };
}

function relationCommitmentFor(relations, unjudgeable) {
  const rows = [...relations, ...unjudgeable].map((row) => ({
    n: row.n,
    identity: row.identity,
    stepNumber: row.stepNumber,
    quantity: row.quantity,
    verdict: row.verdict,
    comparisonDisposition: row.comparisonDisposition,
    method: row.comparison.method,
    reason: row.comparison.reason ?? null,
    legacySha256: row.legacyCrop.sha256,
    currentSha256: row.currentCrop.sha256,
    retainedDifferingPixels: row.comparison.retainedDifferingPixels ?? 0,
    maximumChannelDelta: row.comparison.maximumChannelDelta ?? 0,
  }));
  const bytes = Buffer.from(`${JSON.stringify(rows)}\n`);
  return { rows: rows.length, bytes: bytes.length, digest: sha256Digest(bytes) };
}

function assertExactInputKeys(input, expectedKeys, label) {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(",") !== expectedKeys.join(",")
  ) {
    throw new Error(
      `${label} must contain exactly ${expectedKeys.join(", ")}. Extra evidence roles, including answer artifacts, cannot enter this image-only bridge.`,
    );
  }
}

function compileWithPins(input, pins) {
  const { legacyRows, currentRows, truthArtifact, sourceIndex } = authenticateLegacyRecutInputs(
    input,
    pins,
  );
  const truth = truthArtifact.value;
  const truthSummary = assertPairJudgedTruthFromParsedJson(truth, "Legacy-recut pair truth");
  if (truthSummary.lastStep !== pins.lastStep) {
    throw new Error(
      `Legacy-recut pair truth ends at printed step ${truthSummary.lastStep}; the pinned bridge requires exactly step ${pins.lastStep}.`,
    );
  }

  const legacyByDigest = new Map();
  for (const row of legacyRows.values()) {
    if (row.stepNumber > pins.lastStep) continue;
    const matches = legacyByDigest.get(row.sha256) ?? [];
    matches.push(row);
    legacyByDigest.set(row.sha256, matches);
  }
  const select = (truthRow) => {
    const matches = legacyByDigest.get(truthRow.judgedCropSha256) ?? [];
    if (matches.length === 0) {
      throw new Error(
        `Pair-sheet row ${truthRow.n} judged crop ${truthRow.judgedCropSha256}, but the exact frozen /5 prefix contains no such crop. Restore that retained generation; do not search another run by appearance.`,
      );
    }
    return matches
      .sort((left, right) =>
        left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0,
      )
      .map((legacy) => {
        const current = currentRows.get(legacy.identity);
        if (
          current === undefined ||
          current.pageNumber !== legacy.pageNumber ||
          current.stepNumber !== legacy.stepNumber ||
          current.quantity !== legacy.quantity ||
          current.evidenceKind !== "part-art" ||
          legacy.evidenceKind !== "part-art"
        ) {
          throw new Error(
            `Frozen callout ${legacy.identity} does not have one current /6 part-art row with the same page, step, and quantity. Identity-coordinate continuity cannot be inferred across a changed source row.`,
          );
        }
        return { truth: truthRow, legacy, current };
      });
  };
  const selections = [...truth.verdicts, ...truth.unjudgeable].flatMap(select);
  const decodeWork = assertSelectedDecodeBudget(selections);
  const compare = createLegacyRecutCropComparator(input.calloutRoot);
  const bridged = selections.map(({ truth: truthRow, legacy, current }) =>
    relationRow({
      truth: truthRow,
      legacy,
      current,
      comparison: compare(legacy, current, `Pair-sheet row ${truthRow.n} ${legacy.identity}`),
    }),
  );
  const relations = bridged.filter((row) => row.verdict !== "unjudgeable");
  const unjudgeable = bridged.filter((row) => row.verdict === "unjudgeable");
  for (const row of truth.unjudgeable) {
    const retained = unjudgeable.filter(({ n }) => n === row.n);
    const pieces = retained.reduce((total, relation) => total + relation.quantity, 0);
    if (retained.length !== row.callouts || pieces !== row.pieces) {
      throw new Error(
        `Unjudgeable pair-sheet row ${row.n} declares ${row.callouts} callouts/${row.pieces} pieces, but the exact frozen manifest derives ${retained.length}/${pieces}. Preserve the complete blank-claim row instead of dropping it.`,
      );
    }
  }
  const accounting = accountingFor(relations, unjudgeable, truth, decodeWork);
  if (pins.expectedAccounting !== null && !isDeepStrictEqual(accounting, pins.expectedAccounting)) {
    throw new Error(
      `Legacy-recut accounting does not reproduce the pinned first-50 population. Expected ${JSON.stringify(pins.expectedAccounting)}, received ${JSON.stringify(accounting)}. Do not widen the recut rule or discard counterevidence.`,
    );
  }
  const relationCommitment = relationCommitmentFor(relations, unjudgeable);
  if (
    pins.expectedRelationCommitment !== null &&
    !isDeepStrictEqual(relationCommitment, pins.expectedRelationCommitment)
  ) {
    throw new Error(
      `Legacy-recut relation commitment does not reproduce the pinned first-50 identities and counterevidence. Expected ${JSON.stringify(pins.expectedRelationCommitment)}, received ${JSON.stringify(relationCommitment)}. Re-review any changed relation instead of preserving only aggregate counts.`,
    );
  }
  return {
    schemaVersion: PART_IDENTIFICATION_LEGACY_RECUT_SCHEMA,
    authority: AUTHORITY,
    inputTrust:
      pins === CURRENT_LEGACY_RECUT_PINS
        ? "module-owned-current-pins"
        : "caller-supplied-unverified",
    scope: {
      lastStep: pins.lastStep,
      expectedPrintedSteps: sourceIndex.expectedPrintedSteps,
      suffixStepsReconstructed: false,
    },
    inputs: {
      legacyManifest: { ...pins.legacyManifest },
      currentManifest: { ...pins.currentManifest },
      truth: { ...pins.truth },
    },
    sourceIndex,
    accounting,
    relationCommitment,
    relations,
    unjudgeable,
  };
}

export function compilePartIdentificationLegacyRecut(input) {
  assertExactInputKeys(input, COMPILE_INPUT_KEYS, "Legacy-recut compiler input");
  return compileWithPins(input, CURRENT_LEGACY_RECUT_PINS);
}

export function encodePartIdentificationLegacyRecut(value) {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function verifyPartIdentificationLegacyRecut(input) {
  assertExactInputKeys(input, VERIFY_INPUT_KEYS, "Legacy-recut verifier input");
  const artifact = jsonArtifactFromBytes(input.artifactBytes, "Legacy-recut artifact");
  const compileInput = Object.fromEntries(COMPILE_INPUT_KEYS.map((key) => [key, input[key]]));
  const expected = compilePartIdentificationLegacyRecut(compileInput);
  const expectedBytes = encodePartIdentificationLegacyRecut(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  if (
    CURRENT_LEGACY_RECUT_PINS.expectedArtifact !== null &&
    (expectedBytes.length !== CURRENT_LEGACY_RECUT_PINS.expectedArtifact.bytes ||
      expectedDigest !== CURRENT_LEGACY_RECUT_PINS.expectedArtifact.digest)
  ) {
    throw new Error(
      `Legacy-recut verifier derived ${expectedBytes.length} bytes at ${expectedDigest}, but production pins require ${CURRENT_LEGACY_RECUT_PINS.expectedArtifact.bytes} bytes at ${CURRENT_LEGACY_RECUT_PINS.expectedArtifact.digest}. Review and repin the complete artifact rather than accepting equal aggregate counts.`,
    );
  }
  if (!artifact.bytes.equals(expectedBytes)) {
    throw new Error(
      "Legacy-recut artifact does not exactly reproduce from its pinned manifests, crop bytes, and truth/3 input. Regenerate it; edited results and copied authority fields are not accepted.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest: expectedDigest,
  });
  return verified;
}

export function isVerifiedPartIdentificationLegacyRecut(value) {
  return typeof value === "object" && value !== null && verifiedArtifacts.has(value);
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error(
      "Legacy-recut publication requires the opaque result of its module-owned independent verifier.",
    );
  }
  return record;
}

export function bytesFromVerifiedPartIdentificationLegacyRecut(value) {
  return Buffer.from(verifiedRecord(value).bytes);
}

export function inspectVerifiedPartIdentificationLegacyRecut(value) {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
}

export const __testOnly = Object.freeze({
  compileWithPins(input, pins) {
    assertExactInputKeys(input, COMPILE_INPUT_KEYS, "Synthetic legacy-recut compiler input");
    return compileWithPins(input, pins);
  },
  verifyUnbranded(input, pins) {
    assertExactInputKeys(input, VERIFY_INPUT_KEYS, "Synthetic legacy-recut verifier input");
    const artifact = jsonArtifactFromBytes(input.artifactBytes, "Synthetic legacy-recut artifact");
    const compileInput = Object.fromEntries(COMPILE_INPUT_KEYS.map((key) => [key, input[key]]));
    const expected = compileWithPins(compileInput, pins);
    const expectedBytes = encodePartIdentificationLegacyRecut(expected);
    if (!artifact.bytes.equals(expectedBytes)) {
      throw new Error(
        "Synthetic legacy-recut artifact does not exactly reproduce from its test manifests, crop bytes, and truth input.",
      );
    }
    return Object.freeze({ digest: sha256Digest(expectedBytes) });
  },
});
