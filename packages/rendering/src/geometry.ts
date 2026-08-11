import {
  STUD_HEIGHT_LDU,
  STUD_RADIUS_LDU,
  getColorDefinition,
  resolvePreloadedMeshAsset,
  sampleBodyArcPlanBoundary,
  type BodyArcFeature,
  type CollisionWedge,
  type LduBounds,
  type MeshAssetResolver,
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
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
} from "three";

import { INSTRUCTION_EDGE_THRESHOLD_DEGREES } from "./constants.ts";
import {
  RenderTransformError,
  THREE_UNITS_PER_LDU,
  lduToThreeVector,
  lduTransformToThreeMatrix,
} from "./coordinates.ts";
import {
  INSTRUCTION_ART_MATERIAL_HEX,
  createInstructionInkMaterial,
  instructionBoxOutline,
  instructionFillGeometry,
  type InstructionBox,
  type InstructionSurface,
} from "./instruction-finish.ts";
import type { PartMaterialCache } from "./material-cache.ts";
import { createResolvedMeshGeometry } from "./resolved-mesh-geometry.ts";
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

/**
 * The part's display colour as a number, and the diagnostic when it cannot be
 * had. Numeric rather than the catalog's `#rrggbb` because every booklet tone
 * is arithmetic on its channels.
 */
function resolveDisplayHex(
  part: PartInstance,
  diagnostics: RenderDiagnostic[],
): { displayHex: number; fallback: boolean } {
  const reject = (message: string) => {
    diagnostics.push({ code: "UNKNOWN_COLOR", message, partId: part.id });
    return { displayHex: FALLBACK_COLOR, fallback: true };
  };
  const color = getColorDefinition(part.colorId);
  if (!color) return reject(`Part ${part.id} uses unknown display color ${part.colorId}`);
  if (!/^#[0-9a-fA-F]{6}$/.test(color.displayHex)) {
    return reject(
      `Catalog color ${part.colorId} on part ${part.id} has displayHex "${color.displayHex}", ` +
        `which is not a six-digit #rrggbb — every booklet tone is arithmetic on those channels`,
    );
  }
  return { displayHex: Number.parseInt(color.displayHex.slice(1), 16), fallback: false };
}

function makeBrickMaterial(displayHex: number, finish: BrickFinish): Material {
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
  // Booklet art is shaded, not flat: three tones across a brick's three visible
  // faces, a lighter cap and a near-black wall on every stud. The tone is baked
  // per triangle into vertex colours, so the material stays unlit and the
  // palette stays exact — see instruction-finish.ts for the measurements. The
  // fill takes no polygon offset: an outline that lies on a face is moved
  // toward the camera instead, which leaves the fill's own depth honest so it
  // can still hide the lines behind it.
  if (finish === "instruction") {
    return new MeshBasicMaterial({ color: INSTRUCTION_ART_MATERIAL_HEX, vertexColors: true });
  }
  return new MeshStandardMaterial({ color: displayHex, metalness: 0, roughness: 0.42 });
}

/**
 * Everything that decides what a part material looks like, and nothing that
 * does not. The part id is deliberately absent: two parts of the same colour and
 * finish want the same plastic, and giving them separate materials costs a GL
 * program relink every time the scene is rebuilt.
 */
function materialCacheKey(
  colorId: string,
  displayHex: number,
  fallback: boolean,
  finish: BrickFinish,
): string {
  const hex = displayHex.toString(16).padStart(6, "0");
  return `${finish}|${colorId}|${fallback ? "fallback" : "exact"}|${hex}`;
}

