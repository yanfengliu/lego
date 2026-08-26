import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import { CURRENT_LEGACY_RECUT_SEMANTIC_PINS } from "./part-identification-legacy-recut-semantic-source.mjs";

export const PART_IDENTIFICATION_PREFIX50_SEMANTIC_CLOSURE_SCHEMA =
  "lego.part-identification-prefix50-semantic-closure/1";
export const PREFIX50_SEMANTIC_CLOSURE_MAX_ARTIFACT_BYTES = 256 * 1024;

export const PREFIX50_SEMANTIC_CLOSURE_AUTHORITY = Object.freeze({
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
  action: false,
  documentMutation: false,
  replay: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
});

export const PREFIX50_REVIEW_OUTCOMES_SCHEMA = "lego.local-prefix50-semantic-review-outcomes/1";
export const PREFIX50_REVIEW_METHOD =
  "original-resolution-side-by-side-booklet-callout-and-inventory-crop";
export const PREFIX50_REVIEW_AUTHORITY = Object.freeze({
  semanticIdentity: true,
  physicalAssignment: false,
  physicalFrame: false,
  catalogAdmission: false,
  coveragePublication: false,
  action: false,
  placement: false,
  documentMutation: false,
  replay: false,
  completion: false,
});

const reviewed = (identity, elementId) => Object.freeze({ identity, elementId });

export const PREFIX50_STATIC_REVIEWED_MAP = Object.freeze([
  reviewed("p23|q1|x120.898|y467.756", "663626"),
  reviewed("p23|q1|x85.937|y467.756", "6514469"),
  reviewed("p30|q1|x135.460|y449.299", "306926"),
  reviewed("p30|q1|x84.948|y486.203", "663626"),
  reviewed("p31|q1|x117.548|y497.071", "306926"),
  reviewed("p31|q1|x42.520|y449.640", "6585142"),
  reviewed("p35|q1|x49.835|y481.711", "4211398"),
  reviewed("p35|q2|x147.987|y481.711", "4618852"),
  reviewed("p36|q2|x115.277|y421.615", "4211104"),
  reviewed("p37|q1|x42.520|y383.151", "4211401"),
  reviewed("p37|q1|x42.520|y461.471", "4211398"),
  reviewed("p42|q1|x88.426|y448.271", "4211438"),
  reviewed("p42|q1|x88.426|y492.511", "243126"),
  reviewed("p42|q2|x22.677|y448.271", "4211398"),
  reviewed("p42|q2|x88.426|y413.391", "4565323"),
  reviewed("p44|q1|x101.684|y227.599", "663626"),
  reviewed("p44|q1|x23.093|y227.599", "306926"),
  reviewed("p44|q1|x53.989|y227.599", "371026"),
  reviewed("p12|q1|x108.829|y453.870", "302028"),
  reviewed("p13|q1|x83.311|y434.390", "302028"),
  reviewed("p13|q2|x446.227|y470.671", "303226"),
  reviewed("p14|q1|x31.551|y458.671", "303226"),
  reviewed("p15|q1|x49.471|y465.622", "383228"),
  reviewed("p17|q1|x46.591|y469.673", "395826"),
  reviewed("p18|q1|x84.580|y468.911", "303226"),
  reviewed("p22|q2|x109.082|y495.055", "6514469"),
  reviewed("p24|q3|x139.735|y493.255", "6514469"),
  reviewed("p25|q2|x132.188|y497.071", "306926"),
  reviewed("p26|q1|x82.340|y487.711", "306926"),
  reviewed("p28|q1|x100.373|y497.406", "306926"),
  reviewed("p28|q2|x142.740|y433.406", "4211399"),
  reviewed("p29|q1|x49.606|y462.971", "306926"),
  reviewed("p29|q6|x49.606|y498.931", "6514469"),
  reviewed("p37|q2|x138.502|y383.151", "371026"),
  reviewed("p38|q1|x84.580|y477.391", "379526"),
  reviewed("p38|q2|x22.677|y411.671", "306926"),
  reviewed("p38|q3|x84.580|y411.671", "303226"),
  reviewed("p41|q1|x116.828|y457.631", "306926"),
  reviewed("p41|q2|x42.520|y492.511", "243126"),
  reviewed("p42|q4|x51.351|y413.391", "306926"),
  reviewed("p46|q3|x69.265|y491.260", "6130007"),
]);

