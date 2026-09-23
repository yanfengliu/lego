import {
  createEmptyBrickDocument,
  createPartInstance,
  deepFreeze,
  normalizeBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { __testOnly as projectionAdapterTestOnly } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { SET_6651557_OCCURRENCE_BINDINGS } from "../e2e/real-build-prefix50-projection-bindings";
import {
  readSyntheticRealBuildPrefix50DiagnosticProjectionForTest,
  type RealBuildPrefix50OccurrencePartIdentity,
  type RealBuildPrefix50VerifiedProjection,
} from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE } from "../e2e/real-build-prefix50-suffix-panel-fixture";
import {
  deriveRealBuildPrefix50SuffixSubBuildPlan,
  REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS,
  requireRealBuildPrefix50SuffixSubBuildPlan,
} from "../e2e/real-build-prefix50-suffix-subbuild-plan";
import {
  requireRealBuildPrefix50SameStepReturnState,
  requireRealBuildPrefix50TerminalDetachedState,
  verifyRealBuildPrefix50SameStepReturnState,
  verifyRealBuildPrefix50TerminalDetachedState,
} from "../e2e/real-build-prefix50-suffix-state";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const suffixRowByOrdinal = new Map(
  REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS.map((row) => [row.ordinal, row] as const),
);

function genericIdentity(): RealBuildPrefix50OccurrencePartIdentity {
  return {
    publishedCatalogPartId: "builtin:brick-1x1",
    reconciledCatalogPartId: "builtin:brick-1x1",
    officialDesignId: "3005",
    officialDesignRevision: "3005:synthetic",
    sourceLDrawPartId: "3005",
    catalogLDrawPartId: "3005",
    identityProofId: null,
    basis: "published-exact",
  };
}

function rawProjection(
  mutate?: (projection: RealBuildPrefix50VerifiedProjection) => RealBuildPrefix50VerifiedProjection,
): RealBuildPrefix50VerifiedProjection {
  const occurrences = Array.from({ length: 320 }, (_, index) => {
    const ordinal = index + 1;
    const suffix = suffixRowByOrdinal.get(ordinal);
    const printedStepNumber =
      suffix?.printedStepNumber ?? Math.min(43, Math.floor((index * 43) / 280) + 1);
    return {
      ordinal,
      printedStepNumber,
      phaseSequence: suffix?.phaseSequence ?? ordinal,
      phaseMemberOrdinal: suffix?.phaseMemberOrdinal ?? 1,
      subBuildPath: suffix?.subBuildPath ?? ["7004cf0d-d97f-4b0d-8572-970e23815c05"],
      colorId: "builtin:blue",
      partIdentity: SET_6651557_OCCURRENCE_BINDINGS.get(ordinal) ?? genericIdentity(),
      sourceWorldTransform: {
        positionLdu: [0, -24 * index, 0] as const,
        orientationId: "upright-yaw-0",
      },
    };
  });
  const raw = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-verified-projection/2" as const,
    sourceSetId: "6651557",
    sourceArtifactDigest: digest("a"),
    childSubBuildWindow: null,
    steps: Array.from({ length: 50 }, (_, index) => ({
      printedStepNumber: index + 1,
      name: `Printed step ${index + 1}`,
      sourceActionDigest: digest(((index + 1) % 10).toString()),
    })),
    occurrences,
  }) as RealBuildPrefix50VerifiedProjection;
  return mutate?.(raw) ?? raw;
}

function verifiedProjection(
  mutate?: (projection: RealBuildPrefix50VerifiedProjection) => RealBuildPrefix50VerifiedProjection,
) {
  const raw = rawProjection(mutate);
  return readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
    projectionAdapterTestOnly.createSyntheticProjectionReaderForTest(raw),
  );
}

function ordinalRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ordinal: index + 1,
    partId: `suffix-part-${String(index + 1).padStart(3, "0")}`,
  }));
}

function printedStepForOrdinal(ordinal: number): number {
  return suffixRowByOrdinal.get(ordinal)?.printedStepNumber ?? Math.min(43, ordinal);
}

