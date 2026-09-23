import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { validBrickConnections, validateBrickDocument } from "./validation.ts";

interface SideProfileCase {
  readonly label: string;
  readonly sourceCatalogPartId: string;
  readonly receiverPositionLdu: readonly [number, number, number];
}

const SIDE_PROFILE_CASES: readonly SideProfileCase[] = [
  {
    label: "p/stud2 hollow side stud on 28802",
    sourceCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    receiverPositionLdu: [-30, 0, -26],
  },
  {
    label: "p/stud solid side stud on 41682",
    sourceCatalogPartId: "builtin:bracket-2x2-1x2-vertical-studs",
    receiverPositionLdu: [-10, -4, -16],
  },
];

function documentWith(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "measured-side-profile",
    name: "Measured side-stud profile gate",
  });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function sideProfileAssembly(testCase: SideProfileCase) {
  const source = createPartInstance({
    id: "source",
    catalogPartId: testCase.sourceCatalogPartId,
  });
  const receiver = createPartInstance({
    id: "receiver",
    catalogPartId: "builtin:technic-brick-1x1-axle-hole",
    transform: {
      positionLdu: testCase.receiverPositionLdu,
      orientationId: "proper-m-00nn000p0",
    },
  });
  const edge: ConnectionEdge = {
    id: "edge",
    kind: "stud-tube",
    a: { partId: source.id, portId: "stud:0" },
    b: { partId: receiver.id, portId: "undersideClutch:0" },
    provenance: { source: "manual" },
  };
  return { source, receiver, edge };
}

describe("axis-aware measured nominal stud connection profiles", () => {
  it.each(SIDE_PROFILE_CASES)(
    "admits $label only for the exact edge and exact pair",
    (testCase) => {
      const { source, receiver, edge } = sideProfileAssembly(testCase);
      const connected = documentWith([source, receiver], [edge]);

      expect(validBrickConnections(connected)).toEqual([edge]);
      expect(validateBrickDocument(connected)).toMatchObject({
        documentGloballyValid: true,
        issues: [],
      });

      const withoutEdge = validateBrickDocument(documentWith([source, receiver], []));
      expect(withoutEdge.documentGloballyValid).toBe(false);
      expect(withoutEdge.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PART_STUD_BODY_COLLISION",
            partIds: [receiver.id, source.id],
          }),
        ]),
      );

      const blocker = { ...receiver, id: "blocker" };
      const withThirdBody = validateBrickDocument(
        documentWith([source, receiver, blocker], [edge]),
      );
      expect(withThirdBody.documentGloballyValid).toBe(false);
      expect(withThirdBody.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PART_STUD_BODY_COLLISION",
            partIds: [blocker.id, source.id],
          }),
        ]),
      );
    },
  );
});
