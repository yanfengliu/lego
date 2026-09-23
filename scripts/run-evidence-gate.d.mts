export const RUN_EVIDENCE_VARIABLE: "LEGO_RUN_EVIDENCE";

export const runEvidenceEnabled: boolean;

export interface RunEvidenceOptions {
  /** With the opt-in set, the suite or case still runs only when this holds; otherwise it skips, saying why. */
  readonly onlyIf?: boolean;
}

export function describeWithRunEvidence(
  reason: string,
  options?: RunEvidenceOptions,
): (title: string, factory: () => void) => void;

export function itWithRunEvidence(
  reason: string,
  options?: RunEvidenceOptions,
): (title: string, fn: () => unknown, timeout?: number) => void;
