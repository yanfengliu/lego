import {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  assertV6CalloutManifest,
  jsonArtifactFromBytes,
} from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  sha256Digest,
} from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  deriveOfficialPrefixCut,
} from "./part-identification-legacy-recut-semantic-source.mjs";
import {
  inspectVerifiedPartIdentificationLegacyRecutSemantic,
  isVerifiedPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";
import { canonicalSourceArtJson as canonicalJson } from "./part-identification-source-art-contribution.mjs";
import {
  applyOfficialCapacity,
  assertAuthorityAndRowKeys,
  assertPinnedResult,
  broadClassDigest,
  classImage,
  classifyExactClasses,
  commitmentFor,
  compactManifestRow,
  exactClassDigest,
  exactPinnedBytes,
  exactPrefix,
  linearTransformMilli,
  publishedRosters,
  relationOrder,
  rosterCommitments,
  safeRow,
  semanticIdentityRows,
  tally,
} from "./part-identification-source-art-semantic-rebound-classification.mjs";
import { scanSourceArtSemanticPrefix } from "./part-identification-source-art-semantic-rebound-scan.mjs";
import {
  SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
  createSourceArtWorkLedger,
} from "./part-identification-source-art-semantic-rebound-source.mjs";
export const PART_IDENTIFICATION_SOURCE_ART_SEMANTIC_REBOUND_SCHEMA =
  "lego.part-identification-source-art-semantic-rebound/2";
export const SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES = 256 * 1024;
const MAX_PDF_BYTES = 80 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_OFFICIAL_BYTES = 2 * 1024 * 1024;
const EXPECTED_PREFIX_ROWS = 187;
const EXPECTED_PREFIX_PIECES = 320;
const LAST_STEP = 50;
const EXPECTED_PRINTED_STEPS = 359;
const COMPILE_INPUT_KEYS = ["manifestBytes", "officialModelBytes", "pdfBytes", "semantic"];
const VERIFY_INPUT_KEYS = [...COMPILE_INPUT_KEYS, "artifactBytes"].sort();

const AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  answerArtifactsConsumed: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  semanticIdentity: true,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
});

const CURRENT_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  pdf: Object.freeze({
    path: "recipes/6651557.pdf",
    bytes: 70_238_655,
    digest: CURRENT_LEGACY_RECUT_PINS.sourceHash,
  }),
  manifest: CURRENT_LEGACY_RECUT_PINS.currentManifest,
  officialModel: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel,
  expectedSemanticCommitment: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedSemanticCommitment,
  expectedAccounting: Object.freeze({
    fullSourceCalloutRows: 881,
    fullSourcePartArtRows: 859,
    fullSourceSemanticRows: 22,
    expectedPrintedSteps: 359,
    prefixLastStep: 50,
    prefixPartArtRows: 187,
    prefixPartArtPieces: 320,
    containmentUniqueRows: 183,
    exactLabelRows: 183,
    measuredRows: 180,
    semanticAnchorRelations: 70,
    semanticAnchorPieces: 107,
    exactClassProofRows: 145,
    preCapacityCandidateRelations: 16,
    preCapacityCandidatePieces: 40,
    acceptedSourceArtRelations: 16,
    acceptedSourceArtPieces: 40,
    refusedSourceArtRelations: 0,
    refusedSourceArtPieces: 0,
    safeIdentityRelations: 86,
    safeIdentityPieces: 147,
    residualRelations: 101,
    residualPieces: 173,
  }),
  expectedCommitments: Object.freeze({
    acceptedSourceArt: Object.freeze({
      rows: 16,
      bytes: 703,
      digest: "sha256:e79b8e76fcda7ea27b29fc57c7e94f5389ad13c6c8360f28f85d617f02fcd337",
    }),
    candidateSourceArt: Object.freeze({
      rows: 16,
      bytes: 3_679,
      digest: "sha256:2b66a966b49c8b7adae17ec3cb8cc1a216d6703f9724b68f7fb942a7f3d82751",
    }),
    exactClasses: Object.freeze({
      rows: 63,
      bytes: 35_416,
      digest: "sha256:1d692642975bd021ad217ef4ee6172c7c1b6977dadbaffde3a79004671a6ccfa",
    }),
    exactClassProofs: Object.freeze({
      rows: 145,
      bytes: 96_354,
      digest: "sha256:abf870874f2cd23edd27db41b9133dfc121d9806af3ad09c20405aa1b80cc323",
    }),
    refusedSourceArt: Object.freeze({
      rows: 0,
      bytes: 74,
      digest: "sha256:b0570e495898ea0a05a86bb4ff33bc2a5ccdc1d1f7a5f7213cfffec361ae8b0b",
    }),
    residual: Object.freeze({
      rows: 101,
      bytes: 8_579,
      digest: "sha256:4e65ce659cb57b72e1607b8ee6572992af72cc50ccd430e8e319b00f4706c14c",
    }),
    safeIdentity: Object.freeze({
      rows: 86,
      bytes: 15_815,
      digest: "sha256:3d9f6f90c79b7ea128635ff335d9f46264fcec0d77ecf5159feb247ca2db5011",
    }),
    scan: Object.freeze({
      rows: 187,
      bytes: 36_367,
      digest: "sha256:918ec62de9e1c85db23e5dc809a2441c6609565aee12418dc7735056c951b036",
    }),
    semanticAnchors: Object.freeze({
      rows: 70,
      bytes: 9_354,
      digest: "sha256:b85d7b7d59e4ae7328e37cc639a88f19b80ba58eb0adb64e3733f1e65614e8e1",
    }),
  }),
  expectedArtifact: Object.freeze({
    bytes: 211_319,
    digest: "sha256:4be7bd77d386a7a656019affe9c995e77135080a7aa90df19e43a6f2167ab721",
  }),
});

