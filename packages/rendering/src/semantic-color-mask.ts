import { Mesh, MeshBasicMaterial, type Material, type Object3D } from "three";

import type { DerivedBrickScene } from "./types.ts";

export const SEMANTIC_COLOR_MASK_TARGET_HEX = 0x00ffff as const;
export const SEMANTIC_COLOR_MASK_OTHER_HEX = 0x202020 as const;

export interface SemanticColorMaskMaterials {
  readonly target: MeshBasicMaterial;
  readonly other: MeshBasicMaterial;
}

export interface SemanticColorMaskClassification {
  readonly targetColorIds: readonly string[];
  readonly targetPartIds: readonly string[];
  readonly otherPartIds: readonly string[];
}

interface MaterialRecord {
  readonly object: Mesh;
  readonly material: Material | Material[];
}

interface VisibilityRecord {
  readonly object: Object3D;
  readonly visible: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function requireSemanticColorMaskTargetIds(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32)
    throw new RangeError("Semantic color mask targetColorIds must contain 1..32 entries.");
  const copy = [...value];
  for (const [index, colorId] of copy.entries()) {
    if (typeof colorId !== "string" || colorId.length < 1 || colorId.length > 128)
      throw new TypeError(
        `Semantic color mask targetColorIds[${index}] must be a non-empty string of at most 128 characters.`,
      );
    if (index > 0 && compareStrings(copy[index - 1]!, colorId) >= 0)
      throw new TypeError(
        "Semantic color mask targetColorIds must be strictly sorted and duplicate-free.",
      );
  }
  return Object.freeze(copy);
}

function requireSemanticMaterial(material: MeshBasicMaterial, role: string): void {
  if (
    !(material instanceof MeshBasicMaterial) ||
    material.userData.renderRole !== role ||
    material.vertexColors ||
    material.toneMapped ||
    material.color.getHex() !==
      (role === "semantic-color-mask-target"
        ? SEMANTIC_COLOR_MASK_TARGET_HEX
        : SEMANTIC_COLOR_MASK_OTHER_HEX)
  )
    throw new TypeError(
      `Semantic color mask ${role} must be an unlit, un-tonemapped, non-vertex-colored MeshBasicMaterial.`,
    );
}

export function createSemanticColorMaskMaterials(): SemanticColorMaskMaterials {
  const target = new MeshBasicMaterial({ color: SEMANTIC_COLOR_MASK_TARGET_HEX });
  target.name = "semantic-color-mask:target";
  target.toneMapped = false;
  target.userData = { renderRole: "semantic-color-mask-target" };
  const other = new MeshBasicMaterial({ color: SEMANTIC_COLOR_MASK_OTHER_HEX });
  other.name = "semantic-color-mask:other";
  other.toneMapped = false;
  other.userData = { renderRole: "semantic-color-mask-other" };
  return Object.freeze({ target, other });
}

export function disposeSemanticColorMaskMaterials(materials: SemanticColorMaskMaterials): void {
  materials.target.dispose();
  materials.other.dispose();
}

/**
 * Draws one projection as an exact color-ID class mask without mutating its
 * geometry, camera, transforms, or owned materials.
 */
export function withSemanticColorIdMask<T>(input: {
  readonly projection: DerivedBrickScene;
  readonly targetColorIds: readonly string[];
  readonly materials: SemanticColorMaskMaterials;
  readonly capture: (classification: SemanticColorMaskClassification) => T;
}): T {
  if (input.projection.disposed || input.projection.partObjects.size === 0)
    throw new Error("Semantic color mask requires one live, non-empty derived brick scene.");
  if (typeof input.capture !== "function")
    throw new TypeError("Semantic color mask requires a synchronous capture callback.");
  requireSemanticMaterial(input.materials.target, "semantic-color-mask-target");
  requireSemanticMaterial(input.materials.other, "semantic-color-mask-other");
  const targetColorIds = requireSemanticColorMaskTargetIds(input.targetColorIds);
  const targetSet = new Set(targetColorIds);
  const seenColors = new Set<string>();
  const targetPartIds: string[] = [];
  const otherPartIds: string[] = [];
  const materialRecords: MaterialRecord[] = [];
  const visibilityRecords: VisibilityRecord[] = [];

  try {
    for (const [partId, partObject] of input.projection.partObjects) {
      const colorId = partObject.userData.colorId;
      if (typeof colorId !== "string" || colorId.length === 0)
        throw new TypeError(`Semantic color mask part ${partId} has no exact colorId.`);
      seenColors.add(colorId);
      const target = targetSet.has(colorId);
      (target ? targetPartIds : otherPartIds).push(partId);
      partObject.traverse((object) => {
        if (object instanceof Mesh) {
          materialRecords.push({ object, material: object.material });
          object.material = target ? input.materials.target : input.materials.other;
          return;
        }
        if (
          object.userData.renderRole === "instruction-outline" ||
          object.userData.renderRole === "selection-overlay" ||
          object.userData.renderRole === "validation-overlay"
        ) {
          visibilityRecords.push({ object, visible: object.visible });
          object.visible = false;
        }
      });
    }
    const missing = targetColorIds.filter((colorId) => !seenColors.has(colorId));
    if (missing.length > 0)
      throw new TypeError(
        `Semantic color mask target colors are absent from the exact projection: ${missing.join(", ")}.`,
      );
    const classification = Object.freeze({
      targetColorIds,
      targetPartIds: Object.freeze(targetPartIds.sort(compareStrings)),
      otherPartIds: Object.freeze(otherPartIds.sort(compareStrings)),
    });
    return input.capture(classification);
  } finally {
    for (let index = materialRecords.length - 1; index >= 0; index -= 1) {
      const record = materialRecords[index]!;
      record.object.material = record.material;
    }
    for (let index = visibilityRecords.length - 1; index >= 0; index -= 1) {
      const record = visibilityRecords[index]!;
      record.object.visible = record.visible;
    }
  }
}
