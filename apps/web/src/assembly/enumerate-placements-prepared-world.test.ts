import {
  applyBuildOperations,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../manual-commands";
import {
  enumeratePlacements,
  enumeratePlacementsInPreparedWorld,
  preparePlacementEnumerationWorld,
  type PlacementEnumerationOptions,
} from "./enumerate-placements";

const STEP_45_ORIENTATION = "proper-m-00pp000p0";

function build(
  placements: readonly {
    readonly catalogPartId: string;
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId?: string;
  }[],
): BrickDocumentV1 {
  let document = createEmptyBrickDocument({
    id: "prepared-enumeration",
    name: "Prepared enumeration fixture",
  });
  for (const placement of placements) {
    document = applyBuildOperations(
      document,
      createPlacePartTransaction(document, {
        catalogPartId: placement.catalogPartId,
        colorId: "builtin:red",
        transform: {
          positionLdu: [...placement.positionLdu],
          orientationId: placement.orientationId ?? "upright-yaw-0",
        },
      }).operations,
    );
  }
  return document;
}

function axleDocument(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "prepared-axle",
    name: "Prepared axle fixture",
  });
  const holder = createPartInstance({
    id: "holder",
    catalogPartId: "builtin:technic-brick-1x2-axle-hole",
    transform: { positionLdu: [0, 0, 0], orientationId: STEP_45_ORIENTATION },
  });
  return {
    ...base,
    parts: [holder],
    connections: [],
    submodels: [{ ...base.submodels[0]!, partIds: [holder.id] }],
    steps: [{ ...base.steps[0]!, partIds: [holder.id] }],
  };
}

function studAndAxleDocument(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "prepared-stud-axle",
    name: "Prepared stud and axle fixture",
  });
  const parts = [
    createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-4x4",
      transform: { positionLdu: [-200, 8, 0], orientationId: "upright-yaw-0" },
    }),
    createPartInstance({
      id: "holder",
      catalogPartId: "builtin:technic-brick-1x2-axle-hole",
      transform: { positionLdu: [200, 0, 0], orientationId: STEP_45_ORIENTATION },
    }),
  ];
  return {
    ...base,
    parts,
    connections: [],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: [{ ...base.steps[0]!, partIds: parts.map(({ id }) => id) }],
  };
}

interface Request {
  readonly catalogPartId: string;
  readonly options?: PlacementEnumerationOptions;
}

interface DifferentialFixture {
  readonly label: string;
  readonly document: BrickDocumentV1;
  readonly requests: readonly Request[];
  readonly assertCoverage: (results: readonly ReturnType<typeof enumeratePlacements>[]) => void;
}

const connectedDocument = build([{ catalogPartId: "builtin:plate-4x4", positionLdu: [0, 8, 0] }]);
const collisionDocument = build([
  { catalogPartId: "builtin:plate-6x6", positionLdu: [0, 8, 0] },
  { catalogPartId: "builtin:brick-2x2", positionLdu: [0, -8, 0] },
]);

