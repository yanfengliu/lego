import { describe, expect, it } from "vitest";

import { diagnoseStep13Alignment } from "../e2e/real-build-action-ledger-alignment";

const SOURCE_DIGEST = `sha256:${"a".repeat(64)}`;
const PHASE_DIGEST = `sha256:${"b".repeat(64)}`;
const OWN_CROP_DIGEST = "sha256:de08a478afe862014eba5d5656fbc14ce3a7146c03b8f2b15f85d4a88ba07d8e";
const LEAD_CROP_DIGEST = "sha256:83a213b9ff8d5e0f2a721dc9415288c8c65088f7394fd52bdb24d557e5a34c08";

function phase(sequence: number, designs: readonly string[], subBuildPath: readonly string[] = []) {
  return {
    sequence,
    phaseId: `phase-${sequence}`,
    subBuildPath: [...subBuildPath],
    sourceIdentityCount: designs.length,
    identities: designs.map((designId, index) => ({
      brickRef: `brick-${sequence}-${index}`,
      designId,
    })),
  };
}

function inputFixture() {
  return {
    schemaVersion: "lego.step-13-alignment-input/1",
    builderSourceDigest: SOURCE_DIGEST,
    builderPhaseDigest: PHASE_DIGEST,
    phaseWindowStartIdentityCursor: 25,
    anchor: { afterStepNumber: 12, identityCursor: 26 },
    phases: [
      phase(14, ["3795"]),
      phase(15, ["3958"]),
      phase(16, ["3460"]),
      phase(17, ["91988"]),
      phase(18, ["77844", "3032"]),
      phase(19, ["3023"]),
    ],
    steps: [
      {
        stepNumber: 12,
        callouts: [
          { calloutKey: "step12-3795", quantity: 1, claimedDesignId: "3795", identification: null },
        ],
      },
      {
        stepNumber: 13,
        callouts: [
          {
            calloutKey: "step13-41539",
            quantity: 1,
            claimedDesignId: "41539",
            identification: {
              ownCropDigest: OWN_CROP_DIGEST,
              claimedElementId: "4166619",
              inheritedJudgement: {
                judgedCropDigest: LEAD_CROP_DIGEST,
                elementId: "4166619",
                designId: "41539",
                verdict: "same",
              },
              candidates: [
                { elementId: "395826", designId: "3958", distance: 0.02892358597981141 },
                { elementId: "4166619", designId: "41539", distance: 0.03986153076112695 },
              ],
              studCore: {
                observedCount: 36,
                expectedByDesign: [
                  { designId: "3958", count: 36 },
                  { designId: "41539", count: 64 },
                ],
              },
            },
          },
          { calloutKey: "step13-3460", quantity: 1, claimedDesignId: "3460", identification: null },
          {
            calloutKey: "step13-91988",
            quantity: 1,
            claimedDesignId: "91988",
            identification: null,
          },
        ],
      },
      {
        stepNumber: 14,
        callouts: [
          {
            calloutKey: "step14-77844",
            quantity: 1,
            claimedDesignId: "77844",
            identification: null,
          },
          { calloutKey: "step14-3023", quantity: 1, claimedDesignId: "3023", identification: null },
          { calloutKey: "step14-3032", quantity: 1, claimedDesignId: "3032", identification: null },
        ],
      },
    ],
  };
}

interface MutableIdentificationFixture {
  ownCropDigest: string;
  claimedElementId: string;
  inheritedJudgement: {
    judgedCropDigest: string;
    elementId: string;
    designId: string;
    verdict: string;
  } | null;
  candidates: { elementId: string; designId: string; distance: number }[];
  studCore: {
    observedCount: number;
    expectedByDesign: { designId: string; count: number }[];
  } | null;
}

function step13Identification(
  input: ReturnType<typeof inputFixture>,
): MutableIdentificationFixture {
  return input.steps[1]!.callouts[0]!.identification as MutableIdentificationFixture;
}

