import { describe, expect, it } from "vitest";

import type { BrickDocumentV1, TruthSnapshot } from "@lego-studio/protocol";

import { canonicalBrickDocument, documentStructuralHash, normalizeBrickDocument } from "./document";

const truth: TruthSnapshot = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: { id: "builtin", version: "1", hash: `sha256:${"a".repeat(64)}` },
  connectorTaxonomy: { id: "stud-tube", version: "1", hash: `sha256:${"b".repeat(64)}` },
  collisionModel: { id: "boxes", version: "1", hash: `sha256:${"c".repeat(64)}` },
  transformPolicy: { id: "upright", version: "1", hash: `sha256:${"d".repeat(64)}` },
  validatorSet: { id: "kernel", version: "1", hash: `sha256:${"e".repeat(64)}` },
};

type MutableDeep<T> = T extends readonly [unknown, ...unknown[]]
  ? { -readonly [Key in keyof T]: MutableDeep<T[Key]> }
  : T extends readonly (infer Item)[]
    ? MutableDeep<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: MutableDeep<T[Key]> }
      : T;

function documentFixture(): MutableDeep<BrickDocumentV1> {
  return {
    schemaVersion: "lego.brick-document/1",
    id: "document-1",
    revision: "revision-1",
    truth,
    name: "Two bricks",
    parts: [
      {
        id: "part-b",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-2",
        semanticTags: ["top", "body"],
        provenance: { source: "ai", sourceId: "candidate-1" },
      },
      {
        id: "part-a",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:blue",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: [],
        provenance: { source: "manual" },
      },
    ],
    connections: [
      {
        id: "connection-1",
        kind: "stud-tube",
        a: { partId: "part-a", portId: "stud:0:0" },
        b: { partId: "part-b", portId: "undersideClutch:0:0" },
        provenance: { source: "ai", sourceId: "candidate-1" },
      },
    ],
    submodels: [{ id: "root", name: "Root", partIds: ["part-b", "part-a"] }],
    steps: [
      { id: "step-2", index: 2, name: "Top", partIds: ["part-b"] },
      { id: "step-1", index: 1, name: "Base", partIds: ["part-a"] },
    ],
    semanticRegions: [{ id: "body", label: "Body", partIds: ["part-b", "part-a"] }],
    constraints: {
      maxParts: 100,
      allowedCatalogPartIds: ["builtin:brick-1x2", "builtin:brick-1x1"],
      allowedColorIds: ["builtin:red", "builtin:blue"],
    },
    provenance: { origin: "manual" },
  };
}

describe("BrickDocument canonicalization", () => {
  it("normalizes set-like collections without mutating the authoring document", () => {
    const document = documentFixture();
    const normalized = normalizeBrickDocument(document);

    expect(normalized.parts.map(({ id }) => id)).toEqual(["part-a", "part-b"]);
    expect(normalized.parts[1]?.semanticTags).toEqual(["body", "top"]);
    expect(normalized.steps.map(({ id }) => id)).toEqual(["step-1", "step-2"]);
    expect(normalized.submodels[0]?.partIds).toEqual(["part-a", "part-b"]);
    expect(document.parts[0]?.id).toBe("part-b");
    expect(document.parts[0]?.semanticTags).toEqual(["top", "body"]);
  });

  it("produces identical canonical bytes for equivalent collection ordering", () => {
    const left = documentFixture();
    const right = documentFixture();
    right.parts.reverse();
    right.steps.reverse();
    right.submodels[0]?.partIds.reverse();
    right.constraints.allowedColorIds.reverse();

    expect(canonicalBrickDocument(left)).toBe(canonicalBrickDocument(right));
    expect(documentStructuralHash(left)).toBe(documentStructuralHash(right));
  });

  it("normalizes stud-to-clutch endpoint direction as semantic set identity", () => {
    const studFirst = documentFixture();
    const clutchFirst = documentFixture();
    const connection = clutchFirst.connections[0]!;
    clutchFirst.connections[0] = { ...connection, a: connection.b, b: connection.a };

    expect(canonicalBrickDocument(clutchFirst)).toBe(canonicalBrickDocument(studFirst));
    expect(documentStructuralHash(clutchFirst)).toBe(documentStructuralHash(studFirst));
    expect(normalizeBrickDocument(clutchFirst).connections[0]?.a.portId).toBe("stud:0:0");
  });

  it("excludes cosmetic identity and provenance from structural identity", () => {
    const left = documentFixture();
    const right = documentFixture();
    right.id = "document-copy";
    right.revision = "revision-99";
    right.name = "Renamed";
    right.provenance = { origin: "import", sourceId: "file.ldr" };
    right.parts[0] = {
      ...right.parts[0]!,
      provenance: { source: "manual" },
    };
    right.connections[0] = {
      ...right.connections[0]!,
      provenance: { source: "manual" },
    };
    right.submodels[0] = { ...right.submodels[0]!, name: "Cosmetic rename" };
    right.steps[0] = { ...right.steps[0]!, name: "Cosmetic rename" };

    expect(documentStructuralHash(left)).toBe(documentStructuralHash(right));
    expect(canonicalBrickDocument(left)).not.toBe(canonicalBrickDocument(right));
  });

  it("changes structural identity for authoritative transforms and colors", () => {
    const original = documentFixture();
    const moved = documentFixture();
    moved.parts[0] = {
      ...moved.parts[0]!,
      colorId: "builtin:blue",
      transform: { positionLdu: [20, -24, 0], orientationId: "upright-yaw-0" },
    };

    expect(documentStructuralHash(original)).not.toBe(documentStructuralHash(moved));
  });
});
