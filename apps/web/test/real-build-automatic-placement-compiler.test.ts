import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  canonicalDigest,
  createAttachedTransform,
  createEmptyBrickDocument,
  canonicalBrickDocument,
  documentStructuralHash,
  normalizeBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { snapshotRealBuildAutomaticPlacementInput } from "../e2e/real-build-automatic-placement-input";
import {
  measureRealBuildAutomaticPlacementBaseWork,
  measureRealBuildAutomaticPlacementWork,
} from "../e2e/real-build-automatic-placement-work";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { realBuildDocumentCandidateId } from "../e2e/real-build-candidate-lineage-identity";
import {
  prepareRealBuildAutomaticPrintedStep,
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_MANIFEST,
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
} from "../e2e/real-build-automatic-placement-step";

const snapshot = (document: BrickDocumentV1) =>
  createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });

const sourceActionDigest = (digit: string) => `sha256:${digit.repeat(64)}`;

const emptyPrintedPrefix = (id = "auto", name = "Automatic") => {
  return normalizeBrickDocument(createEmptyBrickDocument({ id, name }));
};

const placementInput = (document = emptyPrintedPrefix(), digestDigit = "1") => ({
  documentSnapshot: snapshot(document),
  printedStepNumber: 1,
  printedStep: {
    name: "Printed step 1",
    sourceActionDigest: sourceActionDigest(digestDigit),
  },
  witnesses: [
    {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      connections: [],
    },
  ],
});

const place = (document = emptyPrintedPrefix()) =>
  compileRealBuildAutomaticPlacement(placementInput(document));

const capacityWitnesses = (portsByTile: readonly (readonly string[])[]) => {
  const tiles = portsByTile.map((_, index) => ({
    id: `capacity-tile-${index}`,
    catalogPartId: "builtin:tile-1x2-chamfered-indented",
    transform: {
      positionLdu: [index * 80, 8, 0] as [number, number, number],
      orientationId: "upright-yaw-0",
    },
  }));
  return [
    ...tiles.map(({ catalogPartId, transform }) => ({
      catalogPartId,
      colorId: "builtin:black",
      transform,
      connections: [],
    })),
    ...portsByTile.flatMap((ports, tileIndex) =>
      ports.map((candidateTargetPortId) => ({
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        transform: createAttachedTransform(
          tiles[tileIndex]!,
          candidateTargetPortId,
          "builtin:brick-1x1",
          "stud:0:0",
          "upright-yaw-0",
        ),
        connections: [
          {
            target: { kind: "witness" as const, witnessIndex: tileIndex },
            targetPortId: candidateTargetPortId,
            candidatePortId: "stud:0:0",
            connectionKind: "stud-tube" as const,
          },
        ],
      })),
    ),
  ];
};

const compileCapacityStepOne = (portsByTile: readonly (readonly string[])[]) =>
  compileRealBuildAutomaticPlacement({
    documentSnapshot: snapshot(emptyPrintedPrefix("capacity", "Capacity preflight")),
    printedStepNumber: 1,
    printedStep: {
      name: "Printed capacity step 1",
      sourceActionDigest: sourceActionDigest("c"),
    },
    witnesses: capacityWitnesses(portsByTile),
  });

