import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  projectRealBuildEnumeratedPlacementWitnesses,
  snapshotRealBuildEnumeratedPlacementOffer,
} from "../e2e/real-build-enumerated-placement-witness";

const emptySnapshot = () => {
  const document = createEmptyBrickDocument({ id: "enumerated-witness", name: "Witness root" });
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });
};

const rawOffer = (
  catalogPartId: string,
  positionLdu: [number, number, number],
  connections: {
    targetPartId: string;
    targetPortId: string;
    candidatePortId: string;
  }[],
  restsOnBuildPlate: boolean,
) => ({
  catalogPartId,
  transform: { positionLdu, orientationId: "upright-yaw-0" },
  connections,
  restsOnBuildPlate,
});

describe("enumerated placement compiler witnesses", () => {
  it("maps provisional part IDs to ordered witness references and compiles the exact branch", () => {
    const first = snapshotRealBuildEnumeratedPlacementOffer(
      rawOffer("builtin:brick-1x1", [0, 0, 0], [], true),
    );
    const second = snapshotRealBuildEnumeratedPlacementOffer(
      rawOffer(
        "builtin:brick-1x1",
        [0, -24, 0],
        [
          {
            targetPartId: "provisional-part-1",
            targetPortId: "stud:0:0",
            candidatePortId: "undersideClutch:0:0",
          },
        ],
        false,
      ),
    );
    const documentSnapshot = emptySnapshot();
    const witnesses = projectRealBuildEnumeratedPlacementWitnesses({
      documentSnapshot,
      pieces: [
        {
          identityKey: "booklet-piece-1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:red",
        },
        {
          identityKey: "booklet-piece-2",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
        },
      ],
      candidate: {
        partIds: ["provisional-part-1", "provisional-part-2"],
        offeredCandidates: [first, second],
      },
    });

    expect(witnesses[1]?.connections).toEqual([
      {
        target: { kind: "witness", witnessIndex: 0 },
        targetPortId: "stud:0:0",
        candidatePortId: "undersideClutch:0:0",
        connectionKind: "stud-tube",
      },
    ]);
    expect(Object.isFrozen(witnesses)).toBe(true);
    expect(Object.isFrozen(witnesses[1]?.connections)).toBe(true);

    const compiled = compileRealBuildAutomaticPlacement({
      documentSnapshot,
      printedStepNumber: 1,
      printedStep: {
        name: "Printed step 1",
        sourceActionDigest: `sha256:${"1".repeat(64)}`,
      },
      witnesses,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.document.parts).toHaveLength(2);
    expect(compiled.document.connections).toHaveLength(1);
    expect(compiled.document.steps[0]?.partIds).toHaveLength(2);
  });

  it("detaches nested enumerator facts before producer mutation", () => {
    const source = rawOffer(
      "builtin:brick-1x1",
      [0, -24, 0],
      [
        {
          targetPartId: "provisional-part-1",
          targetPortId: "stud:0:0",
          candidatePortId: "undersideClutch:0:0",
        },
      ],
      false,
    );
    const snapshot = snapshotRealBuildEnumeratedPlacementOffer(source);
    source.catalogPartId = "attacker:changed";
    source.transform.positionLdu[1] = 999;
    source.connections[0]!.targetPartId = "attacker-parent";
    source.connections.push({
      targetPartId: "attacker-extra",
      targetPortId: "port",
      candidatePortId: "port",
    });

    expect(snapshot).toEqual({
      catalogPartId: "builtin:brick-1x1",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      connections: [
        {
          targetPartId: "provisional-part-1",
          targetPortId: "stud:0:0",
          candidatePortId: "undersideClutch:0:0",
        },
      ],
      restsOnBuildPlate: false,
    });
    expect(Object.isFrozen(snapshot.transform.positionLdu)).toBe(true);
    expect(Object.isFrozen(snapshot.connections[0])).toBe(true);
  });

  it("refuses unknown, future, disconnected, and unbranded witness evidence", () => {
    const first = snapshotRealBuildEnumeratedPlacementOffer(
      rawOffer("builtin:brick-1x1", [0, 0, 0], [], true),
    );
    const offer = (targetPartId: string, restsOnBuildPlate = false) =>
      snapshotRealBuildEnumeratedPlacementOffer(
        rawOffer(
          "builtin:brick-1x1",
          [0, -24, 0],
          [
            {
              targetPartId,
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
            },
          ],
          restsOnBuildPlate,
        ),
      );
    const input = (offeredCandidates: readonly unknown[]) => ({
      documentSnapshot: emptySnapshot(),
      pieces: [
        { identityKey: "one", catalogPartId: "builtin:brick-1x1", colorId: "builtin:red" },
        { identityKey: "two", catalogPartId: "builtin:brick-1x1", colorId: "builtin:blue" },
      ],
      candidate: {
        partIds: ["provisional-part-1", "provisional-part-2"],
        offeredCandidates,
      },
    });

    expect(() =>
      projectRealBuildEnumeratedPlacementWitnesses(input([first, offer("missing")])),
    ).toThrow(/targets unknown part/u);
    expect(() =>
      projectRealBuildEnumeratedPlacementWitnesses(input([first, offer("provisional-part-2")])),
    ).toThrow(/targets future witness/u);
    expect(() =>
      projectRealBuildEnumeratedPlacementWitnesses(
        input([
          first,
          snapshotRealBuildEnumeratedPlacementOffer(
            rawOffer("builtin:brick-1x1", [40, 0, 0], [], false),
          ),
        ]),
      ),
    ).toThrow(/neither a connection nor measured build-plate support/u);
    expect(() =>
      projectRealBuildEnumeratedPlacementWitnesses(
        input([first, rawOffer("builtin:brick-1x1", [0, -24, 0], [], true)]),
      ),
    ).toThrow(/exact immutable enumerator snapshot/u);
  });

  it("refuses aggregate compiler operations before mapping connection targets", () => {
    const connections = Array.from({ length: 1_022 }, (_, index) => ({
      targetPartId: `unknown-${index}`,
      targetPortId: `target-${index}`,
      candidatePortId: `candidate-${index}`,
    }));
    const first = snapshotRealBuildEnumeratedPlacementOffer(
      rawOffer("builtin:brick-1x1", [0, 0, 0], connections, true),
    );
    const second = snapshotRealBuildEnumeratedPlacementOffer(
      rawOffer("builtin:brick-1x1", [0, -24, 0], [], true),
    );
    expect(() =>
      projectRealBuildEnumeratedPlacementWitnesses({
        documentSnapshot: emptySnapshot(),
        pieces: [
          { identityKey: "one", catalogPartId: "builtin:brick-1x1", colorId: "builtin:red" },
          { identityKey: "two", catalogPartId: "builtin:brick-1x1", colorId: "builtin:blue" },
        ],
        candidate: {
          partIds: ["provisional-part-1", "provisional-part-2"],
          offeredCandidates: [first, second],
        },
      }),
    ).toThrow(/1026 .* above the 1024-operation compiler limit/u);
  });

  it("uses fixed descriptors without invoking accessors or ownKeys traps", () => {
    let getterCalls = 0;
    let ownKeysCalls = 0;
    const source = rawOffer("builtin:brick-1x1", [0, 0, 0], [], true);
    const proxy = new Proxy(source, {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("must remain inert");
      },
    });
    expect(snapshotRealBuildEnumeratedPlacementOffer(proxy)).toEqual(
      snapshotRealBuildEnumeratedPlacementOffer(source),
    );
    expect(ownKeysCalls).toBe(0);

    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, "catalogPartId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must remain inert");
      },
    });
    Object.defineProperty(accessor, "transform", { enumerable: true, value: source.transform });
    Object.defineProperty(accessor, "connections", {
      enumerable: true,
      value: source.connections,
    });
    Object.defineProperty(accessor, "restsOnBuildPlate", {
      enumerable: true,
      value: source.restsOnBuildPlate,
    });
    expect(() => snapshotRealBuildEnumeratedPlacementOffer(accessor)).toThrow(/own data property/u);
    expect(getterCalls).toBe(0);
  });
});