describe("step-13 action-ledger alignment diagnostic", () => {
  it("indicates the member-local 6x6 identification without authenticating source or admission", () => {
    const result = diagnoseStep13Alignment(inputFixture());

    expect(result).toMatchObject({
      authority: { status: "absent", authenticated: false, admissionAuthority: false },
      source: { verification: "unbound-detached-input" },
      outcome: "misidentification-indicated-unverified",
      boundaryWitness: {
        status: "whole-phase-partition",
        ranges: [
          { stepNumber: 12, identityCursorStart: 25, identityCursorEnd: 26, designs: ["3795"] },
          {
            stepNumber: 13,
            identityCursorStart: 26,
            identityCursorEnd: 29,
            designs: ["3958", "3460", "91988"],
          },
          {
            stepNumber: 14,
            identityCursorStart: 29,
            identityCursorEnd: 32,
            designs: ["77844", "3032", "3023"],
          },
        ],
      },
      identificationWitness: {
        status: "supports-builder-design",
        mismatch: {
          stepNumber: 13,
          claimedDesignId: "41539",
          builderDesignId: "3958",
          ownCropDigest: OWN_CROP_DIGEST,
          inheritedJudgedCropDigest: LEAD_CROP_DIGEST,
          candidatePreferredDesignId: "3958",
          studCorePreferredDesignId: "3958",
          builderSupportSignals: [
            "member-local-candidate-distance",
            "member-local-stud-core-count",
          ],
          claimedSupportSignals: [],
        },
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.boundaryWitness.ranges)).toBe(true);
  });

  it("requires two member-local signals and never treats the inherited lead verdict as support", () => {
    const onlyInherited = inputFixture();
    step13Identification(onlyInherited).candidates = [];
    step13Identification(onlyInherited).studCore = null;
    expect(diagnoseStep13Alignment(onlyInherited)).toMatchObject({
      outcome: "insufficient-evidence",
      identificationWitness: {
        status: "insufficient",
        mismatch: { builderSupportSignals: [], claimedSupportSignals: [] },
      },
    });

    const oneSignal = inputFixture();
    step13Identification(oneSignal).studCore = null;
    expect(diagnoseStep13Alignment(oneSignal)).toMatchObject({
      outcome: "insufficient-evidence",
      identificationWitness: {
        status: "insufficient",
        mismatch: { builderSupportSignals: ["member-local-candidate-distance"] },
      },
    });

    const conflicting = inputFixture();
    step13Identification(conflicting).candidates.reverse();
    step13Identification(conflicting).candidates[0]!.distance = 0.02;
    expect(diagnoseStep13Alignment(conflicting)).toMatchObject({
      outcome: "ambiguous",
      identificationWitness: { status: "conflicting" },
    });
  });

  it("reports caller-asserted nested boundaries only as unverified indications", () => {
    for (const [subBuildPath, expectedStatus, expectedOutcome] of [
      [["nested-builder"], "nested-phase-split-required", "boundary-indicated-unverified"],
      [[], "non-nested-phase-split-required", "insufficient-evidence"],
    ] as const) {
      const input = inputFixture();
      input.phases = [
        phase(14, ["3795"]),
        phase(15, ["a", "b", "c", "d"], subBuildPath),
        phase(16, ["e", "f"]),
      ];
      expect(diagnoseStep13Alignment(input)).toMatchObject({
        source: { verification: "unbound-detached-input" },
        outcome: expectedOutcome,
        boundaryWitness: {
          status: expectedStatus,
          splitConflict: { stepNumber: 13, phaseSequence: 15 },
        },
        identificationWitness: { status: "not-evaluated" },
      });
    }
  });

  it("refuses cursor drift, phase splitting, duplicate phases, and reordered steps", () => {
    const cases: readonly [string, (input: ReturnType<typeof inputFixture>) => void, RegExp][] = [
      ["cursor", (input) => void (input.anchor.identityCursor = 25), /identityCursor must be 26/u],
      ["sequence", (input) => void (input.phases[1]!.sequence = 16), /contiguous source order/u],
      ["phase id", (input) => void (input.phases[1]!.phaseId = "phase-14"), /repeat phaseId/u],
      ["split", (input) => void (input.phases[1]!.sourceIdentityCount = 2), /split phase/u],
      ["steps", (input) => void (input.steps[1]!.stepNumber = 14), /must be printed step 13/u],
    ];
    for (const [, mutate, expected] of cases) {
      const input = inputFixture();
      mutate(input);
      expect(() => diagnoseStep13Alignment(input)).toThrow(expected);
    }
  });

  it("refuses sparse, accessor, extra, symbol, custom-prototype, and proxied structures", () => {
    const cases: readonly [string, (input: ReturnType<typeof inputFixture>) => unknown, RegExp][] =
      [
        [
          "sparse",
          (input) => void delete input.steps[1],
          /enumerable own data property|dense indices/u,
        ],
        [
          "accessor",
          (input) => void Object.defineProperty(input.anchor, "identityCursor", { get: () => 26 }),
          /enumerable own data property/u,
        ],
        [
          "extra",
          (input) => void Object.defineProperty(input.anchor, "extra", { value: true }),
          /unsupported own field/u,
        ],
        [
          "symbol",
          (input) => void Object.defineProperty(input.steps, Symbol("hidden"), { value: true }),
          /contains a symbol property/u,
        ],
        [
          "own map",
          (input) => void Object.defineProperty(input.steps, "map", { value: () => [] }),
          /unsupported own field "map"/u,
        ],
        [
          "prototype",
          (input) => void Object.setPrototypeOf(input.steps, {}),
          /has a custom prototype/u,
        ],
        ["proxy", (input) => new Proxy(input, {}), /is a Proxy/u],
      ];
    for (const [, mutate, expected] of cases) {
      const input = inputFixture();
      const supplied = mutate(input) ?? input;
      expect(() => diagnoseStep13Alignment(supplied)).toThrow(expected);
    }
  });

  it("describes hostile scalar values without invoking their coercion hooks", () => {
    const input = inputFixture();
    let coercions = 0;
    input.anchor.identityCursor = {
      [Symbol.toPrimitive]() {
        coercions += 1;
        throw new Error("must not execute");
      },
    } as unknown as number;

    expect(() => diagnoseStep13Alignment(input)).toThrow(
      /anchor identityCursor must be 26; received <object>/u,
    );
    expect(coercions).toBe(0);
  });

  it("does not turn a sole step-12 or step-14 mismatch into a step-13 diagnosis", () => {
    for (const stepIndex of [0, 2] as const) {
      const input = inputFixture();
      input.steps[1]!.callouts[0]!.claimedDesignId = "3958";
      input.steps[stepIndex]!.callouts[0]!.claimedDesignId = "wrong-design";
      expect(diagnoseStep13Alignment(input)).toMatchObject({
        outcome: "insufficient-evidence",
        identificationWitness: { status: "insufficient", mismatch: null },
      });
    }
  });

  it("rejects a supposedly inherited judgement that names the member crop itself", () => {
    const input = inputFixture();
    step13Identification(input).inheritedJudgement!.judgedCropDigest = OWN_CROP_DIGEST;
    expect(() => diagnoseStep13Alignment(input)).toThrow(
      /judgedCropDigest equals ownCropDigest.*Supply the distinct lead crop/u,
    );
  });
});