describe("automatic printed-step placement compiler", () => {
  it("pins shared-capacity preflight in automatic compiler snapshot version 3", () => {
    expect(REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_MANIFEST).toMatchObject({
      compilerVersion: "lego.real-build-automatic-placement-compiler/3",
      connectorCapacityPolicy: "part-local-exact-port-plus-source-reviewed-shared-cells/1",
    });
    expect(REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH).toBe(
      canonicalDigest(REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_MANIFEST),
    );
    expect(REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH).toBe(
      "sha256:5d657ffa305adec6dfdac37a91ce53f7c830a2a0a406eb7dd57b7c5c1a10383d",
    );
  });

  it("preflights candidate-local shared capacity without changing exact-port semantics", () => {
    expect(() => compileCapacityStepOne([["undersideClutch:0", "undersideClutch:1"]])).toThrow(
      /Automatic placement witness 2 connection 0 consumes shared connector-capacity cell 99563:negative-z-half .* already reserved by Automatic placement witness 1 connection 0; choose a non-overlapping endpoint/u,
    );

    const outerPair = compileCapacityStepOne([["undersideClutch:0", "undersideClutch:2"]]);
    expect(outerPair.ok).toBe(true);

    const isolatedCenters = compileCapacityStepOne([["undersideClutch:1"], ["undersideClutch:1"]]);
    expect(isolatedCenters).toMatchObject({
      ok: false,
      issues: [
        {
          code: "PATCH_INTRODUCES_BLOCKING_ISSUE",
          message: expect.stringMatching(/DISCONNECTED_ASSEMBLY/u),
        },
      ],
    });

    expect(() => compileCapacityStepOne([["undersideClutch:0", "undersideClutch:0"]])).toThrow(
      /Automatic placement witness 2 connection 0 consumes port undersideClutch:0 .* already reserved by Automatic placement witness 1 connection 0; choose a non-overlapping endpoint/u,
    );
  });

  it("seeds retained shared-capacity claims before compiling a later step", () => {
    const first = compileCapacityStepOne([["undersideClutch:0"]]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const tile = first.document.parts.find(
      ({ catalogPartId }) => catalogPartId === "builtin:tile-1x2-chamfered-indented",
    )!;
    const inputFor = (targetPortId: string) => ({
      documentSnapshot: snapshot(first.document),
      printedStepNumber: 2,
      printedStep: {
        name: "Printed capacity step 2",
        sourceActionDigest: sourceActionDigest("d"),
      },
      witnesses: [
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: createAttachedTransform(
            tile,
            targetPortId,
            "builtin:brick-1x1",
            "stud:0:0",
            "upright-yaw-0",
          ),
          connections: [
            {
              target: { kind: "base" as const, partId: tile.id },
              targetPortId,
              candidatePortId: "stud:0:0",
              connectionKind: "stud-tube" as const,
            },
          ],
        },
      ],
    });

    expect(() => compileRealBuildAutomaticPlacement(inputFor("undersideClutch:1"))).toThrow(
      /consumes shared connector-capacity cell 99563:negative-z-half .* already reserved by Automatic placement base connection .*; choose a non-overlapping endpoint/u,
    );
    expect(compileRealBuildAutomaticPlacement(inputFor("undersideClutch:2")).ok).toBe(true);
  });

  it("attributes generated parts to the candidate and reproduces its patch", () => {
    const base = emptyPrintedPrefix();
    const result = place(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.parts[0]!.provenance).toEqual({
      source: "ai",
      sourceId: realBuildDocumentCandidateId(documentStructuralHash(result.document)),
    });
    expect(result.patch.operations[0]).toMatchObject({
      kind: "removeStep",
      step: { id: "step-1", index: 0, name: "Step 1", partIds: [] },
    });
    expect(result.patch.operations[1]).toMatchObject({
      kind: "addStep",
      step: { index: 0, name: "Printed step 1", partIds: [] },
    });
    expect(applyBuildOperations(base, result.patch.operations)).toEqual(result.document);
    expect(result.document.steps[0]!.partIds).toEqual([result.document.parts[0]!.id]);
    expect(result.automaticPlacement.program.printedStep).toEqual({
      name: "Printed step 1",
      sourceActionDigest: sourceActionDigest("1"),
    });
    expect(result.automaticPlacement.program.preparationOperations).toEqual(
      result.patch.operations.slice(0, 2),
    );
    expect(result.automaticPlacement.programHash).toBe(
      canonicalDigest(result.automaticPlacement.program),
    );
    expect(result.automaticPlacement.placementProgramHash).toBe(
      canonicalDigest(result.automaticPlacement.program.placementProgram),
    );
    expect(result.patch.provenance).toMatchObject({
      candidateId: result.automaticPlacement.candidateId,
      compilerSnapshotHash: REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH,
      buildProgramHash: result.automaticPlacement.programHash,
    });
    expect(result.patch.scopeDigest).toBe(canonicalDigest(result.automaticPlacement.combinedScope));
    expect(place(base)).toEqual(result);
  });

  it("keeps mismatched preparation, program, and placement values outside the private composer", async () => {
    const base = emptyPrintedPrefix("auto-private", "Private composer");
    const honestInput = placementInput(base, "a");
    const honest = compileRealBuildAutomaticPlacement(honestInput);
    const alternate = compileRealBuildAutomaticPlacement(placementInput(base, "b"));
    expect(honest.ok).toBe(true);
    expect(alternate.ok).toBe(true);
    if (!honest.ok || !alternate.ok) return;
    const alternateProgram = alternate.automaticPlacement.program;
    const alternatePreparedStep = prepareRealBuildAutomaticPrintedStep({
      document: base,
      printedStepNumber: alternateProgram.printedStepNumber,
      metadata: alternateProgram.printedStep,
      compilerInputDigest: alternateProgram.compilerInputDigest,
    });
    for (const [field, mismatched] of [
      ["preparedStep", alternatePreparedStep],
      ["automaticProgram", alternateProgram],
      ["placement", alternate],
    ] as const) {
      expect(
        compileRealBuildAutomaticPlacement({ ...honestInput, [field]: mismatched }),
        `${field} must not reach composition`,
      ).toEqual(honest);
    }

    const [compilerApi, stepApi] = await Promise.all([
      import("../e2e/real-build-automatic-placement-compiler"),
      import("../e2e/real-build-automatic-placement-step"),
    ]);
    expect(compilerApi).not.toHaveProperty("composeRealBuildAutomaticPrintedStepCompilation");
    expect(stepApi).not.toHaveProperty("composeRealBuildAutomaticPrintedStepCompilation");
  });

  it("attributes every discovered connection to the same candidate", () => {
    const first = place(emptyPrintedPrefix("auto-stack", "Automatic stack"));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const base = first.document;
    const basePart = base.parts[0]!;
    const result = compileRealBuildAutomaticPlacement({
      documentSnapshot: snapshot(base),
      printedStepNumber: 2,
      printedStep: {
        name: "Printed step 2",
        sourceActionDigest: sourceActionDigest("2"),
      },
      witnesses: [
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
          connections: [
            {
              target: { kind: "base", partId: basePart.id },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.connections).toHaveLength(1);
    expect(result.document.connections[0]!.provenance).toEqual({
      source: "ai",
      sourceId: realBuildDocumentCandidateId(documentStructuralHash(result.document)),
    });
    expect(result.document.steps.map(({ index }) => index)).toEqual([0, 1]);
    expect(result.patch.operations[0]).toMatchObject({ kind: "addStep", step: { index: 1 } });
    expect(applyBuildOperations(base, result.patch.operations)).toEqual(result.document);
  });

  it("shares exact step-one and later-step compiler work-policy measurements", () => {
    const firstInput = snapshotRealBuildAutomaticPlacementInput(placementInput());
    const firstWork = measureRealBuildAutomaticPlacementWork({
      base: measureRealBuildAutomaticPlacementBaseWork(
        firstInput.documentSnapshot.document,
        firstInput.documentSnapshot.canonicalByteLength,
      ),
      printedStepNumber: firstInput.printedStepNumber,
      printedStep: firstInput.printedStep,
      witnesses: firstInput.witnesses,
    });
    expect(firstWork.preparationOperations).toBe(2);
    expect(firstWork.combinedOperations).toBe(3);
    expect(firstWork.graphVisits).toBe(
      3 * firstWork.finalGraphEntries * firstWork.combinedOperations,
    );
    for (const [printedStepNumber, observed] of [
      [0, "0"],
      [-0, "-0"],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "Infinity"],
      [Number.NEGATIVE_INFINITY, "-Infinity"],
      [BigInt(1) as unknown as number, "1n"],
    ] as const) {
      expect(() =>
        measureRealBuildAutomaticPlacementWork({
          base: measureRealBuildAutomaticPlacementBaseWork(
            firstInput.documentSnapshot.document,
            firstInput.documentSnapshot.canonicalByteLength,
          ),
          printedStepNumber,
          printedStep: firstInput.printedStep,
          witnesses: firstInput.witnesses,
        }),
      ).toThrow(
        new RegExp(
          `received printedStepNumber ${observed}; expected a safe integer from 1 through 359`,
          "iu",
        ),
      );
    }

    const first = compileRealBuildAutomaticPlacement(firstInput);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.automaticPlacement.program.preparationOperations).toHaveLength(2);
    const laterInput = snapshotRealBuildAutomaticPlacementInput({
      documentSnapshot: snapshot(first.document),
      printedStepNumber: 2,
      printedStep: {
        name: "Printed step 2",
        sourceActionDigest: sourceActionDigest("2"),
      },
      witnesses: [
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
          connections: [
            {
              target: { kind: "base", partId: first.document.parts[0]!.id },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube",
            },
          ],
        },
      ],
    });
    const laterWork = measureRealBuildAutomaticPlacementWork({
      base: measureRealBuildAutomaticPlacementBaseWork(
        laterInput.documentSnapshot.document,
        laterInput.documentSnapshot.canonicalByteLength,
      ),
      printedStepNumber: laterInput.printedStepNumber,
      printedStep: laterInput.printedStep,
      witnesses: laterInput.witnesses,
    });
    expect(laterWork.preparationOperations).toBe(1);
    expect(laterWork.combinedOperations).toBe(3);
    expect(laterWork.byteVisits).toBeGreaterThan(firstWork.byteVisits / 2);

    const later = compileRealBuildAutomaticPlacement(laterInput);
    expect(later.ok).toBe(true);
    if (!later.ok) return;
    expect(later.automaticPlacement.program.preparationOperations).toHaveLength(1);
  });

  it("uses compiler-local identities when later witnesses attach to earlier witnesses", () => {
    const base = emptyPrintedPrefix("auto-two", "Automatic pair");
    const result = compileRealBuildAutomaticPlacement({
      documentSnapshot: snapshot(base),
      printedStepNumber: 1,
      printedStep: {
        name: "Printed step 1",
        sourceActionDigest: sourceActionDigest("3"),
      },
      witnesses: [
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:red",
          transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
          connections: [],
        },
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
          connections: [
            {
              target: { kind: "witness", witnessIndex: 0 },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube",
            },
          ],
        },
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:red",
          transform: { positionLdu: [0, -48, 0], orientationId: "upright-yaw-0" },
          connections: [
            {
              target: { kind: "witness", witnessIndex: 1 },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.parts).toHaveLength(3);
    expect(result.document.connections).toHaveLength(2);
    const candidateId = realBuildDocumentCandidateId(documentStructuralHash(result.document));
    expect(
      result.document.connections.every(({ provenance }) => provenance.sourceId === candidateId),
    ).toBe(true);
    const connectedPartIds = new Set(
      result.document.connections.flatMap(({ a, b }) => [a.partId, b.partId]),
    );
    expect(connectedPartIds).toEqual(new Set(result.document.parts.map(({ id }) => id)));
  });

  it("refuses a missing printed step and disconnected automatic result", () => {
    const empty = createEmptyBrickDocument({ id: "auto-refuse", name: "Automatic refuse" });
    expect(() =>
      compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot(empty),
        printedStepNumber: 2,
        printedStep: {
          name: "Printed step 2",
          sourceActionDigest: sourceActionDigest("4"),
        },
        witnesses: [
          {
            catalogPartId: "builtin:brick-1x1",
            colorId: "builtin:red",
            transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
            connections: [],
          },
        ],
      }),
    ).toThrow(/compile printed step 1 first/u);

    expect(() =>
      compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot(empty),
        printedStepNumber: 1,
        printedStep: {
          name: "Printed step 1",
          sourceActionDigest: sourceActionDigest("5"),
        },
        witnesses: [
          {
            catalogPartId: "builtin:brick-1x1",
            colorId: "builtin:red",
            transform: { positionLdu: [0, -100, 0], orientationId: "upright-yaw-0" },
            connections: [],
          },
        ],
      }),
    ).toThrow(/not supported/u);
  });

  it("refuses to replace a caller-populated or relabeled bootstrap step", () => {
    const base = createEmptyBrickDocument({ id: "auto-bootstrap", name: "Bootstrap guard" });
    for (const modified of [
      normalizeBrickDocument({
        ...base,
        steps: [{ ...base.steps[0]!, name: "Caller step 1" }],
      }),
      normalizeBrickDocument({
        ...base,
        steps: [{ ...base.steps[0]!, id: "caller-step" }],
      }),
    ]) {
      expect(() =>
        compileRealBuildAutomaticPlacement({
          documentSnapshot: snapshot(modified),
          printedStepNumber: 1,
          printedStep: {
            name: "Printed step 1",
            sourceActionDigest: sourceActionDigest("9"),
          },
          witnesses: [
            {
              catalogPartId: "builtin:brick-1x1",
              colorId: "builtin:red",
              transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
              connections: [],
            },
          ],
        }),
      ).toThrow(/exact empty root bootstrap/u);
    }
  });

  it("detaches wrappers without invoking getters or proxy key traps", () => {
    const base = createEmptyBrickDocument({ id: "auto-hostile", name: "Automatic hostile" });
    let getterCalls = 0;
    let ownKeyCalls = 0;
    const transform = { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" };
    Object.defineProperty(transform, "orientationId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must not read");
      },
    });
    const input = new Proxy(
      {
        documentSnapshot: snapshot(base),
        printedStepNumber: 1,
        printedStep: {
          name: "Printed step 1",
          sourceActionDigest: sourceActionDigest("6"),
        },
        witnesses: [
          {
            catalogPartId: "builtin:brick-1x1",
            colorId: "builtin:red",
            transform,
            connections: [],
          },
        ],
      },
      {
        ownKeys() {
          ownKeyCalls += 1;
          throw new Error("must not enumerate");
        },
      },
    );
    expect(() => compileRealBuildAutomaticPlacement(input)).toThrow(/own data property/u);
    expect(getterCalls).toBe(0);
    expect(ownKeyCalls).toBe(0);
  });

  it("preflights the aggregate compiler operation cap", () => {
    const base = createEmptyBrickDocument({ id: "auto-bound", name: "Automatic bound" });
    const excessive = Array.from({ length: 1_023 }, (_, index) => ({
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [index * 20, 0, 0] as const, orientationId: "upright-yaw-0" },
      connections:
        index === 0
          ? []
          : [
              {
                target: { kind: "witness" as const, witnessIndex: index - 1 },
                targetPortId: "stud:0:0",
                candidatePortId: "undersideClutch:0:0",
                connectionKind: "stud-tube" as const,
              },
            ],
    }));
    expect(() =>
      compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot(base),
        printedStepNumber: 1,
        printedStep: {
          name: "Printed step 1",
          sourceActionDigest: sourceActionDigest("7"),
        },
        witnesses: excessive,
      }),
    ).toThrow(/at most 1022 entries|compiler limit/u);
  });

  it("refuses repeated whole-document compiler work before either compile pass", () => {
    const base = createEmptyBrickDocument({ id: "auto-work", name: "Automatic work bound" });
    const expensive = Array.from({ length: 1_022 }, (_, index) => ({
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [index * 20, 0, 0] as const, orientationId: "upright-yaw-0" },
      connections: [],
    }));
    expect(() =>
      compileRealBuildAutomaticPlacement({
        documentSnapshot: snapshot(base),
        printedStepNumber: 1,
        printedStep: {
          name: "Printed step 1",
          sourceActionDigest: sourceActionDigest("8"),
        },
        witnesses: expensive,
      }),
    ).toThrow(/graph-entry visits.*bounded limits/u);
  });
});