function stateDocument(count: number, completedPrintedStep: number): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: `suffix-state-${completedPrintedStep}`,
    name: `Suffix state ${completedPrintedStep}`,
    maxParts: 400,
  });
  const rows = ordinalRows(count);
  const steps = Array.from({ length: completedPrintedStep }, (_, index) => ({
    id: `suffix-step-${String(index + 1).padStart(2, "0")}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  const parts: PartInstance[] = rows.map(({ ordinal, partId }) => {
    const terminalChild = completedPrintedStep === 50 && ordinal >= 312;
    const stepNumber = printedStepForOrdinal(ordinal);
    const part = createPartInstance({
      id: partId,
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:blue",
      stepId: steps[stepNumber - 1]!.id,
      submodelId: base.submodels[0]!.id,
      transform: {
        positionLdu: terminalChild
          ? ([200, -24 * (ordinal - 312), 0] as const)
          : ([0, -24 * (ordinal - 1), 0] as const),
        orientationId: "upright-yaw-0",
      },
      source: "ai",
      sourceId: `suffix-occurrence-${ordinal}`,
    });
    steps[stepNumber - 1]!.partIds.push(part.id);
    return part;
  });
  const connections: ConnectionEdge[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    if (completedPrintedStep === 50 && index === 311) continue;
    connections.push({
      id: `suffix-edge-${String(index).padStart(3, "0")}`,
      kind: "stud-tube",
      a: { partId: parts[index - 1]!.id, portId: "stud:0:0" },
      b: { partId: parts[index]!.id, portId: "undersideClutch:0:0" },
      provenance: { source: "ai", sourceId: `suffix-edge-${index}` },
    });
  }
  return normalizeBrickDocument({
    ...base,
    revision: `suffix-state-${completedPrintedStep}`,
    parts,
    connections,
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps,
  });
}

describe("prefix-50 suffix SubBuild semantics", () => {
  it("binds five same-step child groups across Steps 46-49 and a detached Step-50 child", () => {
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(verifiedProjection());

    expect(REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE).toMatchObject({
      authority: "none",
      sourceSetId: "6651557",
      exactBoundary: {
        firstPrintedStep: 45,
        lastPrintedStep: 50,
        firstPhysicalPage: 46,
        lastPhysicalPage: 53,
        step51Inspected: false,
        suffixReturnInferred: false,
      },
    });
    expect(plan.rootDirectStep).toEqual({
      printedStepNumber: 45,
      sourceSubBuildPath: ["7004cf0d-d97f-4b0d-8572-970e23815c05"],
      occurrenceOrdinals: [281, 282, 283],
    });
    expect(
      plan.sameStepReturns.map(({ printedStepNumber, occurrenceOrdinals }) => [
        printedStepNumber,
        occurrenceOrdinals,
      ]),
    ).toEqual([
      [46, [284, 285]],
      [46, [286, 287, 288]],
      [47, [289, 290, 291, 292]],
      [48, [293, 294, 295, 296, 297, 298]],
      [49, [299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311]],
    ]);
    expect(plan.terminalDetachedChild).toMatchObject({
      printedStepNumber: 50,
      occurrenceOrdinals: [312, 313, 314, 315, 316, 317, 318, 319, 320],
      returnObservedWithinExactPrefix: false,
      step51Inspected: false,
    });
    expect(requireRealBuildPrefix50SuffixSubBuildPlan(plan)).toBe(plan);
    expect(() => requireRealBuildPrefix50SuffixSubBuildPlan(structuredClone(plan))).toThrow(
      /runtime-branded plan/u,
    );
  });

  it("refuses a source path that erases the detached Step-50 boundary", () => {
    const projection = verifiedProjection((value) =>
      deepFreeze({
        ...value,
        occurrences: value.occurrences.map((row) =>
          row.ordinal === 312 ? { ...row, subBuildPath: [row.subBuildPath[0]!] } : row,
        ),
      }),
    );
    expect(() => deriveRealBuildPrefix50SuffixSubBuildPlan(projection)).toThrow(
      /occurrence 312.*source SubBuild path semantics/u,
    );
  });

  it("proves each Step 46-49 child is connected and integrated before its step commits", () => {
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(verifiedProjection());
    for (const [completedPrintedStep, count] of [
      [46, 288],
      [47, 292],
      [48, 298],
      [49, 311],
    ] as const) {
      const document = stateDocument(count, completedPrintedStep);
      expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
      const receipt = verifyRealBuildPrefix50SameStepReturnState({
        completedPrintedStep,
        document,
        ordinalPartRows: ordinalRows(count),
        plan,
      });
      expect(receipt).toMatchObject({
        authority: "none",
        completedPrintedStep,
        partCount: count,
        hardValid: true,
      });
      expect(
        receipt.groups.every(({ integrationConnectionIds }) => integrationConnectionIds.length > 0),
      ).toBe(true);
      expect(requireRealBuildPrefix50SameStepReturnState(receipt)).toBe(receipt);
    }
  });

  it("represents Step 50 as two hard-valid components without inventing a return edge", () => {
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(verifiedProjection());
    const document = stateDocument(320, 50);
    expect(
      validateBrickDocument(document)
        .issues.filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ).toEqual(["DISCONNECTED_ASSEMBLY"]);

    const terminal = verifyRealBuildPrefix50TerminalDetachedState({
      document,
      ordinalPartRows: ordinalRows(320),
      plan,
    });
    expect(terminal).toMatchObject({
      authority: "none",
      completionAuthority: false,
      completedPrintedStep: 50,
      exactBoundary: "printed-steps-1-through-50-only",
      step51Inspected: false,
      combinedPartCount: 320,
      parentPartCount: 311,
      childPartCount: 9,
      combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"],
      crossComponentConnectionCount: 0,
    });
    expect(validateBrickDocument(terminal.parentDocument).documentGloballyValid).toBe(true);
    expect(validateBrickDocument(terminal.childDocument).documentGloballyValid).toBe(true);
    expect(requireRealBuildPrefix50TerminalDetachedState(terminal)).toBe(terminal);
    expect(() => requireRealBuildPrefix50TerminalDetachedState(structuredClone(terminal))).toThrow(
      /runtime brand/u,
    );
  });

  it("refuses a disconnected same-step child, an invented Step-50 return, and Step 51", () => {
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(verifiedProjection());
    const step46 = stateDocument(288, 46);
    expect(() =>
      verifyRealBuildPrefix50SameStepReturnState({
        completedPrintedStep: 46,
        document: {
          ...step46,
          connections: step46.connections.filter(({ id }) => id !== "suffix-edge-283"),
        },
        ordinalPartRows: ordinalRows(288),
        plan,
      }),
    ).toThrow(/must be completely hard-valid|must be internally connected/u);

    const step46Roster = step46.steps[45]!.partIds;
    expect(() =>
      verifyRealBuildPrefix50SameStepReturnState({
        completedPrintedStep: 46,
        document: {
          ...step46,
          steps: step46.steps.map((step, index) =>
            index === 45
              ? {
                  ...step,
                  partIds: [...step46Roster.slice(0, -1), step46Roster[0]!],
                }
              : step,
          ),
        },
        ordinalPartRows: ordinalRows(288),
        plan,
      }),
    ).toThrow(/BuildStep must contain exactly/u);

    const terminal = stateDocument(320, 50);
    const step50Roster = terminal.steps[49]!.partIds;
    expect(() =>
      verifyRealBuildPrefix50TerminalDetachedState({
        document: {
          ...terminal,
          steps: terminal.steps.map((step, index) =>
            index === 49
              ? {
                  ...step,
                  partIds: [...step50Roster.slice(0, -1), step50Roster[0]!],
                }
              : step,
          ),
        },
        ordinalPartRows: ordinalRows(320),
        plan,
      }),
    ).toThrow(/Step 50 must contain exactly/u);

    expect(() =>
      verifyRealBuildPrefix50TerminalDetachedState({
        document: {
          ...terminal,
          connections: [
            ...terminal.connections,
            {
              id: "invented-step51-return",
              kind: "stud-tube",
              a: { partId: "suffix-part-311", portId: "stud:0:0" },
              b: { partId: "suffix-part-312", portId: "undersideClutch:0:0" },
              provenance: { source: "ai", sourceId: "invented-step51-return" },
            },
          ],
        },
        ordinalPartRows: ordinalRows(320),
        plan,
      }),
    ).toThrow(/zero invented return edges/u);

    expect(() =>
      verifyRealBuildPrefix50TerminalDetachedState({
        document: {
          ...terminal,
          steps: [
            ...terminal.steps,
            { id: "suffix-step-51", index: 50, name: "Printed step 51", partIds: [] },
          ],
        },
        ordinalPartRows: ordinalRows(320),
        plan,
      }),
    ).toThrow(/no Step-51 suffix/u);
  });
});
