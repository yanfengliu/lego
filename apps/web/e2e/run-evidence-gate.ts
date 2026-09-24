import { RUN_EVIDENCE_VARIABLE, runEvidenceEnabled } from "../../../scripts/run-evidence-gate.mjs";

/**
 * The Playwright-side counterpart of `scripts/run-evidence-gate.mjs`.
 *
 * A Playwright spec that reads an ignored input — the sample booklet at
 * `recipes/6651557.pdf`, or a retained `output/…` artifact — must not decide
 * whether to run by checking that input's existence directly: a clean clone
 * lacks it, a working checkout has whatever its last run left there, and
 * either way the default gate's pass/fail would depend on the machine it ran
 * on rather than the code. `LEGO_RUN_EVIDENCE=1` is the one opt-in for these
 * specs, same as it is for the Vitest suites in `scripts/run-evidence-gate.mjs`.
 *
 * Some specs already tolerated the input's absence gracefully before this
 * gate existed (`hasSampleBooklet`'s own contract: "every caller must
 * tolerate its absence"); those pass their existence flag as `onlyIf` and
 * keep skipping, now saying so, once opted in. A spec that instead demanded
 * its input and threw when absent keeps doing exactly that — call this with
 * no `onlyIf` and let the read fail loudly.
 */
export { RUN_EVIDENCE_VARIABLE, runEvidenceEnabled };

export interface RunEvidenceOptions {
  /** With the opt-in set, the test still runs only when this holds; otherwise it skips, saying why. */
  readonly onlyIf?: boolean;
}

function skipNote(reason: string): string {
  return runEvidenceEnabled
    ? `skipped because its evidence is absent: ${reason}`
    : `skipped without ${RUN_EVIDENCE_VARIABLE}=1: ${reason}`;
}

/** The minimal shape of Playwright's `test`, so callers pass their own `test` import. */
export interface SkippableTest {
  skip(condition: boolean, description?: string): void;
}

/**
 * Skips a Playwright test unless `LEGO_RUN_EVIDENCE=1` is set (and `onlyIf`
 * holds), printing the reason either way. Call this as the test body's first
 * line, exactly where a bare `test.skip(!hasSampleBooklet, "no sample booklet")`
 * used to sit.
 */
export function skipWithoutRunEvidence(
  test: SkippableTest,
  reason: string,
  { onlyIf = true }: RunEvidenceOptions = {},
): void {
  test.skip(!(runEvidenceEnabled && onlyIf), skipNote(reason));
}
