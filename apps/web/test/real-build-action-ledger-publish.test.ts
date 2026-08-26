import { describe, expect, it } from "vitest";

import {
  parseRealBuildActionLedgerRequestedLastStep,
  requirePublishableRealBuildActionLedger,
  requireRealBuildActionLedgerCoveragePrefix,
  requireRealBuildActionLedgerRequestedLastStep,
} from "../e2e/real-build-action-ledger-compile";
import { encodeRealBuildActionLedger } from "../e2e/real-build-action-ledger";
import {
  REAL_BUILD_ACTION_LEDGER_GENERATOR,
  REAL_BUILD_ACTION_LEDGER_SCHEMA,
  type RealBuildActionLedger,
} from "../e2e/real-build-ledger";
import type { StepFailure } from "../e2e/real-build-safety";

const DIGEST = `sha256:${"0".repeat(64)}`;

function emittedPrefix(
  requestedLastStep = 50,
  alignedThroughStep = requestedLastStep,
): RealBuildActionLedger {
  return {
    schemaVersion: REAL_BUILD_ACTION_LEDGER_SCHEMA,
    pdfDigest: DIGEST,
    officialModelDigest: DIGEST,
    coverageDigest: DIGEST,
    calloutManifestDigest: DIGEST,
    sourceArtReboundDigest: DIGEST,
    builderCalibrationDigest: DIGEST,
    transitionClassificationsDigest: DIGEST,
    steps: Array.from({ length: alignedThroughStep }, (_, index) => ({
      stepNumber: index + 1,
      pageNumber: index + 1,
      panelEvidenceDigest: DIGEST,
      callouts: [],
      action: {
        kind: "transition" as const,
        transition: "rotation" as const,
        classificationEvidenceDigest: DIGEST,
      },
    })),
    provenance: {
      generator: REAL_BUILD_ACTION_LEDGER_GENERATOR,
      authenticated: false,
      expectedPrintedSteps: 359,
      requestedLastStep,
      alignedThroughStep,
      stopReason: "test artifact retains its complete corroborated prefix",
      directPieceCount: 0,
      transitionStepCount: alignedThroughStep,
      refusals: [],
    },
  };
}

function publishable(
  overrides: Partial<Parameters<typeof requirePublishableRealBuildActionLedger>[0]> = {},
): Parameters<typeof requirePublishableRealBuildActionLedger>[0] {
  const emitted = overrides.emitted ?? emittedPrefix();
  return {
    expectedPrintedSteps: 359,
    requestedLastStep: 50,
    validatedThroughStep: 50,
    validationFailures: [],
    ...overrides,
    emitted,
    encoded: overrides.encoded ?? encodeRealBuildActionLedger(emitted),
  };
}

