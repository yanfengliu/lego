/**
 * Deterministic closed-set identification of a booklet's part callouts.
 *
 * `identifyBooklet(pdfBytes, options)` is the entry point; everything it returns
 * is described in `types.ts`. It runs under Node and needs no model.
 */
export {
  DEFAULT_PARAMETERS,
  identifyBooklet,
  identifyCollected,
  type IdentifyOptions,
} from "./identify-booklet";
export { IDENTIFY_LIMITS } from "./limits";
export { scoreAgainstTruth, type TruthIdentity, type TruthScore } from "./truth-score";
export type {
  AssignmentSummary,
  CalloutFlag,
  CalloutIdentification,
  Candidate,
  ForcedByCapacity,
  IdentifyParameters,
  IdentifyResult,
  IdentifySummary,
  InventoryElement,
  Reconciliation,
  Rect,
  Residual,
  StepTotals,
  TextCounts,
  UnpairedElementId,
} from "./types";
export { IDENTIFY_SCHEMA_VERSION } from "./types";