export const CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  calloutManifest: CURRENT_LEGACY_RECUT_PINS.currentManifest,
  inventoryManifest: Object.freeze({
    path: "output/inventory-thumbnails/manifest.json",
    schemaVersion: "lego.inventory-thumbnails/1",
    bytes: 269_834,
    digest: "sha256:aac36ddc934bd0860782f9158dc80865357d1490b23f74fce827291f09160491",
  }),
  elementResolution: Object.freeze({
    path: "output/part-identification/element-resolution.json",
    bytes: 34_042,
    digest: "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30",
  }),
  officialModel: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel,
  sourceArtifact: Object.freeze({
    bytes: 211_319,
    digest: "sha256:4be7bd77d386a7a656019affe9c995e77135080a7aa90df19e43a6f2167ab721",
    safeRelations: 86,
    safePieces: 147,
    residualRelations: 101,
    residualPieces: 173,
  }),
  review57: Object.freeze({
    path: "output/.codex-wip/broad-source-review/review-rows.json",
    bytes: 37_435,
    digest: "sha256:4f4fb6201f3ca7387b21f7882381cda9a8d09aaf81480326cdaf096dec0c29b1",
  }),
  review3: Object.freeze({
    path: "output/.codex-wip/broad-source-review/full-closure-drop-review-rows.json",
    schemaVersion: "lego.local-prefix50-visual-identity-review/1",
    bytes: 2_383,
    digest: "sha256:5ad4420d641f24d3df82c86ca10a4b8658f34680ec0c932e1d1487b5d2316407",
  }),
  reviewOutcomes: Object.freeze({
    path: "output/.codex-wip/broad-source-review/prefix50-semantic-review-outcomes.json",
    schemaVersion: PREFIX50_REVIEW_OUTCOMES_SCHEMA,
    bytes: 30_429,
    digest: "sha256:286696d9254e89d027eb4a244d176cb8aff064991655347865ce8d3d5f1012b7",
  }),
  expectedSourceIndex: CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex,
  expectedAccounting: Object.freeze({
    fullCalloutRows: 881,
    expectedPrintedSteps: 359,
    prefixLastStep: 50,
    safeRelations: 86,
    safePieces: 147,
    manualStaticRelations: 41,
    manualStaticPieces: 66,
    manual57Relations: 57,
    manual57Pieces: 102,
    manual3Relations: 3,
    manual3Pieces: 5,
    manualRelations: 101,
    manualPieces: 173,
    closureRelations: 187,
    closurePieces: 320,
    officialPrefixElements: 86,
    officialPrefixPieces: 320,
    closureAggregateElements: 86,
    closureAggregatePieces: 320,
    globalElementQuantityDiffs: 0,
    sourceCropsAuthenticated: 101,
    inventoryCropsAuthenticated: 101,
  }),
  expectedArtifact: Object.freeze({
    bytes: 92_426,
    digest: "sha256:1902af68a13cb629d9dbac1707c8c5c6998ec355cfcb6ef4dad2fc938f76155b",
  }),
});

export function assertPinnedJson(bytes, pin, label) {
  const artifact = jsonArtifactFromBytes(bytes, label);
  if (
    artifact.bytes.length !== pin.bytes ||
    artifact.digest !== pin.digest ||
    (pin.schemaVersion !== undefined && artifact.value?.schemaVersion !== pin.schemaVersion)
  ) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${artifact.bytes.length} bytes at ${artifact.digest}. Restore the reviewed input instead of substituting a current lookalike.`,
    );
  }
  return artifact.value;
}

export function exactCommitment(schemaVersion, rows) {
  const bytes = Buffer.from(`${JSON.stringify({ schemaVersion, rows })}\n`);
  return Object.freeze({ rows: rows.length, bytes: bytes.length, digest: sha256Digest(bytes) });
}

export function tally(rows) {
  return {
    relations: rows.length,
    pieces: rows.reduce((total, row) => total + row.quantity, 0),
  };
}

export function elementQuantityAggregate(rows, label) {
  const quantities = new Map();
  for (const [index, row] of rows.entries()) {
    if (
      typeof row?.elementId !== "string" ||
      !/^[1-9]\d*$/u.test(row.elementId) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1
    ) {
      throw new Error(
        `${label} row ${index} must have one numeric elementId and positive quantity.`,
      );
    }
    quantities.set(row.elementId, (quantities.get(row.elementId) ?? 0) + row.quantity);
  }
  return [...quantities.entries()]
    .map(([elementId, quantity]) => ({ elementId, quantity }))
    .sort((left, right) =>
      left.elementId < right.elementId ? -1 : left.elementId > right.elementId ? 1 : 0,
    );
}

export function assertGlobalPrefixConservation(semanticRows, officialSequenceRows) {
  const officialAggregate = elementQuantityAggregate(
    officialSequenceRows.map(({ elementId }) => ({ elementId, quantity: 1 })),
    "Official first-320 sequence",
  );
  const semanticAggregate = elementQuantityAggregate(semanticRows, "Semantic closure");
  const officialPieces = officialAggregate.reduce((total, row) => total + row.quantity, 0);
  const closurePieces = semanticAggregate.reduce((total, row) => total + row.quantity, 0);
  const officialByElement = new Map(officialAggregate.map((row) => [row.elementId, row.quantity]));
  const semanticByElement = new Map(semanticAggregate.map((row) => [row.elementId, row.quantity]));
  const diffs = [...new Set([...officialByElement.keys(), ...semanticByElement.keys()])]
    .sort()
    .filter((elementId) => officialByElement.get(elementId) !== semanticByElement.get(elementId));
  if (
    officialSequenceRows.length !== 320 ||
    semanticRows.length !== 187 ||
    officialAggregate.length !== 86 ||
    semanticAggregate.length !== 86 ||
    officialPieces !== 320 ||
    closurePieces !== 320 ||
    diffs.length !== 0
  ) {
    throw new Error(
      `Global prefix conservation requires 320 official pieces and 187 semantic relations over the same 86 elements; received ${officialSequenceRows.length}/${semanticRows.length} rows, ${officialAggregate.length}/${semanticAggregate.length} elements, ${officialPieces}/${closurePieces} pieces, and ${diffs.length} element-quantity diffs.`,
    );
  }
  return { officialAggregate, semanticAggregate, diffs };
}

export function assertExact(value, expected, label) {
  if (!isDeepStrictEqual(value, expected)) {
    throw new Error(
      `${label} drifted: expected ${JSON.stringify(expected)}, received ${JSON.stringify(value)}.`,
    );
  }
}
