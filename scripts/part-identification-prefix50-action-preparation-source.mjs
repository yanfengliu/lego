import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import { CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS } from "./part-identification-prefix50-semantic-closure-source.mjs";
import { CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS } from "./part-identification-step31-32-order-reconciliation-source.mjs";

export const PREFIX50_ACTION_PREPARATION_SCHEMA = "lego.real-build-action-preparation/1";
export const PREFIX50_ACTION_PREPARATION_OUTPUT_PATH = "output/real-build/action-preparation.json";
export const PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export const PREFIX50_ACTION_PREPARATION_AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  semanticIdentity: true,
  exactOccurrenceIdentity: false,
  officialBuilderOrder: true,
  actionPreparation: true,
  productionActionLedger: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  assignmentAuthority: false,
  actionAuthority: false,
  placement: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});

export const PREFIX50_RECONCILED_PHASES_BY_STEP = Object.freeze({
  31: Object.freeze([50, 51, 52]),
  32: Object.freeze([49, 53, 54]),
});

export const PREFIX50_REPEAT_ROWS = Object.freeze([
  Object.freeze({
    identity: "p32|q2|x511.589|y390.747",
    pageNumber: 32,
    stepNumber: 28,
    quantity: 2,
    evidenceKind: "subassembly-repeat",
    cropDigest: "sha256:c4db5f73f35f21c0a315cc57875abea713eae91d3217f60f878c81e673fc18c6",
    masterPhaseSequences: Object.freeze([39]),
    copyPhaseSequences: Object.freeze([40]),
  }),
  Object.freeze({
    identity: "p33|q4|x274.854|y340.077",
    pageNumber: 33,
    stepNumber: 29,
    quantity: 4,
    evidenceKind: "subassembly-repeat",
    cropDigest: "sha256:6d8ef1b06ee10a333c566a9bd27da5271297d24e648522c2b91aba0ae7ce4db5",
    masterPhaseSequences: Object.freeze([41, 42]),
    copyPhaseSequences: Object.freeze([43, 44, 45]),
  }),
]);

export const CURRENT_PREFIX50_ACTION_PREPARATION_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  semanticCoverage: Object.freeze({
    path: "output/real-build/catalog-coverage.json",
    schemaVersion: "lego.real-build-catalog-coverage/4",
    bytes: 588_467,
    digest: "sha256:861d08a28dac94619e8c541e928d7803b4b6cab9fe9fa12da9f166fc0e46444d",
  }),
  semanticClosure: Object.freeze({
    path: "output/part-identification/prefix50-semantic-closure.json",
    schemaVersion: "lego.part-identification-prefix50-semantic-closure/1",
    ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact,
  }),
  calloutManifest: CURRENT_LEGACY_RECUT_PINS.currentManifest,
  officialModel: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel,
  officialPhaseDigest: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialPhaseDigest,
  orderReconciliation: Object.freeze({
    schemaVersion: "lego.part-identification-step31-32-order-reconciliation/2",
    ...CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedArtifact,
  }),
  expectedSourceIndex: Object.freeze({
    expectedPrintedSteps: 359,
    lastIndexedStep: 358,
    calloutRows: 881,
    partArtRows: 859,
    prefixLastStep: 50,
    prefixPartArtRows: 187,
    prefixPartArtPieces: 320,
    suffixPartArtRows: 672,
    suffixStepsReconstructed: false,
  }),
  expectedAccounting: Object.freeze({
    printedStepRows: 50,
    partBearingStepRows: 49,
    zeroPieceStepRows: 1,
    calloutRows: 187,
    physicalIdentities: 320,
    builderPhases: 95,
    directPhases: 91,
    copyPhases: 4,
    directIdentities: 309,
    copyIdentities: 11,
    repeatRows: 2,
  }),
  expectedArtifact: Object.freeze({
    bytes: 317_152,
    digest: "sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6",
  }),
});