describe("action-ledger publisher write barrier", () => {
  it("accepts only a fully validated assembled prefix", () => {
    expect(() => requirePublishableRealBuildActionLedger(publishable())).not.toThrow();
  });

  it("retains an honest nonempty aligned prefix without claiming the rest of its request", () => {
    expect(() =>
      requirePublishableRealBuildActionLedger(
        publishable({ emitted: emittedPrefix(50, 26), validatedThroughStep: 26 }),
      ),
    ).not.toThrow();
  });

  it("rejects legacy /3 bytes and any action row above the artifact request", () => {
    const legacy = {
      ...emittedPrefix(),
      schemaVersion: "lego.real-build-action-ledger/3",
    } as unknown as RealBuildActionLedger;
    expect(() => requirePublishableRealBuildActionLedger(publishable({ emitted: legacy }))).toThrow(
      /current closed \/4 prefix contract.*lego\.real-build-action-ledger\/4/su,
    );

    const base = emittedPrefix();
    const tail = {
      ...base,
      steps: [
        ...base.steps,
        {
          stepNumber: 51,
          pageNumber: 51,
          panelEvidenceDigest: DIGEST,
          callouts: [],
          action: {
            kind: "transition" as const,
            transition: "rotation" as const,
            classificationEvidenceDigest: DIGEST,
          },
        },
      ],
      provenance: {
        ...base.provenance,
        alignedThroughStep: 51,
        transitionStepCount: 51,
      },
    };
    expect(() => requirePublishableRealBuildActionLedger(publishable({ emitted: tail }))).toThrow(
      /closed current \/4 schema.*alignedThroughStep must be an integer from 1 through 50/su,
    );
  });

  it("cannot republish broader, duplicate-key, or noncanonical raw bytes behind a clean object", () => {
    const emitted = emittedPrefix();
    const canonical = encodeRealBuildActionLedger(emitted).toString("utf8");
    const duplicateSchema = canonical.replace(
      ` "schemaVersion": "${REAL_BUILD_ACTION_LEDGER_SCHEMA}",`,
      ` "schemaVersion": "${REAL_BUILD_ACTION_LEDGER_SCHEMA}",\n` +
        ` "schemaVersion": "${REAL_BUILD_ACTION_LEDGER_SCHEMA}",`,
    );
    const exponentRequest = canonical.replace(
      `  "requestedLastStep": 50,`,
      `  "requestedLastStep": 5e1,`,
    );
    const broader = canonical.replace(/\n\}\n$/u, `,\n "tailActions": []\n}\n`);

    for (const encoded of [duplicateSchema, exponentRequest, broader]) {
      expect(() =>
        requirePublishableRealBuildActionLedger(
          publishable({ emitted, encoded: Buffer.from(encoded, "utf8") }),
        ),
      ).toThrow(/exact canonical re-encoding/u);
    }
  });

  it("rejects an honest empty prefix instead of pretending it validated step 1", () => {
    expect(() =>
      requirePublishableRealBuildActionLedger(publishable({ validatedThroughStep: 0 })),
    ).toThrow(/empty action ledger.*1\.\.50.*no assembled prefix.*no ledger file was written/su);
  });

  it("rejects a validated row above the requested prefix", () => {
    expect(() =>
      requirePublishableRealBuildActionLedger(publishable({ validatedThroughStep: 51 })),
    ).toThrow(/validated prefix 51.*outside requested printed steps 1\.\.50/su);
  });

  it("rejects an invalid requested prefix before interpreting validation state", () => {
    expect(() =>
      requirePublishableRealBuildActionLedger(
        publishable({ requestedLastStep: 0, validatedThroughStep: 0 }),
      ),
    ).toThrow(/invalid requestedLastStep 0.*from 1 through 50/su);
  });

  it("rejects before write with bounded categories instead of raw failure text", () => {
    const hostile = "raw-attacker-diagnostic-".repeat(10_000);
    const validationFailures = Array.from({ length: 12 }, (_, index): StepFailure => ({
      code: `category-${index}` as StepFailure["code"],
      stage: "input",
      message: hostile,
    }));
    let caught: unknown;
    try {
      requirePublishableRealBuildActionLedger(publishable({ validationFailures }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    const message = (caught as Error).message;
    expect(message).toContain("Refusing to publish");
    expect(message).toContain("through its complete assembled prefix ending at printed step 50");
    expect(message).toContain("4 more categories omitted");
    expect(message).toContain("no ledger file was written");
    expect(message).not.toContain(hostile);
    expect(message.length).toBeLessThan(1_500);
  });
});

describe("action-ledger requested prefix environment", () => {
  it.each([
    ["1", 1],
    ["50", 50],
  ])("parses %s as %i", (value, expected) => {
    expect(parseRealBuildActionLedgerRequestedLastStep(value)).toBe(expected);
  });

  it("requires the publisher prefix instead of defaulting to the full booklet", () => {
    expect(() => parseRealBuildActionLedgerRequestedLastStep(undefined)).toThrow(
      /must be set explicitly.*no implicit full-booklet prefix is selected/su,
    );
  });

  it.each(["", "0", "51", "359", "360", "1.5", "1e2", " 50", "50 ", "x".repeat(1_000)])(
    "rejects non-canonical or out-of-range value %s with bounded output",
    (value) => {
      let caught: unknown;
      try {
        parseRealBuildActionLedgerRequestedLastStep(value);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TypeError);
      expect((caught as Error).message).toContain("from 1 through 50");
      expect((caught as Error).message.length).toBeLessThan(300);
    },
  );

  it.each([0, 360, 1.5, Number.NaN])("rejects invalid programmatic compiler prefix %s", (value) => {
    expect(() => requireRealBuildActionLedgerRequestedLastStep(value)).toThrow(
      /compiler requestedLastStep must be a safe integer from 1 through 50/u,
    );
  });

  it("requires retained identity coverage to match the requested prefix exactly", () => {
    expect(() => requireRealBuildActionLedgerCoveragePrefix(50, 50)).not.toThrow();
    expect(() => requireRealBuildActionLedgerCoveragePrefix(359, 50)).toThrow(
      /coverage was compiled through step 359.*--last-step 50.*full 359-step callout manifest.*source\/index/su,
    );
  });
});
