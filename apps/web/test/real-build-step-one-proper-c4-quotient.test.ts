import { applyBuildOperations } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  snapshotRealBuildEnumeratedPlacementOffer,
  type RealBuildEnumeratedPlacementOffer,
} from "../e2e/real-build-enumerated-placement-witness";
import { inspectRealBuildPreparedStepInput } from "../e2e/real-build-prepared-step-authority";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import {
  inspectRealBuildStepOneProperC4Quotient,
  requireRealBuildStepOneProperC4QuotientInspection,
} from "../e2e/real-build-step-one-proper-c4-quotient";
import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { createPlacePartTransaction } from "../src/manual-commands";
import {
  preparedSearchEmptyParent,
  preparedSearchOptions,
  preparedSearchOptionsBytes,
  preparedSearchParent,
} from "./real-build-prepared-search.fixture";

interface RawCandidate {
  partIds: [string, string];
  offeredCandidates: readonly [
    RealBuildEnumeratedPlacementOffer,
    RealBuildEnumeratedPlacementOffer,
  ];
}

function distinct(candidates: readonly PlacementCandidate[]): readonly PlacementCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentCatalogStepOneBytes(): Uint8Array {
  const options = preparedSearchOptions(2, 1);
  const panels = [...options.panels];
  const panel = panels[0]!;
  panels[0] = {
    ...panel,
    pieces: panel.pieces.map((piece, index) => ({
      ...piece,
      designId: index === 0 ? "80015" : "30565",
      materialId: "26",
      catalogPartId:
        index === 0 ? "builtin:corner-plate-5x5-quarter-ring" : "builtin:corner-plate-4x4-round",
      colorId: "builtin:black",
    })),
  };
  return encodeRealBuildPreparedRunInput({ ...options, panels });
}

function buildCurrentControl() {
  const preparedStep = inspectRealBuildPreparedStepInput(currentCatalogStepOneBytes(), 1);
  const rootDocumentSnapshot = preparedSearchEmptyParent().documentSnapshot;
  const [firstPiece, secondPiece] = preparedStep.expectedAtomicPieces;
  const firstCandidates = distinct(
    enumeratePlacements(rootDocumentSnapshot.document, firstPiece!.catalogPartId, {
      includeBuildPlate: true,
    }).candidates,
  );
  const rawCandidates = firstCandidates.flatMap((first) => {
    const firstTransaction = createPlacePartTransaction(rootDocumentSnapshot.document, {
      catalogPartId: first.catalogPartId,
      colorId: firstPiece!.colorId,
      transform: first.transform,
    });
    const firstDocument = applyBuildOperations(
      rootDocumentSnapshot.document,
      firstTransaction.operations,
    );
    const firstOffer = snapshotRealBuildEnumeratedPlacementOffer(first);
    return distinct(
      enumeratePlacements(firstDocument, secondPiece!.catalogPartId, {}).candidates,
    ).map((second) => {
      const secondTransaction = createPlacePartTransaction(firstDocument, {
        catalogPartId: second.catalogPartId,
        colorId: secondPiece!.colorId,
        transform: second.transform,
      });
      return {
        partIds: [firstTransaction.partId, secondTransaction.partId] as [string, string],
        offeredCandidates: [firstOffer, snapshotRealBuildEnumeratedPlacementOffer(second)] as const,
      };
    });
  });
  return { rootDocumentSnapshot, preparedStep, rawCandidates: rawCandidates as RawCandidate[] };
}

let cachedControl: ReturnType<typeof buildCurrentControl> | undefined;

function currentControl() {
  cachedControl ??= buildCurrentControl();
  return {
    rootDocumentSnapshot: cachedControl.rootDocumentSnapshot,
    preparedStep: cachedControl.preparedStep,
    rawCandidates: cachedControl.rawCandidates.map(({ partIds, offeredCandidates }) => ({
      partIds: [...partIds] as [string, string],
      offeredCandidates: [...offeredCandidates] as unknown as RawCandidate["offeredCandidates"],
    })),
  };
}

interface MutableOffer {
  catalogPartId: string;
  transform: { positionLdu: [number, number, number]; orientationId: string };
  connections: { targetPartId: string; targetPortId: string; candidatePortId: string }[];
  restsOnBuildPlate: boolean;
}

