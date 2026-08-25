import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  snapshotRealBuildEnumeratedPlacementOffer,
  type RealBuildEnumeratedPlacementOffer,
} from "../e2e/real-build-enumerated-placement-witness";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "../e2e/real-build-panel-camera-resolver-boundary";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "../e2e/real-build-prepared-step-authority";
import { mapRealBuildStepOneProperC4MemberCameraToRepresentative } from "../e2e/real-build-step-one-proper-c4-camera-equivariance";
import {
  aggregateRealBuildStepOneProperC4RepresentativeScores,
  requireRealBuildStepOneProperC4GlobalAggregationInspection,
  type RealBuildStepOneProperC4RepresentativeCameraScoreRow,
} from "../e2e/real-build-step-one-proper-c4-global-aggregation";
import { inspectRealBuildStepOneProperC4Quotient } from "../e2e/real-build-step-one-proper-c4-quotient";
import {
  preparedSearchEmptyParent,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

type Turn = 0 | 90 | 180 | 270;

function rotate([x, y, z]: readonly [number, number, number], turn: Turn) {
  const rotated =
    turn === 0 ? [x, y, z] : turn === 90 ? [z, y, -x] : turn === 180 ? [-x, y, -z] : [-z, y, x];
  return rotated.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)) as [
    number,
    number,
    number,
  ];
}

function buildQuotient() {
  const bytes = preparedSearchOptionsBytes(2, 1);
  const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
  const [first, second] = preparedStep.expectedAtomicPieces;
  const rawCandidates = Array.from({ length: 100 }, (_, orbit) => {
    const radius = (orbit + 1) * 20;
    return ([0, 90, 180, 270] as const).map((turn) => {
      const partIds = [`c4-${orbit}-${turn}-a`, `c4-${orbit}-${turn}-b`] as const;
      return {
        partIds,
        offeredCandidates: [
          snapshotRealBuildEnumeratedPlacementOffer({
            catalogPartId: first!.catalogPartId,
            transform: {
              positionLdu: rotate([radius, 8, 0], turn),
              orientationId: `upright-yaw-${turn}`,
            },
            connections: [],
            restsOnBuildPlate: true,
          }),
          snapshotRealBuildEnumeratedPlacementOffer({
            catalogPartId: second!.catalogPartId,
            transform: {
              positionLdu: rotate([radius, 8, 20], turn),
              orientationId: `upright-yaw-${turn}`,
            },
            connections: [
              {
                targetPartId: partIds[0],
                targetPortId: "stud:orbit",
                candidatePortId: "undersideClutch:orbit",
              },
            ],
            restsOnBuildPlate: false,
          }),
        ] as readonly [RealBuildEnumeratedPlacementOffer, RealBuildEnumeratedPlacementOffer],
      };
    });
  }).flat();
  return {
    bytes,
    quotient: inspectRealBuildStepOneProperC4Quotient({
      rootDocumentSnapshot: preparedSearchEmptyParent().documentSnapshot,
      preparedStep,
      rawCandidates,
    }),
  };
}

let control: ReturnType<typeof buildQuotient> | undefined;

function currentControl() {
  control ??= buildQuotient();
  return control;
}

function numberedDigest(value: number) {
  return `sha256:${value.toString(16).padStart(64, "0")}` as const;
}

function representativeRows(
  score: (orbitIndex: number, hypothesisIndex: number) => number = () => 0.5,
): RealBuildStepOneProperC4RepresentativeCameraScoreRow[] {
  return PANEL_CAMERA_ANGULAR_HYPOTHESES.flatMap((hypothesis, hypothesisIndex) =>
    currentControl().quotient.orbits.map(({ orbitIndex }) => {
      const documentHash = numberedDigest(orbitIndex + 1);
      const encounterIndex = hypothesisIndex * 100 + orbitIndex;
      return {
        closureIndex: Math.floor(orbitIndex / 5),
        orbitIndex,
        hypothesis: { ...hypothesis },
        candidateId: `document:${documentHash}`,
        documentHash,
        cameraId: `compiled-observation-camera:${numberedDigest(1_000 + encounterIndex)}`,
        maskDigest: numberedDigest(2_000 + encounterIndex),
        shiftPx: [hypothesisIndex - 4, orbitIndex - 50] as const,
        score: score(orbitIndex, hypothesisIndex),
        rootLineageId: `lineage:${numberedDigest(3_000 + hypothesisIndex)}`,
        lineageId: `lineage:${numberedDigest(4_000 + encounterIndex)}`,
      };
    }),
  );
}

