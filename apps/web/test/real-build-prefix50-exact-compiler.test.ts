import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  canonicalBrickDocument,
  canonicalDigest,
  createEmptyBrickDocument,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { __testOnly as projectionAdapterTestOnly } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  __testOnly as exactCompilerTestOnly,
  compileRealBuildPrefix50ExactProjection,
  diagnoseRealBuildPrefix50ProjectionForTest,
  requireRealBuildPrefix50CompleteEnumeration,
} from "../e2e/real-build-prefix50-exact-compiler";
import {
  readRealBuildPrefix50VerifiedProjection,
  readSyntheticRealBuildPrefix50DiagnosticProjectionForTest,
  type RealBuildPrefix50OccurrencePartIdentity,
  type RealBuildPrefix50VerifiedProjection,
} from "../e2e/real-build-prefix50-projection";
import { proposeRealBuildPrefix50SourcePlacementRepairs } from "../e2e/real-build-prefix50-source-placement-repair";
import { compileRealBuildPrefix50ZeroPieceStep } from "../e2e/real-build-prefix50-zero-step";
import {
  enumeratePlacements,
  PLACEMENT_ENUMERATION_VERSION,
} from "../src/assembly/enumerate-placements";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;

function snapshot(document: BrickDocumentV1) {
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });
}

function emptyDocument(): BrickDocumentV1 {
  return createEmptyBrickDocument({ id: "prefix50-synthetic", name: "Prefix 50 synthetic" });
}

interface ProjectionMutation {
  readonly occurrenceOrdinal?: number;
  readonly transform?: readonly [number, number, number];
  readonly printedStepNumber?: number;
  readonly detachedStepOneSource?: readonly [number, number, number];
  readonly sourceSetId?: string;
  readonly wrongReconciledOrdinal?: number;
  readonly swapPrintedStepOrdinals?: readonly [number, number];
}