export { CURRENT_PINS as CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS };

function byteRole(value, label, maximumBytes) {
  return snapshotBoundedUint8Array(value, { label, minimumBytes: 1, maximumBytes });
}

function snapshotInput(input, expectedKeys, label) {
  const roles = snapshotExactDataObject(input, label, expectedKeys);
  if (!isVerifiedPartIdentificationLegacyRecutSemantic(roles.semantic)) {
    throw new TypeError(
      `${label}.semantic must be the opaque result of the independent legacy-recut semantic verifier. Parsed artifacts and caller-shaped lookalikes carry no identity authority.`,
    );
  }
  return {
    ...(expectedKeys.includes("artifactBytes")
      ? {
          artifactBytes: byteRole(
            roles.artifactBytes,
            "Source-art semantic rebound artifact bytes",
            SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES,
          ),
        }
      : {}),
    manifestBytes: byteRole(
      roles.manifestBytes,
      "Source-art semantic rebound v6 manifest bytes",
      MAX_MANIFEST_BYTES,
    ),
    officialModelBytes: byteRole(
      roles.officialModelBytes,
      "Source-art semantic rebound official model bytes",
      MAX_OFFICIAL_BYTES,
    ),
    pdfBytes: byteRole(roles.pdfBytes, "Source-art semantic rebound PDF bytes", MAX_PDF_BYTES),
    semantic: roles.semantic,
  };
}

