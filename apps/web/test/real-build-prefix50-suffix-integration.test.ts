import { existsSync } from "node:fs";

import {
  createEmptyBrickDocument,
  createPartInstance,
  deepFreeze,
  normalizeBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This ignored-evidence reproducer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error This ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { __testOnly as projectionAdapterTestOnly } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import {
  readRealBuildPrefix50VerifiedProjection,
  readSyntheticRealBuildPrefix50DiagnosticProjectionForTest,
  type RealBuildPrefix50OccurrencePartIdentity,
  type RealBuildPrefix50VerifiedProjection,
} from "../e2e/real-build-prefix50-projection";
import { SET_6651557_OCCURRENCE_BINDINGS } from "../e2e/real-build-prefix50-projection-bindings";
import { targetsFor } from "../e2e/real-build-prefix50-exact-compiler-operations";
import { searchStep } from "../e2e/real-build-prefix50-exact-compiler-search";
import {
  constructRealBuildPrefix50Step50AtomicRoot,
  requireRealBuildPrefix50Step50AtomicRoot,
} from "../e2e/real-build-prefix50-suffix-root";
import {
  deriveRealBuildPrefix50SuffixSubBuildPlan,
  REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS,
} from "../e2e/real-build-prefix50-suffix-subbuild-plan";
import { requireRealBuildPrefix50TerminalDetachedState } from "../e2e/real-build-prefix50-suffix-state";
import { compileRealBuildPrefix50TerminalDetachedStep } from "../e2e/real-build-prefix50-suffix-terminal-step";
import { prefix50TemporaryPartId } from "../e2e/real-build-prefix50-temporary-placement";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const REAL_EVIDENCE_PATHS = [
  "output/part-identification/prefix50-semantic-closure.json",
  "output/real-build/action-preparation.json",
  "output/real-build/prefix50-official-ldraw-world-proposal.json",
  "output/real-build/prefix50-ldraw-catalog-frames.json",
  "output/real-build/prefix50-official-world-reconciliation.json",
  "output/real-build/prefix50-structural-events.json",
] as const;
const hasRealEvidence = REAL_EVIDENCE_PATHS.every((path) => existsSync(path));
const suffixRowByOrdinal = new Map(
  REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS.map((row) => [row.ordinal, row] as const),
);
const identity: RealBuildPrefix50OccurrencePartIdentity = deepFreeze({
  publishedCatalogPartId: "builtin:brick-1x1",
  reconciledCatalogPartId: "builtin:brick-1x1",
  officialDesignId: "3005",
  officialDesignRevision: "3005:synthetic",
  sourceLDrawPartId: "3005",
  catalogLDrawPartId: "3005",
  identityProofId: null,
  basis: "published-exact",
});
const gauge = deepFreeze({
  positionLdu: [0, 0, 0] as const,
  orientationId: "upright-yaw-0" as const,
});

function printedStepForOrdinal(ordinal: number): number {
  const suffix = suffixRowByOrdinal.get(ordinal);
  return suffix?.printedStepNumber ?? Math.min(43, Math.floor(((ordinal - 1) * 43) / 280) + 1);
}

function verifiedProjection(): RealBuildPrefix50VerifiedProjection {
  const occurrences = Array.from({ length: 320 }, (_, index) => {
    const ordinal = index + 1;
    const suffix = suffixRowByOrdinal.get(ordinal);
    const terminal = ordinal >= 312;
    return {
      ordinal,
      printedStepNumber: printedStepForOrdinal(ordinal),
      phaseSequence: suffix?.phaseSequence ?? ordinal,
      phaseMemberOrdinal: suffix?.phaseMemberOrdinal ?? 1,
      subBuildPath: suffix?.subBuildPath ?? ["7004cf0d-d97f-4b0d-8572-970e23815c05"],
      colorId: "builtin:blue",
      partIdentity: SET_6651557_OCCURRENCE_BINDINGS.get(ordinal) ?? identity,
      sourceWorldTransform: {
        positionLdu: terminal
          ? ([200, -24 * (ordinal - 312), 0] as const)
          : ([0, -24 * index, 0] as const),
        orientationId: "upright-yaw-0" as const,
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
  return readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
    projectionAdapterTestOnly.createSyntheticProjectionReaderForTest(raw),
  );
}

async function canonicalProjection(): Promise<RealBuildPrefix50VerifiedProjection> {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  return readRealBuildPrefix50VerifiedProjection(
    createRealBuildPrefix50VerifiedProjectionReader({
      actionPreparation: {
        bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
        verified: reproduced.input.actionPreparation,
      },
      officialWorldReconciliation: {
        bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
        verified: reconciliation,
      },
      structuralEvents: { bytes: structural.bytes, verified: structural.verified },
    }),
  );
}

function parentDocument(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "suffix-step49-parent",
    name: "Suffix Step 49 parent",
    maxParts: 400,
  });
  const steps = Array.from({ length: 49 }, (_, index) => ({
    id: `suffix-step-${String(index + 1).padStart(2, "0")}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  const parts: PartInstance[] = Array.from({ length: 311 }, (_, index) => {
    const ordinal = index + 1;
    const step = printedStepForOrdinal(ordinal);
    const part = createPartInstance({
      id: `suffix-part-${String(ordinal).padStart(3, "0")}`,
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:blue",
      stepId: steps[step - 1]!.id,
      submodelId: base.submodels[0]!.id,
      transform: { positionLdu: [0, -24 * index, 0], orientationId: "upright-yaw-0" },
      source: "ai",
      sourceId: `suffix-occurrence-${ordinal}`,
    });
    steps[step - 1]!.partIds.push(part.id);
    return part;
  });
  const connections: ConnectionEdge[] = parts.slice(1).map((part, index) => ({
    id: `suffix-edge-${String(index + 1).padStart(3, "0")}`,
    kind: "stud-tube",
    a: { partId: parts[index]!.id, portId: "stud:0:0" },
    b: { partId: part.id, portId: "undersideClutch:0:0" },
    provenance: { source: "ai", sourceId: `suffix-edge-${index + 1}` },
  }));
  return normalizeBrickDocument({
    ...base,
    revision: "suffix-step49-parent",
    parts,
    connections,
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps,
  });
}

describe("prefix-50 Step-50 atomic root and terminal compilation", () => {
  it("proves the reciprocal phase-90 root and compiles one detached nine-part Step 50", () => {
    const projection = verifiedProjection();
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(projection);
    const parent = parentDocument();
    expect(validateBrickDocument(parent).documentGloballyValid).toBe(true);
    const targets = targetsFor(projection, gauge, 50, null, null);
    const budget = {
      nodes: 0,
      enumerations: 0,
      orientationNarrowedEnumerations: 0,
      targetAttempts: new Map(),
    };
    const root = constructRealBuildPrefix50Step50AtomicRoot({
      projection,
      plan,
      parentDocument: parent,
      gauge,
      rootRows: targets.slice(0, 2) as unknown as [
        (typeof targets)[number],
        (typeof targets)[number],
      ],
      budget,
    });
    expect(root).toMatchObject({
      authority: "none",
      completionAuthority: false,
      printedStepNumber: 50,
      step51Inspected: false,
      ordinals: [312, 313],
      accounting: { nodeDelta: 2, enumerationDelta: 2 },
    });
    expect(root.proof.normalizedConnections.length).toBeGreaterThan(0);
    expect(requireRealBuildPrefix50Step50AtomicRoot(root)).toBe(root);
    expect(() => requireRealBuildPrefix50Step50AtomicRoot(structuredClone(root))).toThrow(
      /exact branded/u,
    );

    const remaining = targets.slice(2);
    const searched = searchStep(
      {
        document: root.childSearchDocument,
        remaining,
        witnesses: root.witnesses,
        ordinals: root.ordinals,
        witnessIndexByTempId: new Map([
          [prefix50TemporaryPartId(312), 0],
          [prefix50TemporaryPartId(313), 1],
        ]),
      },
      new Set(),
      false,
      budget,
      new Set(),
    );
    expect(searched).not.toBeNull();
    if (searched === null) throw new Error("Step-50 child search unexpectedly failed.");
    const compiled = compileRealBuildPrefix50TerminalDetachedStep({
      document: parent,
      printedStepNumber: 50,
      printedStep: projection.steps[49]!,
      targets,
      placementOrdinals: searched.ordinals,
      witnesses: searched.witnesses,
      ordinalPartRowsBeforeStep: parent.parts.map((part, index) => ({
        ordinal: index + 1,
        partId: part.id,
      })),
      plan,
    });
    expect(compiled).toMatchObject({
      authority: "none",
      completionAuthority: false,
      printedStepNumber: 50,
      step51Inspected: false,
      terminalState: {
        combinedPartCount: 320,
        parentPartCount: 311,
        childPartCount: 9,
        combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"],
        crossComponentConnectionCount: 0,
      },
    });
    expect(compiled.assignments.map(([ordinal]) => ordinal).slice(0, 2)).toEqual([312, 313]);
    expect(requireRealBuildPrefix50TerminalDetachedState(compiled.terminalState)).toBe(
      compiled.terminalState,
    );
  });

  it("refuses a terminal root seeded from a Step-51 row", () => {
    const projection = verifiedProjection();
    const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(projection);
    const targets = targetsFor(projection, gauge, 50, null, null);
    expect(() =>
      constructRealBuildPrefix50Step50AtomicRoot({
        projection,
        plan,
        parentDocument: parentDocument(),
        gauge,
        rootRows: [targets[0]!, { ...targets[1]!, printedStepNumber: 51 }],
        budget: {
          nodes: 0,
          enumerations: 0,
          orientationNarrowedEnumerations: 0,
          targetAttempts: new Map(),
        },
      }),
    ).toThrow(/exact source ordinal 313/u);
  });

  it.runIf(hasRealEvidence)(
    "proves the atomic root and remaining child search on the retained canonical Step-50 poses",
    async () => {
      const projection = await canonicalProjection();
      expect(
        projection.occurrences.slice(311, 320).map((row) => ({
          ordinal: row.ordinal,
          catalogPartId: row.partIdentity.reconciledCatalogPartId,
          positionLdu: row.sourceWorldTransform.positionLdu,
          orientationId: row.sourceWorldTransform.orientationId,
        })),
      ).toEqual([
        {
          ordinal: 312,
          catalogPartId: "builtin:brick-1x2",
          positionLdu: [360, -132, -124],
          orientationId: "upright-yaw-90",
        },
        {
          ordinal: 313,
          catalogPartId: "builtin:brick-1x1",
          positionLdu: [350, -108, -124],
          orientationId: "upright-yaw-180",
        },
        {
          ordinal: 314,
          catalogPartId: "builtin:slope-1x2-45",
          positionLdu: [380, -108, -124],
          orientationId: "upright-yaw-270",
        },
        {
          ordinal: 315,
          catalogPartId: "builtin:brick-1x1x5-solid-stud",
          positionLdu: [350, -204, -124],
          orientationId: "upright-yaw-180",
        },
        {
          ordinal: 316,
          catalogPartId: "builtin:brick-1x1x5-solid-stud",
          positionLdu: [370, -204, -124],
          orientationId: "upright-yaw-180",
        },
        {
          ordinal: 317,
          catalogPartId: "builtin:brick-1x2",
          positionLdu: [360, -276, -124],
          orientationId: "upright-yaw-90",
        },
        {
          ordinal: 318,
          catalogPartId: "builtin:curved-slope-1x1-outside-bow",
          positionLdu: [370, -296, -124],
          orientationId: "upright-yaw-180",
        },
        {
          ordinal: 319,
          catalogPartId: "builtin:brick-1x1",
          positionLdu: [350, -300, -124],
          orientationId: "upright-yaw-180",
        },
        {
          ordinal: 320,
          catalogPartId: "builtin:curved-slope-1x1-outside-bow",
          positionLdu: [350, -320, -124],
          orientationId: "upright-yaw-180",
        },
      ]);

      const plan = deriveRealBuildPrefix50SuffixSubBuildPlan(projection);
      const targets = targetsFor(projection, gauge, 50, null, null);
      const budget = {
        nodes: 0,
        enumerations: 0,
        orientationNarrowedEnumerations: 0,
        targetAttempts: new Map(),
      };
      const root = constructRealBuildPrefix50Step50AtomicRoot({
        projection,
        plan,
        parentDocument: parentDocument(),
        gauge,
        rootRows: targets.slice(0, 2) as unknown as [
          (typeof targets)[number],
          (typeof targets)[number],
        ],
        budget,
      });
      const searched = searchStep(
        {
          document: root.childSearchDocument,
          remaining: targets.slice(2),
          witnesses: root.witnesses,
          ordinals: root.ordinals,
          witnessIndexByTempId: new Map([
            [prefix50TemporaryPartId(312), 0],
            [prefix50TemporaryPartId(313), 1],
          ]),
        },
        new Set(),
        false,
        budget,
        new Set(),
      );
      expect(searched?.ordinals).toHaveLength(9);
      expect(searched?.remaining).toHaveLength(0);
      expect(validateBrickDocument(searched!.document).documentGloballyValid).toBe(true);
    },
    180_000,
  );
});