function aggregate(rows = representativeRows()) {
  const { bytes, quotient } = currentControl();
  return aggregateRealBuildStepOneProperC4RepresentativeScores({
    quotient,
    policy: inspectRealBuildPreparedObservationPolicy(bytes),
    representativeRows: rows,
  });
}

describe("step-one proper-C4 global aggregation", () => {
  it("retains 800 verified representatives and inverse-expands 3,200 raw camera scores", () => {
    const result = aggregate();

    expect(result).toMatchObject({
      schemaVersion: "lego.real-build-step-one-proper-c4-global-aggregation/1",
      accounting: {
        closureCount: 20,
        representativesPerClosure: 5,
        representativeCameraRows: 800,
        rawMemberCameraRows: 3_200,
        quotientLogicalCameraAssociations: 6_400,
        rawLogicalCameraAssociations: 25_600,
      },
      selection: {
        status: "unresolved",
        selectedRawEncounterIndex: null,
        selectedRepresentativeEncounterIndex: null,
        bestScore: 0.5,
        runnerUpScore: 0.5,
        margin: 0,
      },
      acceptedDocument: null,
      acceptedTransition: null,
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: { status: "absent", authorized: false },
      authority: "absent",
    });
    expect(result.representativeRows).toHaveLength(800);
    expect(result.quotientInverseMap).toHaveLength(400);
    expect(result.inverseExpandedRows).toHaveLength(3_200);
    expect(result.rankedRawEncounterIndices).toHaveLength(3_200);
    expect(new Set(result.rankedRawEncounterIndices).size).toBe(3_200);
    expect(result.rankedRawEncounterIndices).toEqual(
      Array.from({ length: 3_200 }, (_, index) => index),
    );
    expect(requireRealBuildStepOneProperC4GlobalAggregationInspection(result)).toBe(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.inverseExpandedRows)).toBe(true);
    expect(Object.isFrozen(result.inverseExpandedRows[0]?.representativeShiftPx)).toBe(true);
  });

  it("maps every raw D4 hypothesis bijectively and uses each representative score four times", () => {
    const result = aggregate(representativeRows((_orbit, hypothesis) => 0.1 + hypothesis / 10));
    const referenceCounts = new Array<number>(800).fill(0);

    for (let rawIndex = 0; rawIndex < 400; rawIndex += 1) {
      const inverse = result.quotientInverseMap[rawIndex]!;
      const rows = PANEL_CAMERA_ANGULAR_HYPOTHESES.map(
        (_hypothesis, hypothesisIndex) =>
          result.inverseExpandedRows[hypothesisIndex * 400 + rawIndex]!,
      );
      expect(rows.map(({ hypothesis }) => hypothesis)).toEqual(PANEL_CAMERA_ANGULAR_HYPOTHESES);
      expect(
        new Set(rows.map(({ representativeEncounterIndex }) => representativeEncounterIndex)).size,
      ).toBe(8);
      for (const row of rows) {
        expect(row.rawIndex).toBe(rawIndex);
        expect(row.representativeHypothesis).toEqual(
          mapRealBuildStepOneProperC4MemberCameraToRepresentative(
            row.hypothesis,
            inverse.turnDegrees,
          ),
        );
        expect(row.score).toBe(result.representativeRows[row.representativeEncounterIndex]!.score);
        expect(row.representativeMaskDigest).toBe(
          result.representativeRows[row.representativeEncounterIndex]!.maskDigest,
        );
        referenceCounts[row.representativeEncounterIndex]! += 1;
      }
    }
    expect(referenceCounts.every((count) => count === 4)).toBe(true);
  });

  it("finds a late-closure best score but preserves its four-way symmetry tie", () => {
    const result = aggregate(
      representativeRows((orbit, hypothesis) => (orbit === 99 && hypothesis === 7 ? 0.99 : 0.25)),
    );
    const top = result.rankedRawEncounterIndices
      .slice(0, 4)
      .map((index) => result.inverseExpandedRows[index]!);

    expect(top.every(({ closureIndex }) => closureIndex === 19)).toBe(true);
    expect(
      top.every(({ representativeEncounterIndex }) => representativeEncounterIndex === 799),
    ).toBe(true);
    expect(top.map(({ rawEncounterIndex }) => rawEncounterIndex)).toEqual(
      [...top]
        .map(({ rawEncounterIndex }) => rawEncounterIndex)
        .sort((left, right) => left - right),
    );
    expect(result.selection).toMatchObject({
      status: "unresolved",
      bestScore: 0.99,
      runnerUpScore: 0.99,
      margin: 0,
    });
  });

  it("refuses an exact top tie spanning the first and last closures", () => {
    const result = aggregate(
      representativeRows((orbit, hypothesis) =>
        (orbit === 0 && hypothesis === 0) || (orbit === 99 && hypothesis === 7) ? 0.95 : 0.2,
      ),
    );
    const top = result.rankedRawEncounterIndices
      .slice(0, 8)
      .map((index) => result.inverseExpandedRows[index]!);

    expect(new Set(top.map(({ closureIndex }) => closureIndex))).toEqual(new Set([0, 19]));
    expect(result.selection).toEqual({
      status: "unresolved",
      selectedRawEncounterIndex: null,
      selectedRepresentativeEncounterIndex: null,
      bestScore: 0.95,
      runnerUpScore: 0.95,
      margin: 0,
    });
  });

  it("refuses missing, duplicate, reordered, malformed, and digest-unbound coverage", () => {
    const missing = representativeRows().slice(0, -1);
    expect(() => aggregate(missing)).toThrow(/exactly 800/u);

    const duplicate = representativeRows();
    duplicate[1] = { ...duplicate[0]!, hypothesis: { ...duplicate[0]!.hypothesis } };
    expect(() => aggregate(duplicate)).toThrow(/canonical closure\/orbit\/D4 encounter order/u);

    const reordered = representativeRows();
    [reordered[8], reordered[9]] = [reordered[9]!, reordered[8]!];
    expect(() => aggregate(reordered)).toThrow(/canonical closure\/orbit\/D4 encounter order/u);

    const malformed = representativeRows();
    malformed[40] = { ...malformed[40]!, closureIndex: 19 };
    expect(() => aggregate(malformed)).toThrow(/canonical closure\/orbit\/D4 encounter order/u);

    const repeatedCamera = representativeRows();
    repeatedCamera[1] = { ...repeatedCamera[1]!, cameraId: repeatedCamera[0]!.cameraId };
    expect(() => aggregate(repeatedCamera)).toThrow(/repeat one compiled camera ID/u);

    const negativeZero = representativeRows();
    negativeZero[0] = { ...negativeZero[0]!, shiftPx: [-0, 0] };
    expect(() => aggregate(negativeZero)).toThrow(/safe-integer shifts/u);

    const unbound = representativeRows();
    unbound[0] = { ...unbound[0]!, candidateId: `document:${numberedDigest(999_999)}` };
    expect(() => aggregate(unbound)).toThrow(/does not bind documentHash/u);
  });

  it("binds branded quotient and policy inputs and produces deterministic digests", () => {
    const first = aggregate();
    const second = aggregate();
    expect({
      representative: first.representativeRowsDigest,
      inverse: first.inverseExpandedRowsDigest,
      ranking: first.rankingDigest,
      aggregation: first.aggregationDigest,
    }).toEqual({
      representative: second.representativeRowsDigest,
      inverse: second.inverseExpandedRowsDigest,
      ranking: second.rankingDigest,
      aggregation: second.aggregationDigest,
    });
    expect(first.aggregationDigest).toBe(
      canonicalDigest({
        schemaVersion: first.schemaVersion,
        quotientDigest: first.quotientDigest,
        policyDigest: first.policyDigest,
        representativeRowsDigest: first.representativeRowsDigest,
        inverseMapDigest: first.inverseMapDigest,
        inverseExpandedRowsDigest: first.inverseExpandedRowsDigest,
        rankingDigest: first.rankingDigest,
        accounting: first.accounting,
      }),
    );
    const { bytes, quotient } = currentControl();
    expect(() =>
      aggregateRealBuildStepOneProperC4RepresentativeScores({
        quotient: { ...quotient },
        policy: inspectRealBuildPreparedObservationPolicy(bytes),
        representativeRows: representativeRows(),
      }),
    ).toThrow(/exact frozen inspection/u);
    expect(() =>
      aggregateRealBuildStepOneProperC4RepresentativeScores({
        quotient,
        policy: { ...inspectRealBuildPreparedObservationPolicy(bytes) },
        representativeRows: representativeRows(),
      }),
    ).toThrow(/exact non-authoritative result/u);
    expect(() => requireRealBuildStepOneProperC4GlobalAggregationInspection({ ...first })).toThrow(
      /exact frozen inspection/u,
    );
  });
});