function makeMaterial(
  part: PartInstance,
  displayHex: number,
  fallback: boolean,
  finish: BrickFinish,
  materialCache?: PartMaterialCache,
): Material {
  const key = materialCacheKey(part.colorId, displayHex, fallback, finish);
  const create = (): Material => {
    const material = makeBrickMaterial(displayHex, finish);
    material.name = `brick-material:${key}`;
    // The display hex travels with the material because an instruction fill is
    // white plus a baked tone; without it, switching shading off would leave the
    // part white rather than its own colour.
    material.userData = {
      renderRole: "part-material",
      colorId: part.colorId,
      fallback,
      displayHex,
    };
    return material;
  };
  return materialCache ? materialCache.acquire(key, create) : create();
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
  for (let index = section.length - 1; index > 0; index -= 1) {
    const current = section[index]!;
    const previous = section[index - 1]!;
    if (Math.abs(current[0] - previous[0]) <= 1e-9 && Math.abs(current[1] - previous[1]) <= 1e-9) {
      section.splice(index, 1);
    }
  }
  if (
    section.length > 1 &&
    Math.abs(section[0]![0] - section[section.length - 1]![0]) <= 1e-9 &&
    Math.abs(section[0]![1] - section[section.length - 1]![1]) <= 1e-9
  ) {
    section.pop();
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

/** How many facets a round underside tube is drawn with, matching a stud's. */
const TUBE_SEGMENTS = 24;

/**
 * One underside tube, drawn as the annulus `stud4.dat` builds rather than as the
 * box its collision primitive settles for.
 *
 * The bore matters: it is exactly the stud radius, so drawing a filled post
 * would put material where a real plate has a hole and would make a from-below
 * comparison against a printed panel measure the wrong shape again — the whole
 * defect this geometry exists to close. The tube is open at the top because the
 * ceiling closes it there, and capped by a ring at the underside face, which is
 * what `4-4ring3.dat` scaled 2 does on `stud4.dat` line 25.
 *
 * Winding is the whole correctness of this function and it is not obvious by
 * reading: the first version had all 144 triangles reversed, so the brick
 * material — `FrontSide`, like every other in this renderer — culled every one
 * of them and the tubes were in the scene, in the tests, and invisible in the
 * picture. `rendering.test.ts` measures the direction each face points rather
 * than trusting the vertex order below.
 */
function createTubeGeometry(inner: number, outer: number, height: number): BufferGeometry {
  const innerRadius = inner * THREE_UNITS_PER_LDU;
  const outerRadius = outer * THREE_UNITS_PER_LDU;
  const halfHeight = (height * THREE_UNITS_PER_LDU) / 2;
  const positions: number[] = [];
  type Point = readonly [number, number, number];
  const triangle = (a: Point, b: Point, c: Point) => positions.push(...a, ...b, ...c);
  /** Two triangles for the quad a-b-c-d, which must already wind outward. */
  const quad = (a: Point, b: Point, c: Point, d: Point) => {
    triangle(a, b, c);
    triangle(a, c, d);
  };
  for (let segment = 0; segment < TUBE_SEGMENTS; segment += 1) {
    const from = (segment / TUBE_SEGMENTS) * Math.PI * 2;
    const to = ((segment + 1) / TUBE_SEGMENTS) * Math.PI * 2;
    const [cosFrom, sinFrom] = [Math.cos(from), Math.sin(from)];
    const [cosTo, sinTo] = [Math.cos(to), Math.sin(to)];
    const at = (radius: number, cos: number, sin: number, y: number): Point => [
      radius * cos,
      y,
      radius * sin,
    ];
    const outerLow = at(outerRadius, cosFrom, sinFrom, -halfHeight);
    const outerLowNext = at(outerRadius, cosTo, sinTo, -halfHeight);
    const outerHigh = at(outerRadius, cosFrom, sinFrom, halfHeight);
    const outerHighNext = at(outerRadius, cosTo, sinTo, halfHeight);
    const boreLow = at(innerRadius, cosFrom, sinFrom, -halfHeight);
    const boreLowNext = at(innerRadius, cosTo, sinTo, -halfHeight);
    const boreHigh = at(innerRadius, cosFrom, sinFrom, halfHeight);
    const boreHighNext = at(innerRadius, cosTo, sinTo, halfHeight);
    // The outer wall, facing away from the axis.
    quad(outerLow, outerHigh, outerHighNext, outerLowNext);
    // The bore, facing the axis.
    quad(boreLow, boreLowNext, boreHighNext, boreHigh);
    // The ring between them at the open face, facing down at a camera below.
    quad(boreLow, outerLow, outerLowNext, boreLowNext);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** One smooth visible prism from the authored arc, never from its collision facets. */
export function createArcPrismGeometry(feature: BodyArcFeature, bounds: LduBounds): BufferGeometry {
  const boundary = sampleBodyArcPlanBoundary(feature, 2);
  const contour = boundary.map(([x, z]) => new Vector2(x, z));
  const faces = ShapeUtils.triangulateShape(contour, []);
  if (faces.length === 0) {
    throw new RangeError("bodyArc boundary could not be triangulated into a visible solid");
  }

  const topY = -bounds.min[1] * THREE_UNITS_PER_LDU;
  const bottomY = -bounds.max[1] * THREE_UNITS_PER_LDU;
  const at = (index: number, y: number): [number, number, number] => [
    boundary[index]![0] * THREE_UNITS_PER_LDU,
    y,
    boundary[index]![1] * THREE_UNITS_PER_LDU,
  ];
  const positions: number[] = [];
  for (const face of faces) {
    if (face.length !== 3) {
      throw new RangeError(`bodyArc triangulation returned a ${face.length}-vertex face`);
    }
    const a = face[0]!;
    const b = face[1]!;
    const c = face[2]!;
    const left = boundary[a]!;
    const middle = boundary[b]!;
    const right = boundary[c]!;
    const cross =
      (middle[0] - left[0]) * (right[1] - left[1]) - (middle[1] - left[1]) * (right[0] - left[0]);
    if (cross > 0) {
      positions.push(...at(a, topY), ...at(c, topY), ...at(b, topY));
      positions.push(...at(a, bottomY), ...at(b, bottomY), ...at(c, bottomY));
    } else {
      positions.push(...at(a, topY), ...at(b, topY), ...at(c, topY));
      positions.push(...at(a, bottomY), ...at(c, bottomY), ...at(b, bottomY));
    }
  }

  let twiceArea = 0;
  for (let index = 0; index < boundary.length; index += 1) {
    const current = boundary[index]!;
    const next = boundary[(index + 1) % boundary.length]!;
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  const counterClockwise = twiceArea > 0;
  for (let index = 0; index < boundary.length; index += 1) {
    const next = (index + 1) % boundary.length;
    if (counterClockwise) {
      positions.push(...at(index, topY), ...at(next, topY), ...at(next, bottomY));
      positions.push(...at(index, topY), ...at(next, bottomY), ...at(index, bottomY));
    } else {
      positions.push(...at(index, topY), ...at(next, bottomY), ...at(next, topY));
      positions.push(...at(index, topY), ...at(index, bottomY), ...at(next, bottomY));
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The rotation that carries this part's local normals into world space, which
 * is the frame the booklet's light lives in. An orientation the catalog does
 * not know leaves the part unrotated, matching what `deriveBrickScene` does
 * with the same failure — a shaded part in the wrong pose would otherwise be a
 * second, silent symptom of one bad orientation id.
 */
function partRotation(part: PartInstance): Matrix3 {
  try {
    return new Matrix3().setFromMatrix4(lduTransformToThreeMatrix(part.transform));
  } catch (error) {
    if (!(error instanceof RenderTransformError)) throw error;
    return new Matrix3();
  }
}

export function createCatalogPartGeometry(
  part: PartInstance,
  definition: PartDefinition,
  includeStuds: boolean,
  diagnostics: RenderDiagnostic[],
  finish: BrickFinish = "flat",
  resolveMeshAsset: MeshAssetResolver = resolvePreloadedMeshAsset,
  /**
   * Optional shared-material store. Without one, every call mints its own
   * materials and the caller owns disposing them, which is what a one-shot
   * capture wants. An interactive viewport passes its own cache so a rebuild
   * does not destroy and relink the GL programs it is about to need again.
   */
  materialCache?: PartMaterialCache,
): Group {
  if (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
    const resolution = resolveMeshAsset(definition.geometry);
    if (!resolution.ok) {
      diagnostics.push({ code: resolution.code, message: resolution.message, partId: part.id });
      return createPlaceholderGeometry(part, definition.boundsLdu, resolution.code);
    }

    const group = new Group();
    const metadata = geometryMetadata(definition);
    const { displayHex, fallback } = resolveDisplayHex(part, diagnostics);
    const material = makeMaterial(part, displayHex, fallback, finish, materialCache);
    const instruction = finish === "instruction";
    const rotation = instruction ? partRotation(part) : null;
    const outlineMaterial = instruction ? createInstructionInkMaterial(displayHex, part.id) : null;
    const renderRoles: readonly InstructionSurface[] =
      instruction && includeStuds && resolution.asset.groups.some(({ role }) => role === "stud")
        ? ["body", "stud"]
        : ["body"];
    for (const renderRole of renderRoles) {
      const source = createResolvedMeshGeometry(
        resolution.asset,
        includeStuds,
        instruction ? renderRole : undefined,
      );
      const includedMeshRoles = source.userData.includedMeshRoles;
      if (outlineMaterial) {
        group.add(
          createInstructionOutline(
            source,
            outlineMaterial,
            `${renderRole}-outline:${part.id}`,
            part.id,
          ),
        );
      }
      const geometry = rotation
        ? instructionFillGeometry(source, rotation, displayHex, renderRole)
        : source;
      geometry.userData = {
        ...metadata,
        renderRole: `${renderRole}-geometry`,
        meshAssetId: resolution.asset.assetId,
        includedMeshRoles,
      };
      const mesh = new Mesh(geometry, material);
      mesh.name = `${renderRole}:${part.id}`;
      mesh.castShadow = !instruction;
      mesh.receiveShadow = !instruction;
      mesh.userData = {
        renderRole,
        partId: part.id,
        primitiveId: `mesh:${resolution.asset.assetId}`,
      };
      group.add(mesh);
    }
    group.userData = {
      renderRole: "catalog-part-geometry",
      catalogPartId: definition.id,
      sourceOfTruth: "preloaded-mesh-asset",
      placeholder: false,
    };
    return group;
  }

  const group = new Group();
  const metadata = geometryMetadata(definition);
  const { displayHex, fallback } = resolveDisplayHex(part, diagnostics);
  const material = makeMaterial(part, displayHex, fallback, finish, materialCache);
  const instruction = finish === "instruction";
  const rotation = instruction ? partRotation(part) : null;
  // One ink material per part, shared by its body and every stud outline, so a
  // 1465-piece model costs 1465 line materials rather than one per stud.
  const outlineMaterial = instruction ? createInstructionInkMaterial(displayHex, part.id) : null;
  /**
   * Booklet tone, baked per triangle. Any outline must already have been taken
   * from `source`: a de-indexed copy replaces it, and the source is disposed.
   */
  const shaded = (source: BufferGeometry, surface: InstructionSurface): BufferGeometry =>
    rotation ? instructionFillGeometry(source, rotation, displayHex, surface) : source;
  const castsShadows = !instruction;
  // An arch, a curved slope and a cheese slope are a staircase of boxes rather
  // than one prism, so their outlines are cut from the union those boxes make:
  // otherwise every seam between two of them prints, and a ramp reads as a
  // stack of fins. Kept in the same frame the solid is built in.
  const bodyBoxes: InstructionBox[] = definition.collision.primitives
    .filter((primitive) => primitive.tag === "body" && primitive.kind === "box")
    .map((primitive) => {
      const low = lduToThreeVector(primitive.minLdu);
      const high = lduToThreeVector(primitive.maxLdu);
      return {
        min: [Math.min(low.x, high.x), Math.min(low.y, high.y), Math.min(low.z, high.z)] as const,
        max: [Math.max(low.x, high.x), Math.max(low.y, high.y), Math.max(low.z, high.z)] as const,
      };
    });
  let boxIndex = 0;
  // The solid is drawn from the same body primitives the collision validator
  // reads. Drawing it from `dimensions` instead would let a wedge look like the
  // box it is not, and would let the picture and the solid drift apart in
  // silence — which is the gap LDCad's shadow library exists to patch.
  let bodyIndex = 0;
  const bodyArc = definition.geometry.bodyArc;
  if (bodyArc) {
    const source = createArcPrismGeometry(bodyArc, definition.bodyBoundsLdu);
    if (outlineMaterial) {
      group.add(
        createInstructionOutline(source, outlineMaterial, `body-outline:${part.id}`, part.id),
      );
    }
    const bodyGeometry = shaded(source, "body");
    bodyGeometry.userData = { ...metadata, renderRole: "body-geometry" };
    const body = new Mesh(bodyGeometry, material);
    body.name = `body:${part.id}`;
    body.castShadow = castsShadows;
    body.receiveShadow = castsShadows;
    body.userData = { renderRole: "body", partId: part.id, primitiveId: "body:arc" };
    group.add(body);
    bodyIndex += 1;
  }

  for (const primitive of definition.collision.primitives) {
    if (primitive.tag !== "body") continue;
    // The visible body is the exact source feature above. Its conservative
    // convex collision decomposition must never become visible seams or a
    // slightly expanded silhouette.
    if (bodyArc || primitive.kind === "convex-prism") continue;
    // The tubes were drawn above as the annuli they are. Their primitives are
    // the largest box inside each annulus, so drawing them would both fill the
    // bore and shrink the tube; they are named rather than matched by kind,
    // because a box tagged `body` is otherwise exactly what a wall is.
    if (primitive.id.startsWith("tube:")) continue;
    // A round body — a wheel — is drawn round. Its axis lies along x, matching
    // the axle it turns on, where a Three.js cylinder stands on y by default.
    if (primitive.kind === "cylinder") {
      const wheel = new CylinderGeometry(
        primitive.radiusLdu * THREE_UNITS_PER_LDU,
        primitive.radiusLdu * THREE_UNITS_PER_LDU,
        primitive.heightLdu * THREE_UNITS_PER_LDU,
        24,
        1,
        false,
      );
      wheel.rotateZ(Math.PI / 2);
      if (outlineMaterial) {
        const outline = createInstructionOutline(
          wheel,
          outlineMaterial,
          `body-outline:${part.id}`,
          part.id,
        );
        // The barrel is built on the origin and moved; its ink has to move too.
        outline.position.copy(lduToThreeVector(primitive.centerLdu));
        group.add(outline);
      }
      const wheelGeometry = shaded(wheel, "body");
      wheelGeometry.userData = { ...metadata, renderRole: "body-geometry" };
      const mesh = new Mesh(wheelGeometry, material);
      mesh.name = bodyIndex === 0 ? `body:${part.id}` : `body:${part.id}:${bodyIndex}`;
      mesh.position.copy(lduToThreeVector(primitive.centerLdu));
      mesh.castShadow = castsShadows;
      mesh.receiveShadow = castsShadows;
      mesh.userData = { renderRole: "body", partId: part.id, primitiveId: primitive.id };
      group.add(mesh);
      bodyIndex += 1;
      continue;
    }
    const source =
      primitive.kind === "wedge"
        ? createWedgeGeometry(primitive)
        : createBodyGeometry(
            (primitive.maxLdu[0] - primitive.minLdu[0]) * THREE_UNITS_PER_LDU,
            (primitive.maxLdu[1] - primitive.minLdu[1]) * THREE_UNITS_PER_LDU,
            (primitive.maxLdu[2] - primitive.minLdu[2]) * THREE_UNITS_PER_LDU,
            finish,
          );
    if (outlineMaterial) {
      const name =
        bodyIndex === 0 ? `body-outline:${part.id}` : `body-outline:${part.id}:${bodyIndex}`;
      if (primitive.kind === "wedge") {
        // A wedge is already built from its own corners, so its edges are in
        // place; there is no wedge in this catalog that shares a part with a box.
        group.add(createInstructionOutline(source, outlineMaterial, name, part.id));
      } else {
        const geometry = instructionBoxOutline(bodyBoxes, boxIndex);
        geometry.userData = { renderRole: "instruction-outline-geometry" };
        const outline = new LineSegments(geometry, outlineMaterial);
        outline.name = name;
        outline.userData = { renderRole: "instruction-outline", partId: part.id };
        group.add(outline);
      }
    }
    if (primitive.kind === "box") boxIndex += 1;
    const bodyGeometry = shaded(source, "body");
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
    bodyIndex += 1;
  }

  // An underside tube is an annulus, and its collision primitive is the largest
  // box inside it. Drawing that primitive would fill the bore and lose the
  // round wall, so the tubes are drawn from the source feature and their
  // primitives skipped — the same bargain the arc above makes with its convex
  // decomposition.
  const bodyTubes = definition.geometry.bodyTubes;
  if (bodyTubes) {
    const tubeSource = createTubeGeometry(
      bodyTubes.innerRadiusLdu,
      bodyTubes.outerRadiusLdu,
      bodyTubes.heightLdu,
    );
    const tubeOutline = outlineMaterial
      ? new EdgesGeometry(tubeSource, INSTRUCTION_EDGE_THRESHOLD_DEGREES)
      : null;
    if (tubeOutline) tubeOutline.userData = { renderRole: "instruction-outline-geometry" };
    const tubeGeometry = shaded(tubeSource, "body");
    tubeGeometry.userData = { ...metadata, renderRole: "body-geometry" };
    const tubeCenterY = definition.bodyBoundsLdu.max[1] - bodyTubes.heightLdu / 2;
    bodyTubes.centersXZLdu.forEach(([x, z], index) => {
      const tube = new Mesh(tubeGeometry, material);
      tube.name = `tube:${index}:${part.id}`;
      tube.position.copy(lduToThreeVector([x, tubeCenterY, z]));
      tube.castShadow = castsShadows;
      tube.receiveShadow = castsShadows;
      tube.userData = { renderRole: "body", partId: part.id, primitiveId: `tube:${index}` };
      group.add(tube);
      if (tubeOutline && outlineMaterial) {
        const outline = new LineSegments(tubeOutline, outlineMaterial);
        outline.name = `tube:${index}-outline:${part.id}`;
        outline.position.copy(tube.position);
        outline.userData = { renderRole: "instruction-outline", partId: part.id };
        group.add(outline);
      }
    });
  }

  // A tile, a wheel, an axle and a cheese slope have no studs at all. Testing
  // that before the cylinder is built keeps the six studless families from
  // paying for a geometry, a de-index and a 96-triangle tone bake that is then
  // dropped — a cost every scene derivation used to repeat, thousands of times
  // over one closed-loop search.
  const hasStuds = definition.collision.primitives.some(
    (primitive) => primitive.kind === "cylinder" && primitive.tag === "stud",
  );
  if (includeStuds && hasStuds) {
    const studSource = new CylinderGeometry(
      STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
      STUD_RADIUS_LDU * THREE_UNITS_PER_LDU,
      STUD_HEIGHT_LDU * THREE_UNITS_PER_LDU,
      24,
      1,
      false,
    );
    const studOutline = outlineMaterial
      ? new EdgesGeometry(studSource, INSTRUCTION_EDGE_THRESHOLD_DEGREES)
      : null;
    if (studOutline) studOutline.userData = { renderRole: "instruction-outline-geometry" };
    // Every stud of a part shares one geometry, and under a yaw-only
    // orientation they all face the same way, so one baked tone serves them all.
    const studGeometry = shaded(studSource, "stud");
    studGeometry.userData = { ...metadata, renderRole: "stud-geometry" };

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

export function createPlaceholderGeometry(
  part: PartInstance,
  bounds: LduBounds = PLACEHOLDER_BOUNDS,
  reason: string = "UNKNOWN_CATALOG_PART",
): Group {
  const group = new Group();
  const low = lduToThreeVector(bounds.min);
  const high = lduToThreeVector(bounds.max);
  const geometry = new BoxGeometry(
    Math.abs(high.x - low.x),
    Math.abs(high.y - low.y),
    Math.abs(high.z - low.z),
  );
  geometry.userData = { renderRole: "placeholder-geometry", reason };
  const material = new MeshBasicMaterial({
    color: FALLBACK_COLOR,
    wireframe: true,
    depthTest: false,
  });
  material.userData = { renderRole: "placeholder-material", reason };
  const mesh = new Mesh(geometry, material);
  mesh.name = `placeholder:${part.id}`;
  mesh.position.addVectors(low, high).multiplyScalar(0.5);
  mesh.renderOrder = 1_000;
  mesh.userData = { renderRole: "placeholder", partId: part.id, reason };
  group.add(mesh);
  group.userData = { renderRole: "placeholder-group", placeholder: true, reason };
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
  /**
   * Same bargain as a part material. The geometry is per-part — it is the part's
   * own box — but the ink is one of exactly two colours, and minting it per
   * overlay meant every selection change destroyed and relinked a GL program.
   */
  materialCache?: PartMaterialCache,
): LineSegments {
  const width = (bounds.max[0] - bounds.min[0]) * THREE_UNITS_PER_LDU;
  const height = (bounds.max[1] - bounds.min[1]) * THREE_UNITS_PER_LDU;
  const depth = (bounds.max[2] - bounds.min[2]) * THREE_UNITS_PER_LDU;
  const sourceGeometry = new BoxGeometry(width, height, depth);
  const geometry = new EdgesGeometry(sourceGeometry);
  sourceGeometry.dispose();
  geometry.userData = { renderRole: `${renderRole}-geometry` };
  const createMaterial = (): LineBasicMaterial => {
    const created = new LineBasicMaterial({
      color: renderRole === "selection-overlay" ? 0x43d9ff : 0xff3d52,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    created.userData = { renderRole: `${renderRole}-material` };
    return created;
  };
  const material = materialCache
    ? materialCache.acquire(`overlay|${renderRole}`, createMaterial)
    : createMaterial();
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
  resolveMeshAsset: MeshAssetResolver = resolvePreloadedMeshAsset,
): Group {
  // Build from the same source feature path as the placed part. A dimensions
  // box fills a ring's opening, restores a wedge's cut corner, and recentres an
  // asymmetric raw part such as 80015, so it can falsely show either clearance
  // or collision while the editor is deciding whether placement is legal.
  const diagnostics: RenderDiagnostic[] = [];
  const group = createCatalogPartGeometry(
    {
      id: "placement-ghost",
      catalogPartId: definition.id,
      colorId: "builtin:white",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: [],
      provenance: { source: "manual" },
    },
    definition,
    true,
    diagnostics,
    "flat",
    resolveMeshAsset,
  );
  if (diagnostics.length > 0) {
    if (group.userData.placeholder === true) {
      lduTransformToThreeMatrix(transform).decompose(group.position, group.quaternion, group.scale);
      group.updateMatrix();
      group.renderOrder = 1_000;
      group.name = "placement-ghost";
      group.userData = {
        ...group.userData,
        renderRole: "placement-ghost",
        catalogPartId: definition.id,
        verdict,
        sourceOfTruth: "catalog-mesh-placeholder",
        placeholder: true,
        diagnostics: diagnostics.map(({ code, message }) => ({ code, message })),
      };
      return group;
    }
    throw new RangeError(
      `Placement ghost for ${definition.id} could not derive catalog geometry: ${diagnostics.map(({ message }) => message).join("; ")}`,
    );
  }
  const material = new MeshStandardMaterial({
    color: GHOST_COLORS[verdict],
    metalness: 0,
    roughness: 0.5,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  material.userData = { renderRole: "placement-ghost-material", verdict };
  const replacedMaterials = new Set<Material>();
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const prior of Array.isArray(object.material) ? object.material : [object.material]) {
      replacedMaterials.add(prior);
    }
    object.material = material;
    object.geometry.userData = {
      ...object.geometry.userData,
      renderRole: "placement-ghost-geometry",
    };
    object.userData = { ...object.userData, renderRole: "placement-ghost-piece", verdict };
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 50;
  });
  for (const replaced of replacedMaterials) replaced.dispose();

  lduTransformToThreeMatrix(transform).decompose(group.position, group.quaternion, group.scale);
  group.updateMatrix();
  group.renderOrder = 50;
  group.name = "placement-ghost";
  group.userData = {
    renderRole: "placement-ghost",
    catalogPartId: definition.id,
    verdict,
    sourceOfTruth: "catalog-derived-display",
    placeholder: false,
  };
  return group;
}
