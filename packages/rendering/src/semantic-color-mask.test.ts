import {
  BoxGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { describe, expect, it, vi } from "vitest";

import {
  createSemanticColorMaskMaterials,
  disposeSemanticColorMaskMaterials,
  SEMANTIC_COLOR_MASK_OTHER_HEX,
  SEMANTIC_COLOR_MASK_TARGET_HEX,
  withSemanticColorIdMask,
} from "./semantic-color-mask.ts";
import type { DerivedBrickScene } from "./types.ts";

function fixture() {
  const root = new Group();
  root.userData.finish = "presentation";
  const partObjects = new Map<string, Group>();
  const createPart = (partId: string, colorId: string) => {
    const part = new Group();
    part.userData = { renderRole: "part", partId, colorId };
    const original = new MeshBasicMaterial({
      color: colorId === "builtin:blue" ? 0x0055bf : 0x6c6e68,
    });
    const body = new Mesh(new BoxGeometry(1, 1, 1), original);
    const outline = new LineSegments(new BoxGeometry(1, 1, 1), new LineBasicMaterial());
    outline.userData.renderRole = "instruction-outline";
    part.add(body, outline);
    root.add(part);
    partObjects.set(partId, part);
    return { part, body, outline, original };
  };
  const blue = createPart("blue-part", "builtin:blue");
  const gray = createPart("gray-part", "builtin:dark-bluish-gray");
  const projection = {
    schemaVersion: "lego.derived-brick-scene/1",
    root,
    partObjects,
    documentHash: `sha256:${"a".repeat(64)}`,
    disposed: false,
  } as unknown as DerivedBrickScene;
  return { projection, blue, gray };
}

describe("semantic color-ID mask", () => {
  it("classifies exact color IDs, hides ink, and restores every original reference", () => {
    const { projection, blue, gray } = fixture();
    const materials = createSemanticColorMaskMaterials();
    const classification = withSemanticColorIdMask({
      projection,
      targetColorIds: ["builtin:blue"],
      materials,
      capture: (value) => {
        expect(blue.body.material).toBe(materials.target);
        expect(gray.body.material).toBe(materials.other);
        expect((blue.body.material as MeshBasicMaterial).color.getHex()).toBe(
          SEMANTIC_COLOR_MASK_TARGET_HEX,
        );
        expect((gray.body.material as MeshBasicMaterial).color.getHex()).toBe(
          SEMANTIC_COLOR_MASK_OTHER_HEX,
        );
        expect(blue.outline.visible).toBe(false);
        expect(gray.outline.visible).toBe(false);
        return value;
      },
    });
    expect(classification).toEqual({
      targetColorIds: ["builtin:blue"],
      targetPartIds: ["blue-part"],
      otherPartIds: ["gray-part"],
    });
    expect(blue.body.material).toBe(blue.original);
    expect(gray.body.material).toBe(gray.original);
    expect(blue.outline.visible).toBe(true);
    expect(gray.outline.visible).toBe(true);
    disposeSemanticColorMaskMaterials(materials);
  });

  it("restores state when capture throws and rejects bad rosters before capture", () => {
    const { projection, blue, gray } = fixture();
    const materials = createSemanticColorMaskMaterials();
    expect(() =>
      withSemanticColorIdMask({
        projection,
        targetColorIds: ["builtin:blue"],
        materials,
        capture: () => {
          throw new Error("capture failed");
        },
      }),
    ).toThrow("capture failed");
    expect(blue.body.material).toBe(blue.original);
    expect(gray.body.material).toBe(gray.original);
    expect(blue.outline.visible).toBe(true);
    expect(gray.outline.visible).toBe(true);

    const capture = vi.fn();
    expect(() =>
      withSemanticColorIdMask({
        projection,
        targetColorIds: ["builtin:blue", "builtin:blue"],
        materials,
        capture,
      }),
    ).toThrow(/strictly sorted and duplicate-free/u);
    expect(() =>
      withSemanticColorIdMask({
        projection,
        targetColorIds: ["builtin:dark-azure"],
        materials,
        capture,
      }),
    ).toThrow(/absent from the exact projection/u);
    expect(capture).not.toHaveBeenCalled();
    disposeSemanticColorMaskMaterials(materials);
  });
});