function projection(mutation: ProjectionMutation = {}): RealBuildPrefix50VerifiedProjection {
  const nonzeroSteps = Array.from({ length: 50 }, (_, index) => index + 1).filter(
    (step) => step !== 44,
  );
  const occurrences = Array.from({ length: 320 }, (_, index) => {
    const ordinal = index + 1;
    const bucket = Math.min(48, Math.floor((index * 49) / 320));
    const normalStep = nonzeroSteps[bucket]!;
    const sourceWorldTransform =
      mutation.detachedStepOneSource !== undefined && ordinal === 7
        ? {
            positionLdu: [...mutation.detachedStepOneSource] as [number, number, number],
            orientationId: "upright-yaw-90",
          }
        : {
            positionLdu: [100, 100 - index * 24, 100] as [number, number, number],
            orientationId: "upright-yaw-90",
          };
    const exactBinding: RealBuildPrefix50OccurrencePartIdentity | undefined =
      ordinal === 25
        ? {
            publishedCatalogPartId: "builtin:wedge-plate-2x4-right",
            reconciledCatalogPartId: "builtin:wedge-plate-2x4-right",
            officialDesignId: "41769",
            officialDesignRevision: "41769;G",
            sourceLDrawPartId: "41769",
            catalogLDrawPartId: "41769a",
            identityProofId: "41769.dat->41769a.dat",
            basis: "official-archive-identity-moved-root",
          }
        : ordinal === 39
          ? {
              publishedCatalogPartId: "builtin:wedge-plate-2x4-left",
              reconciledCatalogPartId: "builtin:wedge-plate-2x4-left",
              officialDesignId: "41770",
              officialDesignRevision: "41770;H",
              sourceLDrawPartId: "41770",
              catalogLDrawPartId: "41770a",
              identityProofId: "41770.dat->41770a.dat",
              basis: "official-archive-identity-moved-root",
            }
          : [139, 147].includes(ordinal)
            ? {
                publishedCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
                reconciledCatalogPartId: "builtin:bracket-1x2-1x4-rounded-corners",
                officialDesignId: "10201",
                officialDesignRevision: "10201;H",
                sourceLDrawPartId: "10201",
                catalogLDrawPartId: "10201",
                identityProofId: null,
                basis: "official-member-revision",
              }
            : [178, 183, 185, 190, 191, 192, 193].includes(ordinal)
              ? {
                  publishedCatalogPartId: "builtin:brick-1x2x2-without-understud",
                  reconciledCatalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
                  officialDesignId: "3245",
                  officialDesignRevision: "3245;M",
                  sourceLDrawPartId: "3245b",
                  catalogLDrawPartId: "3245b",
                  identityProofId: null,
                  basis: "official-member-revision",
                }
              : undefined;
    const partIdentity =
      mutation.sourceSetId === "6651557" && exactBinding !== undefined
        ? {
            ...exactBinding,
            reconciledCatalogPartId:
              mutation.wrongReconciledOrdinal === ordinal
                ? exactBinding.publishedCatalogPartId
                : exactBinding.reconciledCatalogPartId,
          }
        : {
            publishedCatalogPartId: "builtin:brick-1x1",
            reconciledCatalogPartId: "builtin:brick-1x1",
            officialDesignId: "3005",
            officialDesignRevision: "3005:synthetic",
            sourceLDrawPartId: "3005",
            catalogLDrawPartId: "3005",
            identityProofId: null,
            basis: "published-exact" as const,
          };
    return {
      ordinal,
      printedStepNumber:
        mutation.occurrenceOrdinal === ordinal && mutation.printedStepNumber !== undefined
          ? mutation.printedStepNumber
          : normalStep,
      colorId: "builtin:red",
      partIdentity,
      sourceWorldTransform:
        mutation.occurrenceOrdinal === ordinal && mutation.transform !== undefined
          ? {
              positionLdu: [...mutation.transform] as [number, number, number],
              orientationId: "upright-yaw-90",
            }
          : sourceWorldTransform,
    };
  });
  if (mutation.swapPrintedStepOrdinals !== undefined) {
    const [leftOrdinal, rightOrdinal] = mutation.swapPrintedStepOrdinals;
    const left = occurrences[leftOrdinal - 1]!;
    const right = occurrences[rightOrdinal - 1]!;
    [left.printedStepNumber, right.printedStepNumber] = [
      right.printedStepNumber,
      left.printedStepNumber,
    ];
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-verified-projection/1" as const,
    sourceSetId: mutation.sourceSetId ?? "synthetic-prefix50",
    sourceArtifactDigest: digest("a"),
    steps: Array.from({ length: 50 }, (_, index) => ({
      printedStepNumber: index + 1,
      name: `Printed step ${index + 1}`,
      sourceActionDigest: digest(((index + 1) % 10).toString()),
    })),
    occurrences,
  });
}

const reader = (value: RealBuildPrefix50VerifiedProjection) =>
  projectionAdapterTestOnly.createSyntheticProjectionReaderForTest(value);

function compile(value = projection()) {
  return diagnoseRealBuildPrefix50ProjectionForTest({
    documentSnapshot: snapshot(emptyDocument()),
    projectionReader: reader(value),
  });
}

function repairEdgeBindingFixture() {
  const part = (id: string, catalogPartId: string) =>
    deepFreeze({
      id,
      catalogPartId,
      colorId: "builtin:dark-azure",
      transform: {
        positionLdu: [410, -118, -96] as const,
        orientationId: "proper-m-00pp000p0",
      },
      submodelId: "root",
      stepId: "step-45",
      semanticTags: [],
      provenance: { source: "manual" as const },
    });
  const document: BrickDocumentV1 = deepFreeze({
    ...emptyDocument(),
    parts: [
      part("candidate", "builtin:axle-1x3"),
      part("receiver", "builtin:technic-brick-1x1-axle-hole"),
      part("distractor", "builtin:technic-brick-1x1-axle-hole"),
    ],
    connections: [
      {
        id: "exact-edge",
        kind: "stud-tube" as const,
        a: { partId: "candidate", portId: "axle:2" },
        b: { partId: "receiver", portId: "axleHole:0" },
        provenance: { source: "manual" as const },
      },
    ],
  });
  return document;
}

function documentWith43Steps(): BrickDocumentV1 {
  const first = compileRealBuildAutomaticPlacement({
    documentSnapshot: snapshot(emptyDocument()),
    printedStepNumber: 1,
    printedStep: { name: "Printed step 1", sourceActionDigest: digest("1") },
    witnesses: [
      {
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        connections: [],
      },
    ],
  });
  if (!first.ok) throw new Error("synthetic step 1 failed");
  return applyBuildOperations(
    first.document,
    Array.from({ length: 42 }, (_, index) => ({
      kind: "addStep" as const,
      operationId: `synthetic-add-step-${index + 2}`,
      step: {
        id: `synthetic-step-${index + 2}`,
        index: index + 1,
        name: `Printed step ${index + 2}`,
        partIds: [],
      },
    })),
  );
}