const fixtures: readonly DifferentialFixture[] = [
  {
    label: "build-plate",
    document: createEmptyBrickDocument({ id: "prepared-empty", name: "Prepared empty" }),
    requests: [{ catalogPartId: "builtin:brick-2x4" }],
    assertCoverage: ([result]) => {
      expect(result!.counts.rawFromBuildPlate).toBeGreaterThan(0);
      expect(result!.candidates.every(({ restsOnBuildPlate }) => restsOnBuildPlate)).toBe(true);
    },
  },
  {
    label: "connected",
    document: connectedDocument,
    requests: [
      {
        catalogPartId: "builtin:brick-1x2",
        options: { includeBuildPlate: false, orientationIds: ["upright-yaw-0"] },
      },
    ],
    assertCoverage: ([result]) => {
      expect(result!.candidates.length).toBeGreaterThan(0);
      expect(result!.candidates.every(({ connections }) => connections.length > 0)).toBe(true);
    },
  },
  {
    label: "detached",
    document: connectedDocument,
    requests: [
      {
        catalogPartId: "builtin:brick-1x1",
        options: {
          includeBuildPlate: true,
          allowDetached: true,
          orientationIds: ["upright-yaw-0"],
        },
      },
    ],
    assertCoverage: ([result]) => {
      expect(
        result!.candidates.some(
          ({ restsOnBuildPlate, connections }) => restsOnBuildPlate && connections.length === 0,
        ),
      ).toBe(true);
    },
  },
  {
    label: "collision",
    document: collisionDocument,
    requests: [{ catalogPartId: "builtin:brick-2x4", options: { includeBuildPlate: false } }],
    assertCoverage: ([result]) => {
      expect(result!.counts.rejectedColliding).toBeGreaterThan(0);
      expect(result!.counts.accepted).toBeGreaterThan(0);
    },
  },
  {
    label: "axle",
    document: axleDocument(),
    requests: [
      {
        catalogPartId: "builtin:axle-1x3",
        options: { includeBuildPlate: false, orientationIds: [STEP_45_ORIENTATION] },
      },
    ],
    assertCoverage: ([result]) => {
      expect(
        result!.connectorSeedReceipt.some(
          ({ targetKind, candidateKind, axisCompatibleSeeds }) =>
            targetKind === "axleHole" && candidateKind === "axle" && axisCompatibleSeeds > 0,
        ),
      ).toBe(true);
    },
  },
  {
    label: "multiple-orientation",
    document: connectedDocument,
    requests: [
      {
        catalogPartId: "builtin:brick-1x3",
        options: {
          includeBuildPlate: false,
          orientationIds: ["upright-yaw-270", "upright-yaw-0", "upright-yaw-90"],
        },
      },
    ],
    assertCoverage: ([result]) => {
      expect(result!.orientationIds).toEqual([
        "upright-yaw-270",
        "upright-yaw-0",
        "upright-yaw-90",
      ]);
      expect(new Set(result!.candidates.map(({ transform }) => transform.orientationId)).size).toBe(
        3,
      );
    },
  },
];