function replaceOffer(
  candidate: RawCandidate,
  pieceIndex: 0 | 1,
  mutate: (offer: MutableOffer) => void,
): void {
  const source = candidate.offeredCandidates[pieceIndex];
  const mutable: MutableOffer = {
    catalogPartId: source.catalogPartId,
    transform: {
      positionLdu: [...source.transform.positionLdu],
      orientationId: source.transform.orientationId,
    },
    connections: source.connections.map((connection) => ({ ...connection })),
    restsOnBuildPlate: source.restsOnBuildPlate,
  };
  mutate(mutable);
  const offeredCandidates = [...candidate.offeredCandidates] as [
    RealBuildEnumeratedPlacementOffer,
    RealBuildEnumeratedPlacementOffer,
  ];
  offeredCandidates[pieceIndex] = snapshotRealBuildEnumeratedPlacementOffer(mutable);
  candidate.offeredCandidates = offeredCandidates;
}

function rotate(
  [x, y, z]: readonly [number, number, number],
  turn: 0 | 90 | 180 | 270,
): [number, number, number] {
  const rotated =
    turn === 0 ? [x, y, z] : turn === 90 ? [z, y, -x] : turn === 180 ? [-x, y, -z] : [-z, y, x];
  return rotated.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)) as [
    number,
    number,
    number,
  ];
}

function syntheticProperOrbits(groupCount: number): ReturnType<typeof currentControl> {
  const control = currentControl();
  const [first, second] = control.preparedStep.expectedAtomicPieces;
  control.rawCandidates = Array.from({ length: groupCount }, (_, groupIndex) => {
    const radius = (groupIndex + 1) * 20;
    return ([0, 90, 180, 270] as const).map((turn) => {
      const partIds: [string, string] = [
        `proper-c4-${groupIndex}-${turn}-first`,
        `proper-c4-${groupIndex}-${turn}-second`,
      ];
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
        ] as const,
      };
    });
  }).flat();
  return control;
}

