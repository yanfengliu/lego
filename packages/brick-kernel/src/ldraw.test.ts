import { describe, expect, it } from "vitest";

import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";

import { normalizeBrickDocument } from "./document";
import { createEmptyBrickDocument, createPartInstance } from "./factory";
import {
  LDRAW_LIMITS,
  LDrawInterchangeError,
  exportBrickDocumentToLDraw,
  importBrickDocumentFromLDraw,
} from "./ldraw";

function goldenDocument(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "golden-stack",
    name: "Golden stack",
    revision: "revision-7",
  });
  const lower = createPartInstance({
    id: "lower",
    semanticTags: ["base"],
  });
  const upper = createPartInstance({
    id: "upper",
    colorId: "builtin:blue",
    transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-90" },
    stepId: "step-2",
    semanticTags: ["top", "accent"],
  });
  const connection: ConnectionEdge = {
    id: "connection-1",
    kind: "stud-tube",
    a: { partId: "lower", portId: "stud:0:0" },
    b: { partId: "upper", portId: "undersideClutch:0:0" },
    provenance: { source: "manual" },
  };

  return {
    ...base,
    provenance: { origin: "manual", sourceId: "fixture:golden" },
    parts: [lower, upper],
    connections: [connection],
    submodels: [
      { id: "root", name: "Root", partIds: ["lower", "upper"] },
      { id: "detail", name: "Detail", partIds: [] },
    ],
    steps: [
      { id: "step-1", index: 0, name: "Base", partIds: ["lower"] },
      { id: "step-2", index: 1, name: "Top", partIds: ["upper"] },
    ],
    semanticRegions: [{ id: "region-body", label: "Body", partIds: ["lower", "upper"] }],
  };
}

const GOLDEN_MPD = `${[
  "0 FILE main.ldr",
  "0 Name: main.ldr",
  "0 !BRICK-STUDIO FORMAT lego.ldraw-subset/1",
  "0 !BRICK-STUDIO DOCUMENT golden-stack revision-7 manual fixture:golden x476f6c64656e20737461636b",
  "0 !BRICK-STUDIO COUNTS 2 2 2 1 1",
  "0 !BRICK-STUDIO CONSTRAINTS builtin 500",
  "0 !BRICK-STUDIO SUBMODEL 0 detail x44657461696c submodel-0000.ldr",
  "0 !BRICK-STUDIO SUBMODEL 1 root x526f6f74 submodel-0001.ldr",
  "0 !BRICK-STUDIO STEP 0 step-1 x42617365",
  "0 !BRICK-STUDIO STEP 1 step-2 x546f70",
  "0 !BRICK-STUDIO REGION region-body x426f6479 lower,upper",
  "0 !BRICK-STUDIO CONNECTION connection-1 lower stud:0:0 upper undersideClutch:0:0 manual ~",
  "1 16 0 0 0 1 0 0 0 1 0 0 0 1 submodel-0000.ldr",
  "1 16 0 0 0 1 0 0 0 1 0 0 0 1 submodel-0001.ldr",
  "0 NOFILE",
  "0 FILE submodel-0000.ldr",
  "0 Name: submodel-0000.ldr",
  "0 !BRICK-STUDIO SUBMODEL-USE detail",
  "0 NOFILE",
  "0 FILE submodel-0001.ldr",
  "0 Name: submodel-0001.ldr",
  "0 !BRICK-STUDIO SUBMODEL-USE root",
  "0 !BRICK-STUDIO STEP-USE step-1",
  "0 !BRICK-STUDIO PART lower manual ~ base",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3005.dat",
  "0 STEP",
  "0 !BRICK-STUDIO STEP-USE step-2",
  "0 !BRICK-STUDIO PART upper manual ~ accent,top",
  "1 1 0 -24 0 0 0 1 0 1 0 -1 0 0 3005.dat",
  "0 NOFILE",
].join("\n")}\n`;

