import {
  STUD_HEIGHT_LDU,
  STUD_RADIUS_LDU,
  getColorDefinition,
  type CollisionWedge,
  type LduBounds,
  type PartDefinition,
} from "@lego-studio/catalog";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

import { INSTRUCTION_EDGE_HEX, INSTRUCTION_EDGE_THRESHOLD_DEGREES } from "./constants.ts";
import { THREE_UNITS_PER_LDU, lduToThreeVector, lduTransformToThreeMatrix } from "./coordinates.ts";
import type { BrickFinish, RenderDiagnostic } from "./types.ts";

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

/** A real brick's edges are chamfered, which is what catches a highlight. */
const BEVEL_LDU = 0.9;

function makeBrickMaterial(displayHex: string | number, finish: BrickFinish): Material {
  // ABS is a hard plastic under a glossy skin, so presentation adds a clearcoat
  // rather than simply lowering roughness.
  if (finish === "presentation") {
    return new MeshPhysicalMaterial({
      color: displayHex,
      metalness: 0,
      roughness: 0.34,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
    });
  }
  // Booklet art is unlit: one flat tone per part, and the shape is carried
  // entirely by the printed outlines. The polygon offset pushes the fill back
  // so an outline is never half-swallowed by the face it lies on.
  if (finish === "instruction") {
    return new MeshBasicMaterial({
      color: displayHex,
      polygonOffset: true,
      // Constant, not slope-scaled. A slope-scaled offset grows without bound
      // on faces seen edge-on, and at factor 1 it pushed a brick's front faces
      // behind its own back edges: every hidden line printed straight through
      // the fill. Four depth units wins the z-fight on a coincident outline
      // and is far too small to reach past any real geometry.
      //
      // The cost is that a stud rim, which lies exactly on the silhouette
      // between the cylinder wall and its cap, still stipples where the wall is
      // near edge-on: magnified, the ellipse reads dotted rather than drawn.
      // Raising the factor to 1 draws it solid and simultaneously draws the
      // rim it should be hiding, so the dotted ellipse is the honest picture.
      // It costs nothing in a silhouette comparison, which is what the closed
      // loop scores; revisit only for a presentation-quality instruction print.
      polygonOffsetFactor: 0,
      polygonOffsetUnits: 4,
    });
  }
  return new MeshStandardMaterial({ color: displayHex, metalness: 0, roughness: 0.42 });
}

function makeMaterial(
  part: PartInstance,
  diagnostics: RenderDiagnostic[],
  finish: BrickFinish,
): Material {
  const color = getColorDefinition(part.colorId);
  if (!color) {
    diagnostics.push({
      code: "UNKNOWN_COLOR",
      message: `Part ${part.id} uses unknown display color ${part.colorId}`,
      partId: part.id,
    });
  }

  const material = makeBrickMaterial(color?.displayHex ?? FALLBACK_COLOR, finish);
  material.name = `brick-material:${part.id}`;
  material.userData = {
    renderRole: "part-material",
    colorId: part.colorId,
    fallback: color === undefined,
  };
  return material;
}

/**
 * The brick body. A flat finish keeps the exact box canonical captures are
 * pinned to; a presentation finish rounds the edges, which is the difference
 * between a shape and something that reads as moulded plastic.
 */
function createBodyGeometry(
  width: number,
  height: number,
  depth: number,
  finish: BrickFinish,
): BufferGeometry {
  if (finish !== "presentation") return new BoxGeometry(width, height, depth);
  const bevel = BEVEL_LDU * THREE_UNITS_PER_LDU;
  // The radius cannot exceed half the smallest side, or the box inverts.
  const radius = Math.min(bevel, width / 2, height / 2, depth / 2);
  return new RoundedBoxGeometry(width, height, depth, 2, radius);
}

/**
 * The printed outline of one piece of geometry. Booklet art draws every visible
 * edge in ink and lets depth testing hide the rest, which is why these are
 * ordinary depth-tested lines rather than an overlay.
 */
function createInstructionOutline(
  source: BufferGeometry,
  material: LineBasicMaterial,
  name: string,
  partId: string,
): LineSegments {
  const geometry = new EdgesGeometry(source, INSTRUCTION_EDGE_THRESHOLD_DEGREES);
  geometry.userData = { renderRole: "instruction-outline-geometry" };
  const outline = new LineSegments(geometry, material);
  outline.name = name;
  outline.userData = { renderRole: "instruction-outline", partId };
  return outline;
}