async function compileWithPins(input) {
  exactPinnedBytes(input.pdfBytes, CURRENT_PINS.pdf, "Source-art semantic rebound PDF");
  exactPinnedBytes(
    input.manifestBytes,
    CURRENT_PINS.manifest,
    "Source-art semantic rebound manifest",
  );
  exactPinnedBytes(
    input.officialModelBytes,
    CURRENT_PINS.officialModel,
    "Source-art semantic rebound official model",
  );
  const semanticInspection = inspectVerifiedPartIdentificationLegacyRecutSemantic(input.semantic);
  const semanticRows = semanticIdentityRows(
    semanticInspection,
    AUTHORITY,
    CURRENT_PINS.expectedSemanticCommitment,
  );
  const semanticByIdentity = new Map(semanticRows.map((row) => [row.identity, row]));
  const manifest = jsonArtifactFromBytes(
    input.manifestBytes,
    "Source-art semantic rebound manifest",
  ).value;
  assertV6CalloutManifest(manifest);
  const source = exactPrefix(manifest, {
    callouts: 881,
    lastStep: LAST_STEP,
    pagesCropped: FULL_CALLOUT_MANIFEST_EXPECTATION.pagesCropped,
    partArt: 859,
    prefixPieces: EXPECTED_PREFIX_PIECES,
    prefixRows: EXPECTED_PREFIX_ROWS,
    semantic: 22,
  });
  const officialCut = await deriveOfficialPrefixCut(
    new Map(manifest.callouts.map((row) => [row.identity, row])),
    input.officialModelBytes,
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  );
  if (
    officialCut.sourceRelations !== EXPECTED_PREFIX_ROWS ||
    officialCut.sourcePieces !== EXPECTED_PREFIX_PIECES ||
    officialCut.officialPrefixPieces !== EXPECTED_PREFIX_PIECES
  ) {
    throw new Error(
      "Source-art semantic rebound official cut does not conserve the 187/320 prefix.",
    );
  }
  const ledger = createSourceArtWorkLedger();
  const scan = await scanSourceArtSemanticPrefix(
    input.pdfBytes,
    source.prefix,
    semanticByIdentity,
    ledger,
  );
  const classification = classifyExactClasses(scan.proofs, semanticByIdentity);
  const capacity = applyOfficialCapacity(
    classification.candidates,
    semanticRows,
    officialCut.availability,
  );
  const safeIdentity = [
    ...semanticRows.map((row) => safeRow(row, "verified-legacy-recut-semantic")),
    ...capacity.accepted.map((row) => safeRow(row, "exact-source-art-semantic-rebound")),
  ].sort(relationOrder);
  const safeIdentities = new Set(safeIdentity.map(({ identity }) => identity));
  const residual = source.prefix
    .filter(({ identity }) => !safeIdentities.has(identity))
    .map(compactManifestRow)
    .sort(relationOrder);
  const rosters = publishedRosters(
    scan,
    classification,
    capacity,
    semanticRows,
    safeIdentity,
    residual,
  );
  const commitments = {
    ...rosterCommitments(rosters),
    exactClasses: commitmentFor(
      "lego.part-identification-source-art-semantic-rebound-exactClasses/1",
      classification.classes,
    ),
  };
  const accounting = {
    fullSourceCalloutRows: manifest.callouts.length,
    fullSourcePartArtRows: source.physical.length,
    fullSourceSemanticRows: source.semantic.length,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    prefixLastStep: LAST_STEP,
    prefixPartArtRows: source.prefix.length,
    prefixPartArtPieces: source.prefix.reduce((total, row) => total + row.quantity, 0),
    containmentUniqueRows: scan.scans.filter(
      ({ containmentCandidateCount }) => containmentCandidateCount === 1,
    ).length,
    exactLabelRows: scan.scans.filter(({ labelCount }) => labelCount === 1).length,
    measuredRows: scan.scans.filter(({ measured }) => measured).length,
    semanticAnchorRelations: tally(semanticRows).relations,
    semanticAnchorPieces: tally(semanticRows).pieces,
    exactClassProofRows: rosters.exactClassProofs.length,
    preCapacityCandidateRelations: tally(classification.candidates).relations,
    preCapacityCandidatePieces: tally(classification.candidates).pieces,
    acceptedSourceArtRelations: tally(capacity.accepted).relations,
    acceptedSourceArtPieces: tally(capacity.accepted).pieces,
    refusedSourceArtRelations: tally(capacity.refused).relations,
    refusedSourceArtPieces: tally(capacity.refused).pieces,
    safeIdentityRelations: tally(safeIdentity).relations,
    safeIdentityPieces: tally(safeIdentity).pieces,
    residualRelations: tally(residual).relations,
    residualPieces: tally(residual).pieces,
  };
  assertPinnedResult(accounting, commitments, CURRENT_PINS);
  const work = ledger.inspection();
  const artifact = {
    schemaVersion: PART_IDENTIFICATION_SOURCE_ART_SEMANTIC_REBOUND_SCHEMA,
    authority: AUTHORITY,
    inputTrust: "module-owned-current-pins-and-opaque-semantic-handle",
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: LAST_STEP,
      expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
      suffixStepsReconstructed: false,
      publication: "listed-safe-semantic-identities-only",
    },
    inputs: {
      manifest: { ...CURRENT_PINS.manifest },
      officialModel: { ...CURRENT_PINS.officialModel },
      pdf: { ...CURRENT_PINS.pdf },
      semanticArtifactSha256: semanticInspection.digest,
      semanticCommitment: CURRENT_PINS.expectedSemanticCommitment,
    },
    sourceIndex: {
      ...CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex,
      cropBytesAuthenticated: "not-consumed-source-pdf-only",
    },
    accounting,
    work: {
      ...work,
      componentPixelLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
      decodedByteLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
      decodedPixelLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
      fullPageRenders: new Set(scan.proofs.map(({ row }) => row.pageNumber)).size,
      isolatedControlRenders: scan.proofs.length,
      isolatedImageRenders: scan.proofs.length,
      officialModelIndexCalls: officialCut.officialModelIndexCalls,
      officialModelInputByteLimit: officialCut.officialModelInputByteLimit,
      officialModelInputBytes: officialCut.officialModelInputBytes,
      officialXmlDecodeByteLimit: officialCut.officialXmlDecodeByteLimit,
      officialXmlDecodedBytes: officialCut.officialXmlDecodedBytes,
      officialXmlFullDecodes: officialCut.officialXmlFullDecodes,
      pdfFetchRenderDisposeDestroyCycles: 1,
    },
    officialCut: {
      assignmentPublished: false,
      commitment: officialCut.officialCutCommitment,
      firstPrintedStep: 1,
      lastPrintedStep: LAST_STEP,
      prefixPieces: officialCut.officialPrefixPieces,
    },
    proofProtocol: {
      crossMemberRasterMaskOrRgbaEqualityRequired: false,
      crossMemberSemanticEquivalence:
        "exact-decoded-rgb24-digest-dimensions-kind-plus-milli-quantized-alpha-renamed-normalized-ordered-source-closure",
      fullBackgroundRgb: "#899093",
      isolatedControlBackgroundRgb: "#102030",
      numericNormalization:
        "transform-and-path-coordinate-operands-use-nearest-milli-unit-including-linear-ctm;path-opcodes-and-image-dimensions-remain-exact-integers",
      pageTranslationRasterPhaseMayDiffer: true,
      perMemberPublishedRasterEvidence: "support-mask-and-isolated-full-support-rgba-digests",
      perMemberRasterEligibility:
        "nonempty-support-mask-with-internal-isolated-full-rgba-equality-and-zero-on-support-interference",
      rasterScale: 8,
      resourceNormalization:
        "dependency-and-terminal-resource-must-match-exactly-before-alpha-renaming-to-terminal-image-resource",
      translationNormalization:
        "only-terminal-image-transform-e-f-and-associated-clip-path-coordinates-are-translation-normalized",
    },
    commitments,
    exactClasses: classification.classes,
    rosters,
  };
  assertAuthorityAndRowKeys(artifact, AUTHORITY);
  return artifact;
}

