import { describe, it } from "vitest";

/**
 * The one opt-in for tests that read ignored run evidence.
 *
 * `output/real-build/`, `output/official-model/` and the sample booklet are
 * ignored inputs. A clean clone has none of them, and a working checkout has
 * whatever its last run left there. Most of what reads them pins evidence from
 * the first-50 campaign the owner retired on 2026-09-22 (its code is archived on
 * branch archive/first50-campaign-wip-20260908), so the default gate reports
 * those suites as skipped, each naming its reason, and `LEGO_RUN_EVIDENCE=1`
 * runs them. Opted in, each suite treats its evidence as it did before the gate:
 * one that checked for its files first still skips, now saying so, and one that
 * demanded them still fails by name. Drifted evidence fails either way.
 * `scripts/run_evidence_gate.py` reads the same variable.
 */
export const RUN_EVIDENCE_VARIABLE = "LEGO_RUN_EVIDENCE";

function readOptIn() {
  const value = process.env[RUN_EVIDENCE_VARIABLE];
  if (value === undefined || value === "" || value === "0") return false;
  if (value === "1") return true;
  throw new Error(
    `${RUN_EVIDENCE_VARIABLE} is ${JSON.stringify(value)}; set it to 1 to run the tests that read ` +
      `ignored run evidence, or leave it unset (or 0) to skip them.`,
  );
}

export const runEvidenceEnabled = readOptIn();

function skipNote(reason) {
  return runEvidenceEnabled
    ? `skipped because its evidence is absent: ${reason}`
    : `skipped without ${RUN_EVIDENCE_VARIABLE}=1: ${reason}`;
}

/**
 * Returns a `describe` for suites that read ignored run evidence.
 *
 * The suite runs only with the opt-in set and `onlyIf` holding. Otherwise its
 * body is never called, not even to collect its tests, because some bodies read
 * evidence while collecting; the suite is reported as one skipped test that
 * names the reason.
 */
export function describeWithRunEvidence(reason, { onlyIf = true } = {}) {
  return (title, factory) => {
    if (runEvidenceEnabled && onlyIf) {
      describe(title, factory);
      return;
    }
    describe(title, () => {
      it.skip(skipNote(reason), () => {});
    });
  };
}

/** Returns an `it` for single cases that read ignored run evidence beside cases that run everywhere. */
export function itWithRunEvidence(reason, { onlyIf = true } = {}) {
  return (title, fn, timeout) => {
    if (runEvidenceEnabled && onlyIf) {
      it(title, fn, timeout);
      return;
    }
    it.skip(`${title} (${skipNote(reason)})`, fn);
  };
}