describe("exact prefix-50 placement compiler", () => {
  it("reports a deterministic synthetic selected-path completion without minting a document", () => {
    const first = compile();
    const second = compile();

    expect(first).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1",
      placementAuthority: false,
      completionAuthority: false,
      documentAuthority: false,
      publicationAuthority: false,
      searchScope: {
        committedPrefixSelection: "first-locally-complete-order-per-step",
        currentStepBacktracking: "within-step-only",
        crossStepBacktracking: false,
        nodeBudget: "cumulative-across-prefix",
      },
      outcome: "selected-path-complete",
      blocker: null,
      observation: {
        completedPrintedStep: 50,
        compiledPartCount: 320,
        compiledStepCount: 50,
      },
    });
    expect(first.schemaVersion).toBe("lego.real-build-prefix50-selected-path-diagnostic/1");
    expect(canonicalDigest(first)).toBe(canonicalDigest(second));
    expect(first).not.toHaveProperty("document");
    expect(first).not.toHaveProperty("projectionReader");
    expect(first).not.toHaveProperty("publish");
    expect(first).not.toHaveProperty("bytes");
    expect(first).not.toHaveProperty("candidate");
  }, 120_000);

  it("rejects a caller-frozen reader lookalike before exact compilation", () => {
    const shaped = projection();
    const lookalike = Object.freeze({
      readVerifiedPrefix50Projection: Object.freeze(() => shaped),
    });
    expect(() => readRealBuildPrefix50VerifiedProjection(lookalike)).toThrow(
      /reader minted from the opaque current action and official-world verifiers/u,
    );
    expect(() =>
      compileRealBuildPrefix50ExactProjection({
        documentSnapshot: snapshot(emptyDocument()),
        occurrence30SourceRepairProof: {},
        projectionReader: lookalike,
      }),
    ).toThrow(/frozen caller lookalikes carry no placement authority/u);
  });

  it("rejects a synthetic reader at the canonical exact compiler boundary", () => {
    expect(() =>
      compileRealBuildPrefix50ExactProjection({
        documentSnapshot: snapshot(emptyDocument()),
        occurrence30SourceRepairProof: {},
        projectionReader: reader(projection()),
      }),
    ).toThrow(/reader minted from the opaque current action and official-world verifiers/u);
  });

  it("retains the verified rewind and refuses non-integral source positions without an exact repair", () => {
    const reordered = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
      reader(projection({ swapPrintedStepOrdinals: [10, 300] })),
    );
    expect(reordered.occurrences[9]!.printedStepNumber).toBeGreaterThan(
      reordered.occurrences[10]!.printedStepNumber,
    );

    const halfLdu = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
      reader(projection({ occurrenceOrdinal: 281, transform: [100.5, -200, 300] })),
    );
    expect(halfLdu.occurrences[280]!.sourceWorldTransform.positionLdu).toEqual([100.5, -200, 300]);
    expect(() =>
      readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
        reader(projection({ occurrenceOrdinal: 281, transform: [100.25, -200, 300] })),
      ),
    ).toThrow(/integer or half-LDU coordinates/u);
    expect(() =>
      compile(projection({ occurrenceOrdinal: 281, transform: [100, -200, 300.5] })),
    ).toThrow(/occurrence 281.*non-integral source transform.*no exact occurrence-scoped repair/u);
  });

  it("repairs only the three exact step-45 4519 source occurrences and retains counterevidence", () => {
    const base = projection({ sourceSetId: "6651557" });
    const sourcePositions = [
      [410, -118, -96.5],
      [270, -118, -96.5],
      [340, -118, -96.5],
    ] as const;
    const axleIdentity: RealBuildPrefix50OccurrencePartIdentity = {
      publishedCatalogPartId: "builtin:axle-1x3",
      reconciledCatalogPartId: "builtin:axle-1x3",
      officialDesignId: "4519",
      officialDesignRevision: "4519;E",
      sourceLDrawPartId: "4519",
      catalogLDrawPartId: "4519",
      identityProofId: null,
      basis: "published-exact",
    };
    const exact = deepFreeze({
      ...base,
      occurrences: base.occurrences.map((occurrence) => {
        const receiver =
          occurrence.ordinal === 261
            ? {
                catalogPartId: "builtin:technic-brick-1x1-axle-hole",
                colorId: "builtin:dark-azure",
                officialDesignId: "73230",
                officialDesignRevision: "73230;D",
                sourceLDrawPartId: "73230",
                catalogLDrawPartId: "73230",
                positionLdu: [270, -98, -94] as const,
                orientationId: "proper-m-00nn000p0",
              }
            : occurrence.ordinal === 264
              ? {
                  catalogPartId: "builtin:technic-brick-1x2-axle-hole",
                  colorId: "builtin:medium-azure",
                  officialDesignId: "32064",
                  officialDesignRevision: "32064;I",
                  sourceLDrawPartId: "32064a",
                  catalogLDrawPartId: "32064",
                  positionLdu: [340, -98, -94] as const,
                  orientationId: "proper-m-00pp000p0",
                }
              : occurrence.ordinal === 265
                ? {
                    catalogPartId: "builtin:technic-brick-1x1-axle-hole",
                    colorId: "builtin:dark-azure",
                    officialDesignId: "73230",
                    officialDesignRevision: "73230;D",
                    sourceLDrawPartId: "73230",
                    catalogLDrawPartId: "73230",
                    positionLdu: [410, -98, -94] as const,
                    orientationId: "proper-m-00nn000p0",
                  }
                : undefined;
        if (receiver !== undefined) {
          return {
            ...occurrence,
            printedStepNumber: 39,
            colorId: receiver.colorId,
            partIdentity: {
              publishedCatalogPartId: receiver.catalogPartId,
              reconciledCatalogPartId: receiver.catalogPartId,
              officialDesignId: receiver.officialDesignId,
              officialDesignRevision: receiver.officialDesignRevision,
              sourceLDrawPartId: receiver.sourceLDrawPartId,
              catalogLDrawPartId: receiver.catalogLDrawPartId,
              identityProofId: null,
              basis: "published-exact" as const,
            },
            sourceWorldTransform: {
              positionLdu: receiver.positionLdu,
              orientationId: receiver.orientationId,
            },
          };
        }
        if (occurrence.ordinal < 281 || occurrence.ordinal > 283) return occurrence;
        return {
          ...occurrence,
          printedStepNumber: 45,
          partIdentity: axleIdentity,
          sourceWorldTransform: {
            positionLdu: sourcePositions[occurrence.ordinal - 281]!,
            orientationId: "proper-m-00pp000p0",
          },
        };
      }),
    });
    expect(() => proposeRealBuildPrefix50SourcePlacementRepairs(exact)).toThrow(
      /exact projection value minted by the opaque verified-projection reader/u,
    );
    const verifiedExact = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(reader(exact));
    const integral = proposeRealBuildPrefix50SourcePlacementRepairs(verifiedExact);

    expect(
      exact.occurrences
        .slice(280, 283)
        .map(({ sourceWorldTransform }) => sourceWorldTransform.positionLdu),
    ).toEqual(sourcePositions);
    expect(
      integral.projection.occurrences
        .slice(280, 283)
        .map(({ sourceWorldTransform }) => sourceWorldTransform.positionLdu),
    ).toEqual([
      [410, -118, -96],
      [270, -118, -96],
      [340, -118, -96],
    ]);
    expect(
      integral.repairs.map(({ occurrenceOrdinal, sourceResidualLdu, provisionalBasis }) => ({
        occurrenceOrdinal,
        sourceResidualLdu,
        provisionalBasis,
      })),
    ).toEqual(
      [281, 282, 283].map((occurrenceOrdinal) => ({
        occurrenceOrdinal,
        sourceResidualLdu: [0, 0, 0.5],
        provisionalBasis: "occurrence-scoped-source-residual-awaiting-connector-proof",
      })),
    );

    const drifted = deepFreeze({
      ...exact,
      occurrences: exact.occurrences.map((occurrence) =>
        occurrence.ordinal === 281
          ? {
              ...occurrence,
              sourceWorldTransform: {
                ...occurrence.sourceWorldTransform,
                positionLdu: [410, -118, -95.5] as const,
              },
            }
          : occurrence,
      ),
    });
    const verifiedDrifted = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
      reader(drifted),
    );
    expect(() => proposeRealBuildPrefix50SourcePlacementRepairs(verifiedDrifted)).toThrow(
      /repair 281 drifted from its exact step-45 4519 occurrence/u,
    );
  });

  it("admits only the exact occurrence-1 80015 project anchor as a gauge-source proposal", () => {
    const base = projection({ sourceSetId: "6651557" });
    const exact = deepFreeze({
      ...base,
      occurrences: base.occurrences.map((occurrence) =>
        occurrence.ordinal === 1
          ? {
              ...occurrence,
              printedStepNumber: 1,
              colorId: "builtin:black",
              partIdentity: {
                publishedCatalogPartId: "builtin:corner-plate-5x5-quarter-ring",
                reconciledCatalogPartId: "builtin:corner-plate-5x5-quarter-ring",
                officialDesignId: "80015",
                officialDesignRevision: "80015;E",
                sourceLDrawPartId: "80015",
                catalogLDrawPartId: "80015",
                identityProofId: null,
                basis: "published-exact" as const,
              },
              sourceWorldTransform: {
                positionLdu: [500, -4, -234] as const,
                orientationId: "upright-yaw-0",
              },
            }
          : occurrence,
      ),
    });
    expect(() =>
      exactCompilerTestOnly.proposeRealBuildPrefix50WorldGaugeSourceRepair(exact),
    ).toThrow(/exact projection value minted by the opaque verified-projection reader/u);
    const verified = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(reader(exact));
    expect(
      exactCompilerTestOnly.proposeRealBuildPrefix50WorldGaugeSourceRepair(verified),
    ).toMatchObject({
      occurrenceOrdinal: 1,
      sourceWorldTransform: { positionLdu: [500, -4, -234] },
      repairedSourceWorldTransform: { positionLdu: [560, -4, -194] },
      sourceResidualLdu: [60, 0, 40],
      provisionalBasis: "occurrence-scoped-project-anchor-awaiting-complete-prefix-proof",
    });

    const drifted = deepFreeze({
      ...exact,
      occurrences: exact.occurrences.map((occurrence) =>
        occurrence.ordinal === 1
          ? {
              ...occurrence,
              sourceWorldTransform: {
                ...occurrence.sourceWorldTransform,
                positionLdu: [500, -4, -214] as const,
              },
            }
          : occurrence,
      ),
    });
    expect(() =>
      exactCompilerTestOnly.proposeRealBuildPrefix50WorldGaugeSourceRepair(
        readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(reader(drifted)),
      ),
    ).toThrow(/world-gauge source repair drifted from the exact set-6651557 occurrence-1/u);
  });

  it("rejects caller-injected world-gauge repairs at the exact input boundary", () => {
    expect(() =>
      compileRealBuildPrefix50ExactProjection({
        documentSnapshot: snapshot(emptyDocument()),
        projectionReader: reader(projection()),
        worldGaugeSourceRepair: {
          occurrenceOrdinal: 1,
          repairedSourceWorldTransform: {
            positionLdu: [560, -4, -194],
            orientationId: "upright-yaw-0",
          },
        },
      }),
    ).toThrow(/accepts only documentSnapshot, occurrence30SourceRepairProof, projectionReader/u);
  });

  it("final repair binding refuses missing, duplicate, wrong-receiver, and wrong-port axle edges", () => {
    const document = repairEdgeBindingFixture();
    const requireUniqueEdge = (connections: BrickDocumentV1["connections"]) =>
      exactCompilerTestOnly.requireUniqueExactPlacementRepairEdge(
        deepFreeze({ ...document, connections }),
        281,
        "candidate",
        "receiver",
        "axle:2",
        "axleHole:0",
      );
    const exact = document.connections[0]!;

    expect(requireUniqueEdge(document.connections)).toBe(exact);
    expect(() => requireUniqueEdge([])).toThrow(/repair 281 requires exactly one.*found 0/u);
    expect(() => requireUniqueEdge([exact, { ...exact, id: "duplicate-exact-edge" }])).toThrow(
      /repair 281 requires exactly one.*found 2/u,
    );
    expect(() =>
      requireUniqueEdge([
        {
          ...exact,
          id: "wrong-receiver-edge",
          b: { partId: "distractor", portId: "axleHole:0" },
        },
      ]),
    ).toThrow(/repair 281 requires exactly one.*found 0/u);
    expect(() =>
      requireUniqueEdge([
        {
          ...exact,
          id: "wrong-port-edge",
          b: { partId: "receiver", portId: "axleHole:1" },
        },
      ]),
    ).toThrow(/repair 281 requires exactly one.*found 0/u);
  });

  it("fails when an exact target is absent instead of accepting a caller transform", () => {
    expect(compile(projection({ occurrenceOrdinal: 2, transform: [101, 76, 100] }))).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1",
      placementAuthority: false,
      completionAuthority: false,
      documentAuthority: false,
      publicationAuthority: false,
      searchScope: {
        committedPrefixSelection: "first-locally-complete-order-per-step",
        currentStepBacktracking: "within-step-only",
        crossStepBacktracking: false,
        nodeBudget: "cumulative-across-prefix",
      },
      outcome: "selected-committed-prefix-within-step-blocker",
      blocker: {
        printedStepNumber: 1,
        occurrenceOrdinal: 2,
        catalogPartId: "builtin:brick-1x1",
      },
    });

    expect(() =>
      compileRealBuildPrefix50ExactProjection({
        documentSnapshot: snapshot(emptyDocument()),
        projectionReader: reader(projection()),
        witnesses: [{ transform: { positionLdu: [0, 0, 0] } }],
      }),
    ).toThrow(
      /caller-shaped actions, transforms, repairs, and witnesses cannot bypass enumeration/u,
    );
  });

  it("uses actual build-plate enumerations for detached step-1 targets", () => {
    const tower = compileRealBuildAutomaticPlacement({
      documentSnapshot: snapshot(emptyDocument()),
      printedStepNumber: 1,
      printedStep: { name: "Printed step 1", sourceActionDigest: digest("1") },
      witnesses: Array.from({ length: 6 }, (_, index) => ({
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        transform: {
          positionLdu: [0, -index * 24, 0] as [number, number, number],
          orientationId: "upright-yaw-0",
        },
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
      })),
    });
    if (!tower.ok) throw new Error("synthetic tower did not compile");
    const detachedCandidates = enumeratePlacements(tower.document, "builtin:brick-1x1", {
      includeBuildPlate: true,
      allowDetached: true,
    }).candidates.filter(({ restsOnBuildPlate }) => restsOnBuildPlate);
    const detached = detachedCandidates.find(({ connections }) => connections.length === 0);
    expect(detached).toMatchObject({ restsOnBuildPlate: true, connections: [] });
    if (detached === undefined)
      throw new Error("enumerator did not offer a detached build-plate target");
    const [targetX, targetY, targetZ] = detached.transform.positionLdu;

    expect(() =>
      compile(
        projection({
          detachedStepOneSource: [targetZ + 100, targetY + 100, 100 - targetX],
        }),
      ),
    ).toThrow(/automatic compilation failed at printed step 1.*DISCONNECTED_ASSEMBLY/u);
  });

  it("rejects suffix rows and refuses inconsistent enumeration counts", () => {
    expect(() => compile(projection({ occurrenceOrdinal: 320, printedStepNumber: 51 }))).toThrow(
      /suffix rows are forbidden/u,
    );

    expect(() =>
      requireRealBuildPrefix50CompleteEnumeration({
        schemaVersion: PLACEMENT_ENUMERATION_VERSION,
        catalogPartId: "builtin:brick-1x1",
        orientationIds: ["upright-yaw-0"],
        connectorSeedReceipt: [],
        candidates: [],
        counts: {
          freeStuds: 0,
          freeClutches: 0,
          rawFromStuds: 0,
          rawFromClutches: 0,
          rawFromBuildPlate: 2,
          distinctTransforms: 2,
          rejectedUnsupported: 0,
          rejectedDetached: 0,
          rejectedBelowBuildPlate: 0,
          rejectedColliding: 0,
          accepted: 1,
        },
      }),
    ).toThrow(/never be silently truncated/u);
  });

  it("compiles occurrence-reconciled member identity rather than published callout identity", () => {
    const exact = readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
      reader(projection({ sourceSetId: "6651557" })),
    );
    expect(
      exact.occurrences
        .filter(({ ordinal }) => [25, 39].includes(ordinal))
        .map(({ partIdentity }) => partIdentity),
    ).toEqual([
      {
        publishedCatalogPartId: "builtin:wedge-plate-2x4-right",
        reconciledCatalogPartId: "builtin:wedge-plate-2x4-right",
        officialDesignId: "41769",
        officialDesignRevision: "41769;G",
        sourceLDrawPartId: "41769",
        catalogLDrawPartId: "41769a",
        identityProofId: "41769.dat->41769a.dat",
        basis: "official-archive-identity-moved-root",
      },
      {
        publishedCatalogPartId: "builtin:wedge-plate-2x4-left",
        reconciledCatalogPartId: "builtin:wedge-plate-2x4-left",
        officialDesignId: "41770",
        officialDesignRevision: "41770;H",
        sourceLDrawPartId: "41770",
        catalogLDrawPartId: "41770a",
        identityProofId: "41770.dat->41770a.dat",
        basis: "official-archive-identity-moved-root",
      },
    ]);
    expect(
      exact.occurrences
        .filter(({ ordinal }) => [139, 147].includes(ordinal))
        .map(({ partIdentity }) => partIdentity),
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        publishedCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
        reconciledCatalogPartId: "builtin:bracket-1x2-1x4-rounded-corners",
        officialDesignId: "10201",
        officialDesignRevision: "10201;H",
        sourceLDrawPartId: "10201",
        catalogLDrawPartId: "10201",
        identityProofId: null,
        basis: "official-member-revision",
      })),
    );
    expect(
      exact.occurrences
        .filter(({ ordinal }) => [178, 183, 185, 190, 191, 192, 193].includes(ordinal))
        .map(({ partIdentity }) => partIdentity.reconciledCatalogPartId),
    ).toEqual(Array.from({ length: 7 }, () => "builtin:brick-1x2x2-inside-axle-holder"));

    expect(() =>
      readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
        reader(
          projection({
            sourceSetId: "6651557",
            wrongReconciledOrdinal: 178,
          }),
        ),
      ),
    ).toThrow(/official member correction|exact 3245;M member-to-LDraw reconciliation/u);
  });
});

