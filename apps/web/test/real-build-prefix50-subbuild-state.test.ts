import { BRICK_HEIGHT_LDU } from "@lego-studio/catalog";
import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { isolateRealBuildPrefix50DetachedSubBuild } from "../e2e/real-build-prefix50-subbuild-state";

function partAt(id: string, stepId: string, x: number, y: number): PartInstance {
  return createPartInstance({
    id,
    catalogPartId: "builtin:brick-2x2",
    colorId: id.startsWith("child") ? "builtin:blue" : "builtin:red",
    stepId,
    transform: { positionLdu: [x, y, 0], orientationId: "upright-yaw-0" },
  });
}

function stackConnections(lowerId: string, upperId: string): ConnectionEdge[] {
  return [0, 1].flatMap((x) =>
    [0, 1].map((z) => ({
      id: `edge-${lowerId}-${upperId}-${x}-${z}`,
      kind: "stud-tube" as const,
      a: { partId: lowerId, portId: `stud:${x}:${z}` },
      b: { partId: upperId, portId: `undersideClutch:${x}:${z}` },
      provenance: { source: "manual" as const },
    })),
  );
}

function detachedFixture(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "prefix50-isolation", name: "Isolation" });
  const parts = [
    partAt("parent-lower", "step-1", 0, 0),
    partAt("parent-upper", "step-2", 0, -BRICK_HEIGHT_LDU),
    partAt("child-lower", "step-38", 200, 0),
    partAt("child-upper", "step-38", 200, -BRICK_HEIGHT_LDU),
  ];
  return {
    ...base,
    parts,
    connections: [
      ...stackConnections("parent-lower", "parent-upper"),
      ...stackConnections("child-lower", "child-upper"),
    ],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: [
      { id: "step-1", index: 0, name: "Printed step 1", partIds: ["parent-lower"] },
      { id: "step-2", index: 1, name: "Printed step 2", partIds: ["parent-upper"] },
      {
        id: "step-38",
        index: 37,
        name: "Printed step 38",
        partIds: ["child-lower", "child-upper"],
      },
    ],
  };
}

describe("prefix-50 detached child enumeration state", () => {
  it("returns two exact internally valid component views with no authority", () => {
    const document = detachedFixture();
    const result = isolateRealBuildPrefix50DetachedSubBuild({
      document,
      childPartIds: ["child-upper", "child-lower"],
      completedPrintedStep: 38,
    });

    expect(result).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-detached-subbuild-state/2",
      authority: "none",
      completedPrintedStep: 38,
      parentPartCount: 2,
      childPartCount: 2,
      childPartIds: ["child-lower", "child-upper"],
      combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"],
      crossComponentCollisionFindings: [],
    });
    expect(result.parentDocument.parts.map(({ id }) => id).sort()).toEqual([
      "parent-lower",
      "parent-upper",
    ]);
    expect(result.childDocument.parts.map(({ id }) => id).sort()).toEqual([
      "child-lower",
      "child-upper",
    ]);
    expect(result.parentDocument.connections).toHaveLength(4);
    expect(result.childDocument.connections).toHaveLength(4);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.childDocument)).toBe(true);
  });

  it("admits only collision findings whose two parts cross the detached frame boundary", () => {
    const document = detachedFixture();
    const overlapped = {
      ...document,
      parts: document.parts.map((part) =>
        part.id.startsWith("child")
          ? {
              ...part,
              transform: {
                ...part.transform,
                positionLdu: [0, part.transform.positionLdu[1], 0] as const,
              },
            }
          : part,
      ),
    };
    const result = isolateRealBuildPrefix50DetachedSubBuild({
      document: overlapped,
      childPartIds: ["child-lower", "child-upper"],
      completedPrintedStep: 40,
    });

    expect(result.combinedBlockingCodes).toEqual(
      expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "PART_BODY_COLLISION"]),
    );
    expect(result.crossComponentCollisionFindings.length).toBeGreaterThan(0);
    expect(
      result.crossComponentCollisionFindings.every(
        ({ partIds }) =>
          partIds.some((partId) => partId.startsWith("child")) &&
          partIds.some((partId) => partId.startsWith("parent")),
      ),
    ).toBe(true);

    const internallyOverlapped = {
      ...overlapped,
      parts: overlapped.parts.map((part) =>
        part.id === "child-upper"
          ? {
              ...part,
              transform: overlapped.parts.find(({ id }) => id === "child-lower")!.transform,
            }
          : part,
      ),
    };
    expect(() =>
      isolateRealBuildPrefix50DetachedSubBuild({
        document: internallyOverlapped,
        childPartIds: ["child-lower", "child-upper"],
        completedPrintedStep: 40,
      }),
    ).toThrow(/two internally hard-valid connected components/u);
  });

  it("rejects premature joins, incomplete child membership, and a disconnected child", () => {
    const document = detachedFixture();
    const isolate = (candidate: BrickDocumentV1, childPartIds = ["child-lower", "child-upper"]) =>
      isolateRealBuildPrefix50DetachedSubBuild({
        document: candidate,
        childPartIds,
        completedPrintedStep: 38,
      });

    expect(() => isolate(document, ["child-lower"])).toThrow(/at least two parts/u);
    expect(() => isolate(document, ["child-lower", "missing"])).toThrow(/absent part/u);
    expect(() =>
      isolate({
        ...document,
        connections: document.connections.filter(({ id }) => !id.includes("child-lower")),
      }),
    ).toThrow(/two internally hard-valid connected components/u);
    expect(() =>
      isolate({
        ...document,
        connections: [
          ...document.connections,
          {
            id: "premature-cross-edge",
            kind: "stud-tube",
            a: { partId: "parent-lower", portId: "stud:0:0" },
            b: { partId: "child-upper", portId: "undersideClutch:0:0" },
            provenance: { source: "manual" },
          },
        ],
      }),
    ).toThrow(/premature parent-child connection/u);
  });

  it("is restricted to the authenticated open-window step range", () => {
    const document = detachedFixture();
    for (const completedPrintedStep of [37, 44]) {
      expect(() =>
        isolateRealBuildPrefix50DetachedSubBuild({
          document,
          childPartIds: ["child-lower", "child-upper"],
          completedPrintedStep,
        }),
      ).toThrow(/steps 38 through 43/u);
    }
  });
});
