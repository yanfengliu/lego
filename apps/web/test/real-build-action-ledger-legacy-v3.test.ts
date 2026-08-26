import { describe, expect, it } from "vitest";

import { encodeRealBuildActionLedger } from "../e2e/real-build-action-ledger";
import {
  admitCanonicalLegacyRealBuildActionLedgerV3Bytes,
  LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA,
} from "../e2e/real-build-action-ledger-legacy-v3";
import type { RealBuildActionLedger } from "../e2e/real-build-ledger";
import {
  realBuildLedgerPrefix,
  realBuildLedgerTestFixture,
} from "./real-build-ledger-test-fixture";

function legacyFixture(): Record<string, unknown> {
  const current = realBuildLedgerPrefix(realBuildLedgerTestFixture().ledger, 3);
  const { sourceArtReboundDigest: _sourceArtReboundDigest, ...legacy } = current;
  void _sourceArtReboundDigest;
  const steps = legacy.steps.map((step) => {
    const calloutKey = `p${step.pageNumber}|q1|x43.074|y486.271`;
    const action =
      step.action.kind === "place-callouts"
        ? {
            ...step.action,
            pieces: step.action.pieces.map((piece) => ({ ...piece, calloutKey })),
          }
        : step.action.kind === "multi-build-copy"
          ? {
              ...step.action,
              copies: step.action.copies.map((piece) => ({ ...piece, calloutKey })),
            }
          : step.action;
    return {
      ...step,
      callouts: step.callouts.map((callout) => ({ ...callout, calloutKey })),
      action,
    };
  });
  return { ...legacy, schemaVersion: LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA, steps };
}

function bytes(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`, "utf8");
}

describe("frozen legacy action-ledger /3 admission", () => {
  it("admits canonical /3 bytes without adding or upgrading current fields", () => {
    const legacy = legacyFixture();
    const admitted = admitCanonicalLegacyRealBuildActionLedgerV3Bytes({
      bytes: bytes(legacy),
      label: "Legacy fixture",
    });
    expect(admitted.schemaVersion).toBe(LEGACY_REAL_BUILD_ACTION_LEDGER_V3_SCHEMA);
    expect("sourceArtReboundDigest" in admitted).toBe(false);
  });

  it("keeps current /4 bytes and future confidence labels outside frozen inspection", () => {
    const current = realBuildLedgerPrefix(realBuildLedgerTestFixture().ledger, 3);
    expect(() =>
      admitCanonicalLegacyRealBuildActionLedgerV3Bytes({
        bytes: encodeRealBuildActionLedger(current),
        label: "Current fixture",
      }),
    ).toThrow(/current \/4 bytes belong to current admission/u);

    const legacy = legacyFixture();
    const step = (legacy.steps as RealBuildActionLedger["steps"])[0]!;
    if (step.action.kind !== "place-callouts") throw new TypeError("fixture step changed");
    const forged = {
      ...legacy,
      steps: [
        {
          ...step,
          action: {
            ...step.action,
            pieces: [{ ...step.action.pieces[0]!, identificationConfidence: "source-art-rebound" }],
          },
        },
        ...(legacy.steps as RealBuildActionLedger["steps"]).slice(1),
      ],
    };
    expect(() =>
      admitCanonicalLegacyRealBuildActionLedgerV3Bytes({
        bytes: bytes(forged),
        label: "Forged legacy fixture",
      }),
    ).toThrow(/outside the frozen legacy \/3 enum/u);
  });
});
