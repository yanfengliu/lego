import { CURRENT_PREFIX50_ACTION_PREPARATION_PINS } from "./part-identification-prefix50-action-preparation-source.mjs";
import { CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS } from "./part-identification-step31-32-order-reconciliation-source.mjs";

export const PREFIX50_STRUCTURAL_EVENTS_SCHEMA =
  "lego.part-identification-prefix50-structural-events/1";
export const PREFIX50_STRUCTURAL_MEMBER_COMMITMENT_SCHEMA =
  "lego.part-identification-prefix50-structural-member-commitment/1";
export const PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH =
  "output/real-build/prefix50-structural-events.json";
export const PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES = 256 * 1024;

export const PREFIX50_STRUCTURAL_EVENTS_AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  officialBuilderStructure: true,
  exactFirst50ActionBoundary: true,
  transitionClassificationCorroborativeOnly: true,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  connectionAuthority: false,
  actionAuthority: false,
  placement: false,
  documentLegality: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});

export const CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  actionPreparation: Object.freeze({
    path: "output/real-build/action-preparation.json",
    schemaVersion: "lego.real-build-action-preparation/1",
    ...CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact,
  }),
  officialModel: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel,
  officialPhaseDigest: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialPhaseDigest,
  officialStructuralDigest:
    "sha256:600367e0966ae2f522f9207a4e608572eba61bd12cd971ed35c51d6b0e308a8c",
  transitionClassifications: Object.freeze({
    path: "output/real-build/transition-classifications.json",
    schemaVersion: "lego.transition-classifications/1",
    bytes: 34_784,
    digest: "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
  }),
  expectedArtifact: Object.freeze({
    bytes: 7_292,
    digest: "sha256:cdb563b81f89aa9110cc70cc392f7415616aeb3e534ee907547879f8ec82c03e",
  }),
});