describe("step-one proper-C4 executable quotient", () => {
  it("reduces the exact current /26 400-row population to 100 free proper-yaw orbits", () => {
    const input = currentControl();
    const result = inspectRealBuildStepOneProperC4Quotient(input);

    expect(result).toMatchObject({
      schemaVersion: "lego.real-build-step-one-proper-c4-quotient/1",
      rawCandidateCount: 400,
      orbitCount: 100,
      branchAccounting: {
        rootsPerCandidate: 8,
        camerasPerRoot: 8,
        rawRootEdges: 3_200,
        quotientRootEdges: 800,
        rawLogicalCameraBranches: 25_600,
        quotientLogicalCameraBranches: 6_400,
      },
      acceptedDocument: null,
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: { status: "absent", authorized: false },
      authority: "absent",
    });
    expect(result.orbits).toHaveLength(100);
    expect(
      result.orbits.every(
        ({ members }) => members.map(({ turnDegrees }) => turnDegrees).join(",") === "0,90,180,270",
      ),
    ).toBe(true);
    expect(result.inverseMap.map(({ rawIndex }) => rawIndex)).toEqual(
      Array.from({ length: 400 }, (_, index) => index),
    );
    expect(result.inverseExpandedRawRoster).toEqual(result.rawRoster);
    expect(
      result.inverseExpandedRawRoster.every(
        ({ partIds, offeredCandidates }) =>
          offeredCandidates[0].restsOnBuildPlate &&
          !offeredCandidates[1].restsOnBuildPlate &&
          offeredCandidates[1].connections.every(({ targetPartId }) => targetPartId === partIds[0]),
      ),
    ).toBe(true);
    expect(requireRealBuildStepOneProperC4QuotientInspection(result)).toBe(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.orbits[0]?.members)).toBe(true);
    expect(result.rawRosterDigest).toBe(
      "sha256:24e68a134cf86c181ede701c2f189d1f2816af4a83510e2a841f270249d5ce72",
    );
    expect(result.quotientDigest).toBe(
      "sha256:e9f23510849153d022bb0aafd6dbf5281bbf6c519c7aff8d14bdefd0fd1145b9",
    );
  });

  it("refuses missing, duplicate-yaw, reflected, connection-drifted, and support-drifted rows", () => {
    const baseline = inspectRealBuildStepOneProperC4Quotient(currentControl());
    const firstOrbit = baseline.orbits[0]!;
    const byTurn = Object.fromEntries(
      firstOrbit.members.map((member) => [member.turnDegrees, member.rawIndex]),
    ) as Record<0 | 90 | 180 | 270, number>;

    const missing = currentControl();
    missing.rawCandidates.splice(byTurn[270], 1);
    expect(() => inspectRealBuildStepOneProperC4Quotient(missing)).toThrow(
      /exactly one member at q=0\/90\/180\/270/u,
    );

    const duplicate = currentControl();
    const duplicateSource = duplicate.rawCandidates[byTurn[0]]!;
    duplicate.rawCandidates[byTurn[90]] = {
      partIds: [...duplicateSource.partIds],
      offeredCandidates: [
        ...duplicateSource.offeredCandidates,
      ] as RawCandidate["offeredCandidates"],
    };
    expect(() => inspectRealBuildStepOneProperC4Quotient(duplicate)).toThrow(/q=0\/90\/180\/270/u);

    const reflected = currentControl();
    for (const pieceIndex of [0, 1] as const) {
      replaceOffer(reflected.rawCandidates[byTurn[90]]!, pieceIndex, (offer) => {
        const [x, y, z] = offer.transform.positionLdu;
        const yaw = Number(offer.transform.orientationId.slice("upright-yaw-".length));
        offer.transform.positionLdu = [Object.is(-x, -0) ? 0 : -x, y, z];
        offer.transform.orientationId = `upright-yaw-${(360 - yaw) % 360}`;
      });
    }
    expect(() => inspectRealBuildStepOneProperC4Quotient(reflected)).toThrow(/q=0\/90\/180\/270/u);

    const connectionDrift = currentControl();
    replaceOffer(connectionDrift.rawCandidates[byTurn[90]]!, 1, (offer) => {
      offer.connections[0]!.targetPortId += ":drift";
    });
    expect(() => inspectRealBuildStepOneProperC4Quotient(connectionDrift)).toThrow(
      /q=0\/90\/180\/270/u,
    );

    const supportDrift = currentControl();
    replaceOffer(supportDrift.rawCandidates[byTurn[90]]!, 1, (offer) => {
      offer.restsOnBuildPlate = true;
    });
    expect(() => inspectRealBuildStepOneProperC4Quotient(supportDrift)).toThrow(
      /q=0\/90\/180\/270/u,
    );
  });

  it("rejects provenance and raw-target drift before orbit formation", () => {
    const catalogDrift = currentControl();
    replaceOffer(catalogDrift.rawCandidates[0]!, 0, (offer) => {
      offer.catalogPartId = "builtin:brick-1x1";
    });
    expect(() => inspectRealBuildStepOneProperC4Quotient(catalogDrift)).toThrow(
      /instead of prepared piece/u,
    );

    const targetDrift = currentControl();
    replaceOffer(targetDrift.rawCandidates[0]!, 1, (offer) => {
      offer.connections[0]!.targetPartId = "unknown-provisional-part";
    });
    expect(() => inspectRealBuildStepOneProperC4Quotient(targetDrift)).toThrow(
      /targets unknown part/u,
    );
  });

  it("rejects proxies, accessors, sparse arrays, unbranded offers, and mutable aliases", () => {
    const proxiedInput = currentControl();
    expect(() => inspectRealBuildStepOneProperC4Quotient(new Proxy(proxiedInput, {}))).toThrow(
      /may not be a Proxy/u,
    );

    const sparse = currentControl();
    delete (sparse.rawCandidates as (RawCandidate | undefined)[])[0];
    expect(() => inspectRealBuildStepOneProperC4Quotient(sparse)).toThrow(/dense numeric indices/u);

    let getterCalls = 0;
    const accessor = currentControl();
    const accessorRow = { offeredCandidates: accessor.rawCandidates[0]!.offeredCandidates };
    Object.defineProperty(accessorRow, "partIds", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must remain inert");
      },
    });
    accessor.rawCandidates[0] = accessorRow as RawCandidate;
    expect(() => inspectRealBuildStepOneProperC4Quotient(accessor)).toThrow(/data property/u);
    expect(getterCalls).toBe(0);

    const aliasedRow = currentControl();
    aliasedRow.rawCandidates[1] = aliasedRow.rawCandidates[0]!;
    expect(() => inspectRealBuildStepOneProperC4Quotient(aliasedRow)).toThrow(
      /shared mutable container alias/u,
    );

    const aliasedIds = currentControl();
    aliasedIds.rawCandidates[1]!.partIds = aliasedIds.rawCandidates[0]!.partIds;
    expect(() => inspectRealBuildStepOneProperC4Quotient(aliasedIds)).toThrow(
      /shared mutable container alias/u,
    );

    const unbranded = currentControl();
    const structuralClone = {
      ...unbranded.rawCandidates[0]!.offeredCandidates[0],
      transform: { ...unbranded.rawCandidates[0]!.offeredCandidates[0].transform },
    };
    unbranded.rawCandidates[0]!.offeredCandidates = [
      structuralClone as RealBuildEnumeratedPlacementOffer,
      unbranded.rawCandidates[0]!.offeredCandidates[1],
    ];
    expect(() => inspectRealBuildStepOneProperC4Quotient(unbranded)).toThrow(
      /exact immutable enumerator snapshot/u,
    );
  });

  it("retains no mutable caller aliases and brands only the frozen result", () => {
    const input = currentControl();
    const sharedFirstOffer = input.rawCandidates[0]!.offeredCandidates[0];
    expect(input.rawCandidates[1]!.offeredCandidates[0]).toBe(sharedFirstOffer);
    const result = inspectRealBuildStepOneProperC4Quotient(input);
    const before = result.quotientDigest;

    input.rawCandidates[0]!.partIds[0] = "caller-mutated-part";
    input.rawCandidates[0]!.offeredCandidates = input.rawCandidates[1]!.offeredCandidates;
    expect(result.rawRoster[0]!.partIds[0]).not.toBe("caller-mutated-part");
    expect(result.quotientDigest).toBe(before);
    expect(Object.isFrozen(sharedFirstOffer)).toBe(true);
    expect(Object.isFrozen(sharedFirstOffer.transform)).toBe(true);
    expect(Object.isFrozen(sharedFirstOffer.transform.positionLdu)).toBe(true);
    expect(() => {
      (sharedFirstOffer.transform.positionLdu as unknown as number[])[0] = 999;
    }).toThrow(TypeError);
    const retainedSecond = result.rawRoster[0]!.offeredCandidates[1];
    expect(Object.isFrozen(retainedSecond.connections)).toBe(true);
    expect(Object.isFrozen(retainedSecond.connections[0])).toBe(true);
    expect(() => {
      (retainedSecond.connections[0] as { targetPartId: string }).targetPartId = "mutated";
    }).toThrow(TypeError);
    expect(() => requireRealBuildStepOneProperC4QuotientInspection({ ...result })).toThrow(
      /exact frozen inspection/u,
    );
  });

  it("enforces the exact empty root, exact prepared declarations, and 128-orbit ceiling", () => {
    const nonempty = currentControl();
    nonempty.rootDocumentSnapshot = preparedSearchParent().documentSnapshot;
    expect(() => inspectRealBuildStepOneProperC4Quotient(nonempty)).toThrow(/exact branded empty/u);

    const forgedPrepared = currentControl();
    forgedPrepared.preparedStep = { ...forgedPrepared.preparedStep };
    expect(() => inspectRealBuildStepOneProperC4Quotient(forgedPrepared)).toThrow(
      /exact non-authoritative result/u,
    );

    const onePiece = currentControl();
    onePiece.preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
    expect(() => inspectRealBuildStepOneProperC4Quotient(onePiece)).toThrow(/two step-1 pieces/u);

    const oversized = syntheticProperOrbits(129);
    expect(() => inspectRealBuildStepOneProperC4Quotient(oversized)).toThrow(
      /129 groups above 128/u,
    );
  });
});