function expectImportCode(text: string, code: LDrawInterchangeError["code"]): void {
  try {
    importBrickDocumentFromLDraw(text);
    throw new Error("Expected import to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(LDrawInterchangeError);
    expect((error as LDrawInterchangeError).code).toBe(code);
  }
}

describe("strict LDraw subset", () => {
  it("exports a deterministic golden MPD using catalog identifiers and rigid matrices", () => {
    expect(exportBrickDocumentToLDraw(goldenDocument())).toBe(GOLDEN_MPD);
    expect(exportBrickDocumentToLDraw(goldenDocument())).toBe(
      exportBrickDocumentToLDraw(normalizeBrickDocument(goldenDocument())),
    );
  });

  it("round-trips exact instances, transforms, memberships, and inferred edge identity", () => {
    const source = goldenDocument();
    const imported = importBrickDocumentFromLDraw(exportBrickDocumentToLDraw(source));
    const expected = {
      ...source,
      provenance: imported.provenance,
      parts: source.parts.map((part) => ({ ...part, provenance: imported.parts[0]!.provenance })),
      connections: source.connections.map((connection) => ({
        ...connection,
        provenance: imported.connections[0]!.provenance,
      })),
    };

    expect(normalizeBrickDocument(imported)).toEqual(normalizeBrickDocument(expected));
    expect(imported.provenance.origin).toBe("import");
    expect(imported.parts.every(({ provenance }) => provenance.source === "import")).toBe(true);
    expect(imported.connections.every(({ provenance }) => provenance.source === "import")).toBe(
      true,
    );
    expect(
      imported.parts.map(({ id, transform, submodelId, stepId }) => ({
        id,
        transform,
        submodelId,
        stepId,
      })),
    ).toEqual(
      source.parts.map(({ id, transform, submodelId, stepId }) => ({
        id,
        transform,
        submodelId,
        stepId,
      })),
    );
  });

  it("corrects the asymmetric 91988 local frame in the actual LDraw type-1 matrix", () => {
    const base = createEmptyBrickDocument({ id: "frame-correction", name: "Frame correction" });
    const longPlate = createPartInstance({
      id: "long-plate",
      catalogPartId: "builtin:plate-2x14",
    });
    const source: BrickDocumentV1 = {
      ...base,
      parts: [longPlate],
      submodels: [{ ...base.submodels[0]!, partIds: [longPlate.id] }],
      steps: [{ ...base.steps[0]!, partIds: [longPlate.id] }],
    };

    const exported = exportBrickDocumentToLDraw(source);
    const partLine = exported.split("\n").find((line) => line.endsWith(" 91988.dat"));
    expect(partLine).toBe("1 4 0 0 0 0 0 1 0 1 0 -1 0 0 91988.dat");

    // An LDraw consumer applies the type-1 matrix to raw part coordinates. The
    // official 91988 file's long endpoints lie on local X; the exported matrix
    // must put that axis on canonical Z, alongside the catalog's 2 x 14 body.
    const matrix = partLine!.split(" ").slice(5, 14).map(Number) as unknown as readonly [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const applyType1Matrix = ([x, y, z]: readonly [number, number, number]) => [
      matrix[0] * x + matrix[1] * y + matrix[2] * z,
      matrix[3] * x + matrix[4] * y + matrix[5] * z,
      matrix[6] * x + matrix[7] * y + matrix[8] * z,
    ];
    expect(applyType1Matrix([-140, 0, 0])).toEqual([0, 0, 140]);
    expect(applyType1Matrix([140, 0, 0])).toEqual([0, 0, -140]);

    const imported = importBrickDocumentFromLDraw(exported);
    expect(imported.parts.find(({ id }) => id === longPlate.id)?.transform).toEqual(
      longPlate.transform,
    );
  });

  it("infers every independently occupied port in a multi-stud attachment", () => {
    const base = createEmptyBrickDocument({ id: "multi-stud", name: "Multi stud" });
    const lower = createPartInstance({
      id: "lower",
      catalogPartId: "builtin:brick-2x2",
    });
    const upper = createPartInstance({
      id: "upper",
      catalogPartId: "builtin:brick-2x2",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
    });
    const connections = [0, 1].flatMap((x) =>
      [0, 1].map((z) => ({
        id: `connection-${x}-${z}`,
        kind: "stud-tube" as const,
        a: { partId: "lower", portId: `stud:${x}:${z}` },
        b: { partId: "upper", portId: `undersideClutch:${x}:${z}` },
        provenance: { source: "manual" as const },
      })),
    );
    const document: BrickDocumentV1 = {
      ...base,
      parts: [lower, upper],
      connections,
      submodels: [{ id: "root", name: "Root", partIds: ["lower", "upper"] }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: ["lower", "upper"] }],
    };

    const imported = importBrickDocumentFromLDraw(exportBrickDocumentToLDraw(document));
    const withoutProvenance = ({ id, kind, a, b }: ConnectionEdge) => ({ id, kind, a, b });
    expect(imported.connections.map(withoutProvenance)).toEqual(connections.map(withoutProvenance));
  });

  it("enforces 99563 shared seat capacity during deterministic LDraw inference", () => {
    const tile = createPartInstance({
      id: "tile",
      catalogPartId: "builtin:tile-1x2-chamfered-indented",
    });
    const lower = (id: string, zLdu: number) =>
      createPartInstance({
        id,
        catalogPartId: "builtin:plate-1x1",
        transform: { positionLdu: [0, 8, zLdu], orientationId: "upright-yaw-0" },
      });
    const edge = (lowerId: string, clutchIndex: 0 | 1 | 2): ConnectionEdge => ({
      id: `${lowerId}-to-tile`,
      kind: "stud-tube",
      a: { partId: lowerId, portId: "stud:0:0" },
      b: { partId: tile.id, portId: `undersideClutch:${clutchIndex}` },
      provenance: { source: "manual" },
    });
    const document = (
      id: string,
      lowers: readonly ReturnType<typeof lower>[],
      connections: readonly ConnectionEdge[],
    ): BrickDocumentV1 => {
      const base = createEmptyBrickDocument({ id, name: id });
      const parts = [tile, ...lowers];
      return {
        ...base,
        parts,
        connections,
        submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id: partId }) => partId) }],
        steps: [{ ...base.steps[0]!, partIds: parts.map(({ id: partId }) => partId) }],
      };
    };

    const center = lower("center", 0);
    const centerDocument = document("99563-center", [center], [edge(center.id, 1)]);
    const centerRoundTrip = importBrickDocumentFromLDraw(
      exportBrickDocumentToLDraw(centerDocument),
    );
    expect(centerRoundTrip.connections).toHaveLength(1);
    expect(centerRoundTrip.connections[0]?.b.portId).toBe("undersideClutch:1");

    const negative = lower("negative", -10);
    const positive = lower("positive", 10);
    const outerDocument = document(
      "99563-outers",
      [negative, positive],
      [edge(negative.id, 0), edge(positive.id, 2)],
    );
    const outerMpd = exportBrickDocumentToLDraw(outerDocument);
    const outerRoundTrip = importBrickDocumentFromLDraw(outerMpd);
    expect(outerRoundTrip.connections.map(({ b }) => b.portId)).toEqual([
      "undersideClutch:0",
      "undersideClutch:2",
    ]);

    const centerPartLine = exportBrickDocumentToLDraw(centerDocument)
      .split("\n")
      .find((line) => line.startsWith("1 ") && line.endsWith(" 3024.dat"));
    if (centerPartLine === undefined) throw new Error("Center control omitted the 3024 part line");
    const ambiguousLines = outerMpd.split("\n");
    const negativeMetadataIndex = ambiguousLines.findIndex((line) =>
      line.startsWith("0 !BRICK-STUDIO PART negative "),
    );
    if (negativeMetadataIndex < 0 || ambiguousLines[negativeMetadataIndex + 1] === undefined) {
      throw new Error("Outer control omitted the negative part record");
    }
    ambiguousLines[negativeMetadataIndex + 1] = centerPartLine;
    const ambiguous = ambiguousLines
      .join("\n")
      .replace(
        "negative stud:0:0 tile undersideClutch:0",
        "negative stud:0:0 tile undersideClutch:1",
      );

    expectImportCode(ambiguous, "CONNECTION_MISMATCH");
  });

  it.each([
    [
      "unsupported geometry line",
      GOLDEN_MPD.replace("0 STEP", "2 24 0 0 0 1 1 1"),
      "UNSUPPORTED_LINE",
    ],
    [
      "arbitrary matrix",
      GOLDEN_MPD.replace(
        "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3005.dat",
        "1 4 0 0 0 1 0 0 0 0 -1 0 1 0 3005.dat",
      ),
      "UNSUPPORTED_MATRIX",
    ],
    ["unknown color", GOLDEN_MPD.replace("1 4 0 0 0", "1 99 0 0 0"), "UNSUPPORTED_COLOR"],
    ["unknown part", GOLDEN_MPD.replace("3005.dat", "99999.dat"), "UNSUPPORTED_REFERENCE"],
    ["parent traversal", GOLDEN_MPD.replace("3005.dat", "../3005.dat"), "UNSUPPORTED_REFERENCE"],
    [
      "Windows path",
      GOLDEN_MPD.replace("3005.dat", "C:\\parts\\3005.dat"),
      "UNSUPPORTED_REFERENCE",
    ],
    [
      "external subfile",
      GOLDEN_MPD.replace("submodel-0000.ldr", "external.ldr"),
      "UNSUPPORTED_REFERENCE",
    ],
    [
      "unknown metadata",
      GOLDEN_MPD.replace("0 !BRICK-STUDIO STEP-USE step-1", "0 !LDRAW_ORG Unofficial_Model"),
      "UNSUPPORTED_METADATA",
    ],
  ] as const)("rejects %s", (_label, text, code) => {
    expectImportCode(text, code);
  });

  it("rejects connection metadata that is not reproduced from transforms and ports", () => {
    const tampered = GOLDEN_MPD.replace(
      "lower stud:0:0 upper undersideClutch:0:0",
      "lower stud:0:0 upper undersideClutch:0:1",
    );
    expectImportCode(tampered, "CONNECTION_MISMATCH");
  });

  it("reattributes unsealed embedded provenance claims to the local import boundary", () => {
    const hostileClaims = GOLDEN_MPD.replace(
      "golden-stack revision-7 manual fixture:golden",
      "golden-stack revision-7 migration attacker:claim",
    )
      .replace("PART lower manual ~", "PART lower ai attacker:claim")
      .replace("manual ~\n1 16", "template attacker:claim\n1 16");
    const imported = importBrickDocumentFromLDraw(hostileClaims);

    expect(imported.provenance).toMatchObject({ origin: "import" });
    expect(imported.parts.map(({ provenance }) => provenance.source)).toEqual(["import", "import"]);
    expect(imported.connections[0]?.provenance.source).toBe("import");
    expect(imported.provenance.sourceId).toBe(imported.parts[0]?.provenance.sourceId);
  });

  it("rejects malformed and oversized input before attempting file resolution", () => {
    expectImportCode(GOLDEN_MPD.replace("0 NOFILE", "0 NOFILE trailing"), "MALFORMED_INPUT");
    expectImportCode("0".repeat(LDRAW_LIMITS.maxBytes + 1), "LIMIT_EXCEEDED");
    const tooManyTags = Array.from(
      { length: 33 },
      (_, index) => `tag-${String(index).padStart(2, "0")}`,
    ).join(",");
    expectImportCode(
      GOLDEN_MPD.replace(
        "0 !BRICK-STUDIO PART lower manual ~ base",
        `0 !BRICK-STUDIO PART lower manual ~ ${tooManyTags}`,
      ),
      "LIMIT_EXCEEDED",
    );
  });

  it("rejects unsupported documents instead of silently dropping information", () => {
    const unknownPart = goldenDocument();
    const badPart: BrickDocumentV1 = {
      ...unknownPart,
      parts: [{ ...unknownPart.parts[0]!, catalogPartId: "external:3005" }, unknownPart.parts[1]!],
    };
    expect(() => exportBrickDocumentToLDraw(badPart)).toThrowError(LDrawInterchangeError);

    const incompleteEdges: BrickDocumentV1 = { ...goldenDocument(), connections: [] };
    expect(() => exportBrickDocumentToLDraw(incompleteEdges)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_DOCUMENT" }),
    );

    const duplicateStepIndices: BrickDocumentV1 = {
      ...createEmptyBrickDocument({ id: "duplicate-step", name: "Duplicate step" }),
      steps: [
        { id: "step-a", index: 0, name: "First", partIds: [] },
        { id: "step-b", index: 0, name: "Second", partIds: [] },
      ],
    };
    expect(() => exportBrickDocumentToLDraw(duplicateStepIndices)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_DOCUMENT" }),
    );

    expect(() =>
      exportBrickDocumentToLDraw({ ...goldenDocument(), name: "lone-\ud800-surrogate" }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_DOCUMENT" }));
  });
});