describe("prepared placement enumeration worlds", () => {
  it.each(fixtures)(
    "returns the complete fresh-enumeration result for $label cases",
    ({ document, requests, assertCoverage }) => {
      const fresh = requests.map(({ catalogPartId, options }) =>
        enumeratePlacements(document, catalogPartId, options),
      );
      const prepared = preparePlacementEnumerationWorld(document);
      const reused = requests.map(({ catalogPartId, options }) =>
        enumeratePlacementsInPreparedWorld(prepared, catalogPartId, options),
      );

      expect(reused).toEqual(fresh);
      assertCoverage(reused);
    },
  );

  it("preserves complete seed receipts and candidate order across mixed repeated requests", () => {
    const document = studAndAxleDocument();
    const requests: readonly Request[] = [
      {
        catalogPartId: "builtin:brick-1x1",
        options: {
          includeBuildPlate: false,
          orientationIds: ["upright-yaw-0"],
        },
      },
      {
        catalogPartId: "builtin:axle-1x3",
        options: { includeBuildPlate: false, orientationIds: [STEP_45_ORIENTATION] },
      },
    ];
    const fresh = requests.map(({ catalogPartId, options }) =>
      enumeratePlacements(document, catalogPartId, options),
    );
    const prepared = preparePlacementEnumerationWorld(document);
    const first = requests.map(({ catalogPartId, options }) =>
      enumeratePlacementsInPreparedWorld(prepared, catalogPartId, options),
    );
    const second = [...requests]
      .reverse()
      .map(({ catalogPartId, options }) =>
        enumeratePlacementsInPreparedWorld(prepared, catalogPartId, options),
      )
      .reverse();

    expect(first).toEqual(fresh);
    expect(second).toEqual(fresh);
    expect(second.map(({ connectorSeedReceipt }) => connectorSeedReceipt)).toEqual(
      fresh.map(({ connectorSeedReceipt }) => connectorSeedReceipt),
    );
    expect(second.map(({ candidates }) => candidates)).toEqual(
      fresh.map(({ candidates }) => candidates),
    );
    expect(first[0]!.connectorSeedReceipt.some(({ targetKind }) => targetKind === "stud")).toBe(
      true,
    );
    expect(first[1]!.connectorSeedReceipt.some(({ targetKind }) => targetKind === "axleHole")).toBe(
      true,
    );
  });

  it("owns a recursively frozen ordered snapshot instead of aliasing caller mutations", () => {
    const original = structuredClone(connectedDocument);
    const prepared = preparePlacementEnumerationWorld(original);
    const options = {
      includeBuildPlate: false,
      orientationIds: ["upright-yaw-0"],
    } as const;
    const before = enumeratePlacementsInPreparedWorld(prepared, "builtin:brick-1x1", options);
    const mutablePart = original.parts[0]!;
    const extra = createPartInstance({
      id: "late-caller-part",
      catalogPartId: "builtin:brick-1x1",
      transform: { positionLdu: [800, 0, 0], orientationId: "upright-yaw-0" },
    });
    (mutablePart.transform.positionLdu as [number, number, number])[0] = 600;
    (original.parts as PartInstance[]).push(extra);
    (original.connections as ConnectionEdge[]).push({
      id: "late-caller-connection",
      kind: "stud-tube",
      a: { partId: mutablePart.id, portId: "stud:0:0" },
      b: { partId: extra.id, portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    });

    const after = enumeratePlacementsInPreparedWorld(prepared, "builtin:brick-1x1", options);
    expect(after).toEqual(before);
    expect(prepared.document.parts).toHaveLength(1);
    expect(prepared.document.connections).toEqual([]);
    expect(prepared.document.parts[0]!.transform.positionLdu).toEqual([0, 8, 0]);
    expect(Object.isFrozen(prepared.document)).toBe(true);
    expect(Object.isFrozen(prepared.document.parts)).toBe(true);
    expect(Object.isFrozen(prepared.document.parts[0]!.transform.positionLdu)).toBe(true);
  });

  it("rejects observed reuse without making later unobserved results history-dependent", () => {
    const document = studAndAxleDocument();
    const prepared = preparePlacementEnumerationWorld(document);
    const studOptions = {
      includeBuildPlate: false,
      orientationIds: ["upright-yaw-0"],
    } as const;
    const before = enumeratePlacementsInPreparedWorld(prepared, "builtin:brick-1x1", studOptions);
    let observed = false;
    expect(() =>
      enumeratePlacementsInPreparedWorld(prepared, "builtin:axle-1x3", {
        includeBuildPlate: false,
        orientationIds: [STEP_45_ORIENTATION],
        observeWork: () => {
          observed = true;
        },
      }),
    ).toThrow(/does not accept observeWork.*fresh enumeratePlacements/u);
    expect(observed).toBe(false);
    expect(enumeratePlacementsInPreparedWorld(prepared, "builtin:brick-1x1", studOptions)).toEqual(
      before,
    );

    let freshObserved = false;
    expect(
      enumeratePlacements(document, "builtin:brick-1x1", {
        ...studOptions,
        observeWork: () => {
          freshObserved = true;
        },
      }),
    ).toEqual(enumeratePlacements(document, "builtin:brick-1x1", studOptions));
    expect(freshObserved).toBe(true);
  });

  it("keeps parent collision and connector indexes isolated from a freshly prepared child", () => {
    const parent = createEmptyBrickDocument({ id: "prepared-parent", name: "Prepared parent" });
    const parentPrepared = preparePlacementEnumerationWorld(parent);
    const first = enumeratePlacementsInPreparedWorld(parentPrepared, "builtin:brick-1x1");
    const chosen = first.candidates.find(
      ({ transform }) => transform.positionLdu.join(",") === "0,0,0",
    )!;
    const child = applyBuildOperations(
      parent,
      createPlacePartTransaction(parent, {
        catalogPartId: chosen.catalogPartId,
        colorId: "builtin:red",
        transform: chosen.transform,
      }).operations,
    );
    const childOptions = {
      includeBuildPlate: false,
      orientationIds: ["upright-yaw-0"],
    } as const;
    const freshChild = enumeratePlacements(child, "builtin:brick-1x1", childOptions);
    const preparedChild = enumeratePlacementsInPreparedWorld(
      preparePlacementEnumerationWorld(child),
      "builtin:brick-1x1",
      childOptions,
    );

    expect(preparedChild).toEqual(freshChild);
    expect(
      preparedChild.candidates.some(
        ({ transform }) => transform.positionLdu.join(",") === "0,-24,0",
      ),
    ).toBe(true);
    expect(
      enumeratePlacementsInPreparedWorld(parentPrepared, "builtin:brick-1x1", childOptions),
    ).toEqual(enumeratePlacements(parent, "builtin:brick-1x1", childOptions));
  });

  it("rejects a caller-shaped prepared-world lookalike", () => {
    const document = createEmptyBrickDocument({ id: "prepared-lookalike", name: "Lookalike" });
    expect(() =>
      enumeratePlacementsInPreparedWorld(Object.freeze({ document }), "builtin:brick-1x1"),
    ).toThrow(/world minted for the exact document/u);
  });
});