/**
 * A wedge drawn as what it is: its bounding rectangle clipped by the sloped
 * face, extruded through the part's height.
 *
 * The cross-section is computed the same way the collision test computes it, so
 * the shape on screen is the shape that gets refused — a triangle or a
 * trapezoid depending on where the cut falls.
 */
function createWedgeGeometry(wedge: CollisionWedge): BufferGeometry {
  const [nx, nz] = wedge.cutNormalXZ;
  const corners: [number, number][] = [
    [wedge.minLdu[0], wedge.minLdu[2]],
    [wedge.maxLdu[0], wedge.minLdu[2]],
    [wedge.maxLdu[0], wedge.maxLdu[2]],
    [wedge.minLdu[0], wedge.maxLdu[2]],
  ];
  const inside = ([x, z]: [number, number]) => nx * x + nz * z <= wedge.cutOffsetLdu;
  const section: [number, number][] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index]!;
    const previous = corners[(index + 3) % 4]!;
    if (inside(current) !== inside(previous)) {
      const currentDistance = nx * current[0] + nz * current[1] - wedge.cutOffsetLdu;
      const previousDistance = nx * previous[0] + nz * previous[1] - wedge.cutOffsetLdu;
      const t = previousDistance / (previousDistance - currentDistance);
      section.push([
        previous[0] + t * (current[0] - previous[0]),
        previous[1] + t * (current[1] - previous[1]),
      ]);
    }
    if (inside(current)) section.push(current);
  }
  if (section.length < 3) {
    throw new RangeError(
      `Wedge ${wedge.id} has a sloped face that removes its whole footprint; check cutNormalXZ and cutOffsetLdu against minLdu/maxLdu.`,
    );
  }

  // Two capped ends plus one quad per section edge, as flat triangles: a wedge
  // has hard edges and smoothing them would round a corner that is not round.
  const positions: number[] = [];
  const topY = -wedge.minLdu[1] * THREE_UNITS_PER_LDU;
  const bottomY = -wedge.maxLdu[1] * THREE_UNITS_PER_LDU;
  const at = (index: number, y: number): [number, number, number] => [
    section[index]![0] * THREE_UNITS_PER_LDU,
    y,
    section[index]![1] * THREE_UNITS_PER_LDU,
  ];
  for (let index = 1; index + 1 < section.length; index += 1) {
    positions.push(...at(0, topY), ...at(index + 1, topY), ...at(index, topY));
    positions.push(...at(0, bottomY), ...at(index, bottomY), ...at(index + 1, bottomY));
  }
  for (let index = 0; index < section.length; index += 1) {
    const next = (index + 1) % section.length;
    positions.push(...at(index, topY), ...at(index, bottomY), ...at(next, bottomY));
    positions.push(...at(index, topY), ...at(next, bottomY), ...at(next, topY));
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createCatalogPartGeometry(
  part: PartInstance,
  definition: PartDefinition,
  includeStuds: boolean,
  diagnostics: RenderDiagnostic[],
  finish: BrickFinish = "flat",
): Group {
  const group = new Group();
  const metadata = geometryMetadata(definition);
  const material = makeMaterial(part, diagnostics, finish);
  // One ink material per part, shared by its body and every stud outline, so a
  // 1465-piece model costs 1465 line materials rather than one per stud.
  const outlineMaterial =
    finish === "instruction"
      ? Object.assign(new LineBasicMaterial({ color: INSTRUCTION_EDGE_HEX }), {
          name: `instruction-outline-material:${part.id}`,
          userData: { renderRole: "instruction-outline-material" },
        })
      : null;
  const castsShadows = finish !== "instruction";
  // The solid is drawn from the same body primitives the collision validator
  // reads. Drawing it from `dimensions` instead would let a wedge look like the
  // box it is not, and would let the picture and the solid drift apart in
  // silence — which is the gap LDCad's shadow library exists to patch.
  let bodyIndex = 0;
  for (const primitive of definition.collision.primitives) {
    if (primitive.tag !== "body") continue;
    const bodyGeometry =
      primitive.kind === "wedge"
        ? createWedgeGeometry(primitive)
        : createBodyGeometry(
            (primitive.maxLdu[0] - primitive.minLdu[0]) * THREE_UNITS_PER_LDU,
            (primitive.maxLdu[1] - primitive.minLdu[1]) * THREE_UNITS_PER_LDU,
            (primitive.maxLdu[2] - primitive.minLdu[2]) * THREE_UNITS_PER_LDU,
            finish,
          );
    bodyGeometry.userData = { ...metadata, renderRole: "body-geometry" };
    const body = new Mesh(bodyGeometry, material);
    body.name = bodyIndex === 0 ? `body:${part.id}` : `body:${part.id}:${bodyIndex}`;
    // A wedge is built from its own corners and is already in place; a box is
    // built centred on the origin and has to be moved to its own centre.
    if (primitive.kind !== "wedge") {
      body.position.copy(
        lduToThreeVector([
          (primitive.minLdu[0] + primitive.maxLdu[0]) / 2,
          (primitive.minLdu[1] + primitive.maxLdu[1]) / 2,
          (primitive.minLdu[2] + primitive.maxLdu[2]) / 2,
        ]),
      );
    }
    body.castShadow = castsShadows;
    body.receiveShadow = castsShadows;
    body.userData = { renderRole: "body", partId: part.id, primitiveId: primitive.id };
    group.add(body);
    if (outlineMaterial) {
      group.add(
        createInstructionOutline(
          bodyGeometry,
          outlineMaterial,
          bodyIndex === 0 ? `body-outline:${part.id}` : `body-outline:${part.id}:${bodyIndex}`,
          part.id,
        ),
      );
    }
    bodyIndex += 1;
  }

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
    const studOutline = outlineMaterial
      ? new EdgesGeometry(studGeometry, INSTRUCTION_EDGE_THRESHOLD_DEGREES)
      : null;
    if (studOutline) studOutline.userData = { renderRole: "instruction-outline-geometry" };

    for (const primitive of definition.collision.primitives) {
      if (primitive.kind !== "cylinder" || primitive.tag !== "stud") continue;
      const stud = new Mesh(studGeometry, material);
      stud.name = `${primitive.id}:${part.id}`;
      stud.position.copy(lduToThreeVector(primitive.centerLdu));
      stud.castShadow = castsShadows;
      stud.receiveShadow = castsShadows;
      stud.userData = {
        renderRole: "stud",
        partId: part.id,
        primitiveId: primitive.id,
      };
      group.add(stud);
      if (studOutline && outlineMaterial) {
        const outline = new LineSegments(studOutline, outlineMaterial);
        outline.name = `${primitive.id}-outline:${part.id}`;
        outline.position.copy(stud.position);
        outline.userData = { renderRole: "instruction-outline", partId: part.id };
        group.add(outline);
      }
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

const GHOST_COLORS = { valid: 0x54e08a, blocked: 0xff5470 } as const;

export type GhostVerdict = keyof typeof GHOST_COLORS;

/**
 * A translucent stand-in for a part the user is about to place. It is a pure
 * display artifact: it carries no part ID and never enters the document, so it
 * cannot be mistaken for authored truth. Dispose it with disposeObjectTree.
 */
export function createPlacementGhost(
  definition: PartDefinition,
  transform: RigidTransform,
  verdict: GhostVerdict,
): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: GHOST_COLORS[verdict],
    metalness: 0,
    roughness: 0.5,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  material.userData = { renderRole: "placement-ghost-material", verdict };

  const { widthLdu, heightLdu, lengthLdu } = definition.dimensions;
  const bodyGeometry = new BoxGeometry(
    widthLdu * THREE_UNITS_PER_LDU,
    heightLdu * THREE_UNITS_PER_LDU,
    lengthLdu * THREE_UNITS_PER_LDU,
  );
  bodyGeometry.userData = { renderRole: "placement-ghost-geometry" };
  group.add(new Mesh(bodyGeometry, material));

  const studGeometry = new CylinderGeometry(
    STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
    STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
    STUD_HEIGHT_LDU * THREE_UNITS_PER_LDU,
    16,
    1,
    false,
  );
  studGeometry.userData = { renderRole: "placement-ghost-geometry" };
  for (const primitive of definition.collision.primitives) {
    if (primitive.kind !== "cylinder" || primitive.tag !== "stud") continue;
    const stud = new Mesh(studGeometry, material);
    stud.position.copy(lduToThreeVector(primitive.centerLdu));
    group.add(stud);
  }

  lduTransformToThreeMatrix(transform).decompose(group.position, group.quaternion, group.scale);
  group.updateMatrix();
  group.renderOrder = 50;
  group.name = "placement-ghost";
  group.userData = {
    renderRole: "placement-ghost",
    catalogPartId: definition.id,
    verdict,
    sourceOfTruth: "none",
  };
  return group;
}