export async function compilePartIdentificationSourceArtSemanticRebound(input) {
  const snapshot = snapshotInput(
    input,
    COMPILE_INPUT_KEYS,
    "Source-art semantic rebound compiler input",
  );
  await Promise.resolve();
  return compileWithPins(snapshot);
}

export function encodePartIdentificationSourceArtSemanticRebound(value) {
  try {
    return Buffer.from(`${canonicalJson(value)}\n`);
  } catch (cause) {
    const undefinedPaths = [];
    const visit = (entry, path) => {
      if (entry === undefined) undefinedPaths.push(path);
      else if (entry !== null && typeof entry === "object") {
        for (const [key, child] of Object.entries(entry)) visit(child, `${path}.${key}`);
      }
    };
    visit(value, "artifact");
    throw new Error(
      `Source-art semantic rebound cannot encode undefined fields at ${undefinedPaths.slice(0, 8).join(", ") || "unknown paths"}.`,
      { cause },
    );
  }
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPartIdentificationSourceArtSemanticRebound(input) {
  const snapshot = snapshotInput(
    input,
    VERIFY_INPUT_KEYS,
    "Source-art semantic rebound verifier input",
  );
  await Promise.resolve();
  const artifact = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Source-art semantic rebound artifact",
  );
  const expected = await compileWithPins(
    Object.fromEntries(COMPILE_INPUT_KEYS.map((key) => [key, snapshot[key]])),
  );
  const expectedBytes = encodePartIdentificationSourceArtSemanticRebound(expected);
  const digest = sha256Digest(expectedBytes);
  if (expectedBytes.length > SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES) {
    throw new Error(
      `Source-art semantic rebound artifact is ${expectedBytes.length} bytes, above the fixed ${SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES}-byte ordinary-Git ceiling. Minimize repeated evidence instead of raising the ceiling.`,
    );
  }
  if (
    expectedBytes.length !== CURRENT_PINS.expectedArtifact.bytes ||
    digest !== CURRENT_PINS.expectedArtifact.digest
  ) {
    throw new Error(
      `Source-art semantic rebound independently derived ${expectedBytes.length} bytes at ${digest}, not pinned ${CURRENT_PINS.expectedArtifact.bytes} bytes at ${CURRENT_PINS.expectedArtifact.digest}. Re-review and repin the complete artifact.`,
    );
  }
  if (!artifact.bytes.equals(expectedBytes)) {
    throw new Error(
      "Source-art semantic rebound artifact does not exactly reproduce from the pinned full source, official cut, and opaque semantic handle. Regenerate it; edited identity or authority fields are not accepted.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest,
  });
  return verified;
}
function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error(
      "Source-art semantic rebound publication requires the opaque result of its module-owned independent verifier.",
    );
  }
  return record;
}
export function inspectVerifiedPartIdentificationSourceArtSemanticRebound(value) {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
}
export function bytesFromVerifiedPartIdentificationSourceArtSemanticRebound(value) {
  return Buffer.from(verifiedRecord(value).bytes);
}

export function isVerifiedPartIdentificationSourceArtSemanticRebound(value) {
  return typeof value === "object" && value !== null && verifiedArtifacts.has(value);
}
export const __testOnly = Object.freeze({
  applyOfficialCapacity,
  assertAuthorityAndRowKeys: (artifact) => assertAuthorityAndRowKeys(artifact, AUTHORITY),
  broadClassDigest,
  classImage,
  classifyExactClasses,
  exactClassDigest,
  linearTransformMilli,
});
