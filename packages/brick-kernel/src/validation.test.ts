import { describe, expect, it } from "vitest";

import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { validateValidationReportV1 } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validateBrickDocument } from "./validation";

function withParts(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[] = [],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "document-validation", name: "Validation fixture" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

function connection(id: string, lowerId = "lower", upperId = "upper"): ConnectionEdge {
  return {
    id,
    kind: "stud-tube",
    a: { partId: lowerId, portId: "stud:0:0" },
    b: { partId: upperId, portId: "undersideClutch:0:0" },
    provenance: { source: "manual" },
  };
}

function validStack(): BrickDocumentV1 {
  const lower = createPartInstance({ id: "lower" });
  const upper = createPartInstance({
    id: "upper",
    colorId: "builtin:blue",
    transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
  });
  return withParts([lower, upper], [connection("connection-1")]);
}

function codes(document: BrickDocumentV1): string[] {
  return validateBrickDocument(document).issues.map(({ code }) => code);
}

describe("hard document validation", () => {
  it("accepts empty, single-part, and connected face-touching assemblies", () => {
    const empty = createEmptyBrickDocument({ id: "empty", name: "Empty" });
    const single = withParts([createPartInstance({ id: "only" })]);

    for (const document of [empty, single, validStack()]) {
      const report = validateBrickDocument(document);
      expect(report.issues).toEqual([]);
      expect(report.documentGloballyValid).toBe(true);
      expect(
        validateValidationReportV1(report),
        validateValidationReportV1.errors?.[0]?.message,
      ).toBe(true);
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(report.issues)).toBe(true);
    }
  });

  it("rejects duplicate and dangling graph identities", () => {
    const duplicateParts = [
      createPartInstance({ id: "same" }),
      createPartInstance({
        id: "same",
        transform: { positionLdu: [20, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ];
    const duplicate = {
      ...withParts(duplicateParts),
      submodels: [{ id: "root", name: "Root", partIds: ["same"] }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: ["same"] }],
    } satisfies BrickDocumentV1;
    expect(codes(duplicate)).toContain("DUPLICATE_PART_ID");

    const dangling = withParts(
      [createPartInstance({ id: "lower" })],
      [connection("dangling", "lower", "missing")],
    );
    expect(codes(dangling)).toContain("DANGLING_CONNECTION_PART");
  });

  it("rejects duplicate build-step indices", () => {
    const base = createEmptyBrickDocument({ id: "duplicate-step-index", name: "Duplicate step" });
    const document: BrickDocumentV1 = {
      ...base,
      steps: [
        { id: "step-a", index: 0, name: "First", partIds: [] },
        { id: "step-b", index: 0, name: "Second", partIds: [] },
      ],
    };

    expect(codes(document)).toContain("DUPLICATE_STEP_INDEX");
    expect(validateValidationReportV1(validateBrickDocument(document))).toBe(true);
  });

  it("rejects unknown catalog truth, color, and legal orientation", () => {
    const badCatalog = withParts([
      createPartInstance({ id: "bad", catalogPartId: "builtin:not-a-part" }),
    ]);
    expect(codes(badCatalog)).toContain("CATALOG_PART_NOT_ALLOWED");

    const badColor = withParts([createPartInstance({ id: "bad", colorId: "builtin:purple" })]);
    expect(codes(badColor)).toContain("COLOR_NOT_ALLOWED");

    const badOrientation = withParts([
      createPartInstance({
        id: "bad",
        transform: { positionLdu: [0, 0, 0], orientationId: "upside-down" },
      }),
    ]);
    expect(codes(badOrientation)).toContain("ILLEGAL_ORIENTATION");

    const invalidAllowlists = createEmptyBrickDocument({
      id: "invalid-allowlists",
      name: "Invalid allowlists",
    });
    expect(
      codes({
        ...invalidAllowlists,
        constraints: {
          ...invalidAllowlists.constraints,
          allowedCatalogPartIds: ["unknown:part"],
          allowedColorIds: ["unknown:color"],
        },
      }),
    ).toEqual(
      expect.arrayContaining(["CATALOG_ALLOWLIST_ENTRY_INVALID", "COLOR_ALLOWLIST_ENTRY_INVALID"]),
    );

    const aliasPart = withParts([
      createPartInstance({ id: "alias", catalogPartId: "ldraw:3005.dat" }),
    ]);
    expect(codes(aliasPart)).toContain("CATALOG_PART_NOT_ALLOWED");
  });

  it("rejects transform-disagreeing edges and occupied ports", () => {
    const mismatched = validStack();
    const movedUpper = createPartInstance({
      id: "upper",
      transform: { positionLdu: [20, -24, 0], orientationId: "upright-yaw-0" },
    });
    expect(codes(withParts([mismatched.parts[0]!, movedUpper], mismatched.connections))).toContain(
      "CONNECTION_TRANSFORM_MISMATCH",
    );

    const upper2 = createPartInstance({
      id: "upper-2",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
    });
    const overCapacity = withParts(
      [mismatched.parts[0]!, mismatched.parts[1]!, upper2],
      [connection("connection-1"), connection("connection-2", "lower", "upper-2")],
    );
    expect(codes(overCapacity)).toContain("PORT_CAPACITY_EXCEEDED");
    expect(
      validateBrickDocument({
        ...overCapacity,
        connections: [...overCapacity.connections].reverse(),
      }),
    ).toEqual(validateBrickDocument(overCapacity));
  });

  it("rejects positive body overlap but permits exact face contact", () => {
    const overlapping = withParts([
      createPartInstance({ id: "left" }),
      createPartInstance({
        id: "right",
        transform: { positionLdu: [10, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ]);
    expect(codes(overlapping)).toContain("PART_BODY_COLLISION");

    const faceTouching = withParts([
      createPartInstance({ id: "left" }),
      createPartInstance({
        id: "right",
        transform: { positionLdu: [20, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ]);
    expect(codes(faceTouching)).not.toContain("PART_BODY_COLLISION");
    expect(codes(faceTouching)).toContain("DISCONNECTED_ASSEMBLY");
  });

  it("requires a validated exact connection before allowing stud penetration", () => {
    const lower = createPartInstance({ id: "lower" });
    const upper = createPartInstance({
      id: "upper",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
    });

    const unconnectedCodes = codes(withParts([lower, upper]));
    expect(unconnectedCodes).toContain("PART_STUD_BODY_COLLISION");

    const connectedCodes = codes(withParts([lower, upper], [connection("exact")]));
    expect(connectedCodes).not.toContain("PART_STUD_BODY_COLLISION");
    expect(connectedCodes).not.toContain("PART_BODY_COLLISION");

    const shiftedUpper = createPartInstance({
      id: "upper",
      transform: { positionLdu: [0, -23, 0], orientationId: "upright-yaw-0" },
    });
    const mismatchedCodes = codes(withParts([lower, shiftedUpper], [connection("mismatched")]));
    expect(mismatchedCodes).toContain("CONNECTION_TRANSFORM_MISMATCH");
    expect(mismatchedCodes).toContain("PART_STUD_BODY_COLLISION");
  });

  it("detects overlapping catalog stud cylinders", () => {
    const document = withParts([
      createPartInstance({ id: "left" }),
      createPartInstance({ id: "right", colorId: "builtin:blue" }),
    ]);

    expect(codes(document)).toEqual(
      expect.arrayContaining(["PART_BODY_COLLISION", "PART_STUD_COLLISION"]),
    );
  });

  it("fails closed when dense geometry exceeds the deterministic collision budget", () => {
    const parts = Array.from({ length: 120 }, (_, index) =>
      createPartInstance({
        id: `dense-${index.toString().padStart(2, "0")}`,
        catalogPartId: "builtin:brick-2x4",
      }),
    );
    const document = withParts(parts);
    const first = validateBrickDocument(document);
    const second = validateBrickDocument(document);

    expect(first).toEqual(second);
    expect(first.documentGloballyValid).toBe(false);
    expect(
      first.issues.some(
        ({ code }) =>
          code === "COLLISION_COMPARISON_BUDGET_EXCEEDED" ||
          code === "COLLISION_FINDING_BUDGET_EXCEEDED",
      ),
    ).toBe(true);
    expect(validateValidationReportV1(first)).toBe(true);
  });

  it("bounds per-issue evidence while preserving a schema-valid report", () => {
    const parts = Array.from({ length: 300 }, (_, index) =>
      createPartInstance({
        id: `separated-${index.toString().padStart(3, "0")}`,
        transform: { positionLdu: [index * 40, 0, 0], orientationId: "upright-yaw-0" },
      }),
    );
    const report = validateBrickDocument(withParts(parts));
    const connectivity = report.issues.find(({ code }) => code === "DISCONNECTED_ASSEMBLY");

    expect(connectivity?.partIds).toHaveLength(256);
    expect(validateValidationReportV1(report)).toBe(true);
  });

  it("truncates issue floods deterministically without violating the report schema", () => {
    const base = createEmptyBrickDocument({
      id: "issue-flood",
      name: "Issue flood",
      maxParts: 10_000,
    });
    const parts = Array.from({ length: 5_100 }, (_, index) =>
      createPartInstance({
        id: `invalid-${index.toString().padStart(4, "0")}`,
        colorId: "builtin:not-a-color",
        transform: { positionLdu: [index * 40, 0, 0], orientationId: "not-an-orientation" },
      }),
    );
    const document: BrickDocumentV1 = {
      ...base,
      parts,
      submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
    };
    const first = validateBrickDocument(document);
    const second = validateBrickDocument(document);

    expect(first).toEqual(second);
    expect(first.issues).toHaveLength(10_000);
    expect(first.issues.map(({ code }) => code)).toContain("VALIDATION_ISSUE_BUDGET_EXCEEDED");
    expect(validateValidationReportV1(first)).toBe(true);
  });

  it("rejects disconnected assemblies and inconsistent membership annotations", () => {
    const disconnected = withParts([
      createPartInstance({ id: "left" }),
      createPartInstance({
        id: "right",
        transform: { positionLdu: [40, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ]);
    expect(codes(disconnected)).toContain("DISCONNECTED_ASSEMBLY");

    const base = createEmptyBrickDocument({ id: "membership", name: "Membership" });
    const part = createPartInstance({ id: "orphan" });
    const inconsistent: BrickDocumentV1 = { ...base, parts: [part] };
    expect(codes(inconsistent)).toEqual(
      expect.arrayContaining(["STEP_MEMBERSHIP_MISMATCH", "SUBMODEL_MEMBERSHIP_MISMATCH"]),
    );
  });

  it("emits deterministically ordered issues and report hashes", () => {
    const document = withParts([
      createPartInstance({ id: "a", colorId: "bad:color" }),
      createPartInstance({
        id: "b",
        transform: { positionLdu: [10, 0, 0], orientationId: "upright-yaw-0" },
      }),
    ]);
    expect(validateBrickDocument(document)).toEqual(validateBrickDocument(document));
    expect(validateBrickDocument(document).targetDocumentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it.each([
    [
      "fractional coordinate",
      (document: BrickDocumentV1) => ({
        ...document,
        parts: [
          {
            ...createPartInstance({ id: "fractional" }),
            transform: { positionLdu: [0, 0.5, 0], orientationId: "upright-yaw-0" },
          },
        ],
      }),
    ],
    [
      "out-of-range coordinate",
      (document: BrickDocumentV1) => ({
        ...document,
        parts: [
          {
            ...createPartInstance({ id: "far-away" }),
            transform: { positionLdu: [10_000_001, 0, 0], orientationId: "upright-yaw-0" },
          },
        ],
      }),
    ],
    [
      "unknown property",
      (document: BrickDocumentV1) => ({ ...document, providerVerdict: "valid" }),
    ],
  ])("fails closed on schema-invalid input: %s", (_label, mutate) => {
    const report = validateBrickDocument(
      mutate(createEmptyBrickDocument({ id: "schema-invalid", name: "Invalid" })),
    );

    expect(report.documentGloballyValid).toBe(false);
    expect(report.patchValid).toBe(false);
    expect(report.issues.map(({ code }) => code)).toEqual(["DOCUMENT_SCHEMA_INVALID"]);
    expect(validateValidationReportV1(report)).toBe(true);
  });

  it("rejects hostile wrappers without rereading them after validation", () => {
    const wrapped = new Proxy(createEmptyBrickDocument({ id: "wrapped", name: "Wrapped" }), {});
    const report = validateBrickDocument(wrapped);

    expect(report.issues.map(({ code }) => code)).toEqual(["DOCUMENT_SCHEMA_INVALID"]);
    expect(validateValidationReportV1(report)).toBe(true);
  });
});
