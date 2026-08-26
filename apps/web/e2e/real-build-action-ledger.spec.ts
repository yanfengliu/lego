import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { sha256Digest } from "./real-build-artifacts";
import {
  compileRealBuildActionLedger,
  parseRealBuildActionLedgerRequestedLastStep,
  REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS,
  requirePublishableRealBuildActionLedger,
} from "./real-build-action-ledger-compile";
import { formatActionLedgerRefusalOutput } from "./real-build-action-ledger";
import { isTrustedIdentificationConfidence } from "./real-build-identification-trust";
import { pieceEvidenceDigest } from "./real-build-ledger";
import { ACTION_LEDGER_PATH } from "./real-build-input-files";
import { hasSampleBooklet } from "./sample-booklet";

/**
 * Publishes `output/real-build/action-ledger.json`.
 *
 * Opt-in, because it reads the 70MiB uncommitted booklet, the official model,
 * and the identification closure, and writes a real-build input. The contract
 * that consumes the file is checked in Vitest against the same functions the
 * real-build probe uses, so the gate does not depend on this spec having run.
 *
 * Deliberately not `LEGO_REAL_BUILD_ACTION_LEDGER`: that name already redirects
 * the *path* this input is read from, and reusing a path variable as a flag
 * once wrote a bundle to a file called `1` in the repository root.
 */

const PUBLISH = process.env.LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER === "1";

test("publishes the booklet's action ledger", async () => {
  test.setTimeout(900_000);
  test.skip(
    !PUBLISH,
    `set LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER=1 to republish ${ACTION_LEDGER_PATH}`,
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const requestedLastStep = parseRealBuildActionLedgerRequestedLastStep(
    process.env.LEGO_REAL_BUILD_LAST_STEP,
  );
  const compiled = await compileRealBuildActionLedger({ requestedLastStep });
  requirePublishableRealBuildActionLedger(compiled);
  const { ledger } = compiled.assembled;

  // The ledger's own claims are the publisher's responsibility and are checked
  // here. Everything the validator reports beyond them is missing *external*
  // evidence, which this spec prints rather than hides.
  expect(ledger.steps.map(({ stepNumber }) => stepNumber)).toEqual(
    Array.from({ length: compiled.assembled.alignedThroughStep }, (_, index) => index + 1),
  );
  for (const step of ledger.steps) {
    if (step.action.kind !== "place-callouts") continue;
    const boundRefs = new Set(step.callouts.flatMap(({ physicalBrickRefs }) => physicalBrickRefs));
    expect(new Set(step.action.pieces.map(({ brickRef }) => brickRef))).toEqual(boundRefs);
    for (const piece of step.action.pieces) {
      const { evidenceDigest, ...content } = piece;
      expect(evidenceDigest).toBe(
        pieceEvidenceDigest({
          pdfDigest: ledger.pdfDigest,
          panelEvidenceDigest: step.panelEvidenceDigest,
          officialModelDigest: ledger.officialModelDigest,
          coverageDigest: ledger.coverageDigest,
          calloutManifestDigest: ledger.calloutManifestDigest,
          builderCalibrationDigest: ledger.builderCalibrationDigest,
          stepNumber: step.stepNumber,
          pageNumber: step.pageNumber,
          piece: content,
        }),
      );
      // Membership in the one definition, never a literal. This line read
      // `toBe("vision-kept")` from the day it was written, when `directPiece`
      // hard-coded that same string into every piece — so it asserted a constant
      // against itself and tested nothing. Commit 0452f75 replaced the literal
      // with the claim's own published confidence and fixed six sites to read
      // `TRUSTED_IDENTIFICATION_CONFIDENCES`; this spec was the seventh and was
      // missed, which turned a tautology into a gate demanding one particular
      // trust source. Nothing untrusted can reach here anyway: the cut refuses
      // it and `requireTrustedIdentificationConfidence` throws, so the honest
      // assertion is the invariant the line was written to express.
      expect(isTrustedIdentificationConfidence(piece.identificationConfidence)).toBe(true);
      expect(piece.transform).toBeNull();
    }
  }

  const written = writeContainedRegularFileAtomic(
    process.cwd(),
    ACTION_LEDGER_PATH,
    compiled.encoded,
    { label: `Action ledger ${ACTION_LEDGER_PATH}`, replace: true },
  );
  expect(written.replaceAll("\\", "/").endsWith(ACTION_LEDGER_PATH)).toBe(true);
  expect(readFileSync(written).equals(compiled.encoded)).toBe(true);
  expect(sha256Digest(readFileSync(written))).toBe(compiled.encodedDigest);

  const byCode = new Map<string, number>();
  for (const failure of compiled.validationFailures) {
    byCode.set(failure.code, (byCode.get(failure.code) ?? 0) + 1);
  }
  // Which mechanism actually carried the build. The two trusted confidences are
  // kept as separate values precisely so this can be said afterwards, and a
  // publisher that never prints the split throws that away.
  const byConfidence = new Map<string, number>();
  for (const step of ledger.steps) {
    if (step.action.kind !== "place-callouts") continue;
    for (const { identificationConfidence } of step.action.pieces) {
      byConfidence.set(
        identificationConfidence,
        (byConfidence.get(identificationConfidence) ?? 0) + 1,
      );
    }
  }
  process.stdout.write(
    `${written.replaceAll("\\", "/")}: ${ledger.steps.length} of ` +
      `${compiled.requestedLastStep} requested printed steps within the ` +
      `${REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS}-step source/index contract, ` +
      `${compiled.assembled.directPieceCount} direct piece identities ` +
      `[${[...byConfidence].map(([name, count]) => `${name}=${count}`).join(", ") || "none"}], ` +
      `${compiled.assembled.transitionStepCount} transitions, ` +
      `${compiled.assembled.refusals.length} refusals; file digest ${compiled.encodedDigest}\n` +
      `  cursor result: ${compiled.assembled.stopReason}\n` +
      `  validated through printed step ${compiled.validatedThroughStep}: ` +
      `${compiled.validationFailures.length} remaining evidence failures ` +
      `[${[...byCode].map(([code, count]) => `${code}=${count}`).join(", ") || "none"}]\n`,
  );
  process.stdout.write(formatActionLedgerRefusalOutput(compiled.assembled.refusals));
});