describe("prefix-50 zero-piece transition compiler", () => {
  it("appends only exact contiguous printed step 44 through verified scope replay", () => {
    const prior = documentWith43Steps();
    const result = compileRealBuildPrefix50ZeroPieceStep({
      documentSnapshot: snapshot(prior),
      printedStepNumber: 44,
      printedStep: { name: "Printed step 44", sourceActionDigest: digest("4") },
    });

    expect(result.document.parts).toEqual(prior.parts);
    expect(result.document.connections).toEqual(prior.connections);
    expect(result.document.steps).toHaveLength(44);
    expect(result.document.steps[43]).toMatchObject({ index: 43, partIds: [] });
    expect(result.targetDocumentHash).toBe(documentStructuralHash(result.document));
  });

  it("rejects any other slot, a gap, or an empty-witness workaround", () => {
    const prior = documentWith43Steps();
    expect(() =>
      compileRealBuildPrefix50ZeroPieceStep({
        documentSnapshot: snapshot(prior),
        printedStepNumber: 43,
        printedStep: { name: "Printed step 43", sourceActionDigest: digest("4") },
      }),
    ).toThrow(/reserved for exact printed step 44/u);

    expect(() =>
      compileRealBuildPrefix50ZeroPieceStep({
        documentSnapshot: snapshot({ ...prior, steps: prior.steps.slice(0, 42) }),
        printedStepNumber: 44,
        printedStep: { name: "Printed step 44", sourceActionDigest: digest("4") },
      }),
    ).toThrow(/requires exactly 43 retained prior BuildStep/u);

    expect(() =>
      compileRealBuildPrefix50ZeroPieceStep({
        documentSnapshot: snapshot(prior),
        printedStepNumber: 44,
        printedStep: { name: "Printed step 44", sourceActionDigest: digest("4") },
        witnesses: [],
      }),
    ).toThrow(/actions, transforms, and witnesses are not accepted/u);
  });
});
