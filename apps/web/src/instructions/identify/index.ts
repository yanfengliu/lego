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
export { scoreAgainstTruth, type TruthIdentity, type TruthScore } from "./truth-score";
export type {
  CalloutFlag,
  CalloutIdentification,
  Candidate,
  IdentifyParameters,
  IdentifyResult,
  IdentifySummary,
  InventoryElement,
  Reconciliation,
  Rect,
  Residual,
  StepTotals,
} from "./types";
export { IDENTIFY_SCHEMA_VERSION } from "./types";
