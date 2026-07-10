import {
  STUD_HEIGHT_LDU,
  STUD_RADIUS_LDU,
  getColorDefinition,
  type LduBounds,
  type PartDefinition,
} from "@lego-studio/catalog";
import type { PartInstance } from "@lego-studio/protocol";
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { THREE_UNITS_PER_LDU, lduToThreeVector } from "./coordinates.ts";
import type { RenderDiagnostic } from "./types.ts";

const FALLBACK_COLOR = 0xff2bd6;
const PLACEHOLDER_BOUNDS: LduBounds = { min: [-10, -10, -10], max: [10, 10, 10] };

function geometryMetadata(definition: PartDefinition) {
  return {
    generatorId: definition.geometry.generatorId,
    geometryContentHash: definition.geometry.contentHash,
    catalogPartId: definition.id,
    provenanceSourceId: definition.geometry.provenance.sourceId,
    externalGeometryBundled: definition.geometry.provenance.externalGeometryBundled,
  };
}

function makeMaterial(part: PartInstance, diagnostics: RenderDiagnostic[]): MeshStandardMaterial {
  const color = getColorDefinition(part.colorId);
  if (!color) {
    diagnostics.push({
      code: "UNKNOWN_COLOR",
      message: `Part ${part.id} uses unknown display color ${part.colorId}`,
      partId: part.id,
    });
  }

  const material = new MeshStandardMaterial({
    color: color?.displayHex ?? FALLBACK_COLOR,
    metalness: 0,
    roughness: 0.42,
  });
  material.name = `brick-material:${part.id}`;
  material.userData = {
    renderRole: "part-material",
    colorId: part.colorId,
    fallback: color === undefined,
  };
  return material;
}

export function createCatalogPartGeometry(
  part: PartInstance,
  definition: PartDefinition,
  includeStuds: boolean,
  diagnostics: RenderDiagnostic[],
): Group {
  const group = new Group();
  const metadata = geometryMetadata(definition);
  const material = makeMaterial(part, diagnostics);
  const { widthLdu, heightLdu, lengthLdu } = definition.dimensions;
  const bodyGeometry = new BoxGeometry(
    widthLdu * THREE_UNITS_PER_LDU,
    heightLdu * THREE_UNITS_PER_LDU,
    lengthLdu * THREE_UNITS_PER_LDU,
  );
  bodyGeometry.userData = { ...metadata, renderRole: "body-geometry" };
  const body = new Mesh(bodyGeometry, material);
  body.name = `body:${part.id}`;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData = { renderRole: "body", partId: part.id };
  group.add(body);

  if (includeStuds) {
    const studGeometry = new CylinderGeometry(
      STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
      STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
      STUD_HEIGHT_LDU * THREE_UNITS_PER_LDU,
      24,
      1,
      false,
    );
    studGeometry.userData = { ...metadata, renderRole: "stud-geometry" };

    for (const primitive of definition.collision.primitives) {
      if (primitive.kind !== "cylinder" || primitive.tag !== "stud") continue;
      const stud = new Mesh(studGeometry, material);
      stud.name = `${primitive.id}:${part.id}`;
      stud.position.copy(lduToThreeVector(primitive.centerLdu));
      stud.castShadow = true;
      stud.receiveShadow = true;
      stud.userData = {
        renderRole: "stud",
        partId: part.id,
        primitiveId: primitive.id,
      };
      group.add(stud);
    }
  }

  return group;
}

export function createPlaceholderGeometry(part: PartInstance): Group {
  const group = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.userData = { renderRole: "placeholder-geometry" };
  const material = new MeshBasicMaterial({ color: FALLBACK_COLOR, wireframe: true });
  material.userData = { renderRole: "placeholder-material" };
  const mesh = new Mesh(geometry, material);
  mesh.name = `placeholder:${part.id}`;
  mesh.userData = { renderRole: "placeholder", partId: part.id };
  group.add(mesh);
  return group;
}

function boundsCenter(bounds: LduBounds): readonly [number, number, number] {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

export function createPartOverlay(
  partId: string,
  renderRole: "selection-overlay" | "validation-overlay",
  bounds: LduBounds = PLACEHOLDER_BOUNDS,
): LineSegments {
  const width = (bounds.max[0] - bounds.min[0]) * THREE_UNITS_PER_LDU;
  const height = (bounds.max[1] - bounds.min[1]) * THREE_UNITS_PER_LDU;
  const depth = (bounds.max[2] - bounds.min[2]) * THREE_UNITS_PER_LDU;
  const sourceGeometry = new BoxGeometry(width, height, depth);
  const geometry = new EdgesGeometry(sourceGeometry);
  sourceGeometry.dispose();
  geometry.userData = { renderRole: `${renderRole}-geometry` };
  const material = new LineBasicMaterial({
    color: renderRole === "selection-overlay" ? 0x43d9ff : 0xff3d52,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  material.userData = { renderRole: `${renderRole}-material` };
  const overlay = new LineSegments(geometry, material);
  overlay.name = `${renderRole}:${partId}`;
  overlay.position.copy(lduToThreeVector(boundsCenter(bounds)));
  overlay.renderOrder = renderRole === "selection-overlay" ? 100 : 101;
  overlay.userData = { renderRole, partId };
  return overlay;
}

export const PLACEHOLDER_PART_BOUNDS = PLACEHOLDER_BOUNDS;
