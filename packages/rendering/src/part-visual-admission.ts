import { deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  MESH_RENDER_UNITS_PER_LDU,
  PROPER_ORIENTATIONS,
  type LduVector3,
  type MeshReferenceGeometryRecipe,
  type OrientationMatrix,
} from "@lego-studio/catalog";
import {
  Box3,
  BufferAttribute,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";

import { lduDirectionToThree, lduToThreeVector } from "./coordinates.ts";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
  PART_VISUAL_ADMISSION_VIEW_POLICY,
  PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
  type PartVisualAdmissionViewName,
} from "./part-visual-admission-policy.ts";

export {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  PART_VISUAL_ADMISSION_VIEW_POLICY,
  PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
  type PartVisualAdmissionViewName,
} from "./part-visual-admission-policy.ts";

export interface PartVisualAdmissionView {
  readonly name: PartVisualAdmissionViewName;
  readonly projection: "orthographic" | "perspective";
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly near: number;
  readonly far: number;
  readonly halfExtent: number;
  readonly verticalFovDegrees: number | null;
}

export interface PartVisualAdmissionCameraPacket {
  readonly schemaVersion: "lego.part-visual-admission-camera-packet/1";
  readonly viewPolicyHash: Sha256Digest;
  readonly capturePolicyHash: Sha256Digest;
  readonly sourceBounds: PartVisualAdmissionBounds;
  readonly candidateBounds: PartVisualAdmissionBounds;
  readonly unionBounds: PartVisualAdmissionBounds;
  readonly center: readonly [number, number, number];
  readonly frameRadius: number;
  readonly views: readonly PartVisualAdmissionView[];
}

export interface PartVisualAdmissionBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

function finiteBounds(box: Box3, label: string): void {
  if (box.isEmpty())
    throw new RangeError(`${label} is empty; visual admission needs real geometry.`);
  const values = [...box.min.toArray(), ...box.max.toArray()];
  if (!values.every(Number.isFinite)) {
    throw new RangeError(`${label} contains non-finite coordinates: ${JSON.stringify(values)}.`);
  }
}

function tuple(vector: Vector3): readonly [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function bounds(box: Box3): PartVisualAdmissionBounds {
  return { min: tuple(box.min), max: tuple(box.max) };
}

/**
 * Fits exactly once from the union of both transformed surfaces. Every source
 * and candidate capture consumes these same eight camera numbers.
 */
export function createPartVisualAdmissionCameraPacket(
  sourceBounds: Box3,
  candidateBounds: Box3,
): PartVisualAdmissionCameraPacket {
  finiteBounds(sourceBounds, "Source bounds");
  finiteBounds(candidateBounds, "Candidate bounds");
  const union = sourceBounds.clone().union(candidateBounds);
  finiteBounds(union, "Source/candidate union bounds");
  const center = union.getCenter(new Vector3());
  const radius = Math.max(union.min.distanceTo(union.max) / 2, MESH_RENDER_UNITS_PER_LDU);
  const frameRadius = radius * PART_VISUAL_ADMISSION_CAPTURE_POLICY.padding;
  const views = PART_VISUAL_ADMISSION_VIEW_POLICY.views.map(
    ({ name, direction, up, projection }) => {
      const verticalFovDegrees =
        projection === "perspective"
          ? PART_VISUAL_ADMISSION_VIEW_POLICY.perspectiveVerticalFovDegrees
          : null;
      const distance =
        verticalFovDegrees === null
          ? frameRadius * 4
          : frameRadius / Math.sin((verticalFovDegrees * Math.PI) / 360);
      const near = Math.max(0.001, distance - frameRadius * 1.5);
      const far = distance + frameRadius * 2.5;
      const position = center
        .clone()
        .addScaledVector(new Vector3(...direction).normalize(), distance);
      return {
        name,
        projection,
        position: tuple(position),
        target: tuple(center),
        up,
        near,
        far,
        halfExtent: frameRadius,
        verticalFovDegrees,
      } satisfies PartVisualAdmissionView;
    },
  );
  return deepFreeze({
    schemaVersion: "lego.part-visual-admission-camera-packet/1",
    viewPolicyHash: PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
    capturePolicyHash: PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
    sourceBounds: bounds(sourceBounds),
    candidateBounds: bounds(candidateBounds),
    unionBounds: bounds(union),
    center: tuple(center),
    frameRadius,
    views,
  });
}

export function createPartVisualAdmissionCamera(
  view: PartVisualAdmissionView,
): OrthographicCamera | PerspectiveCamera {
  const camera =
    view.projection === "orthographic"
      ? new OrthographicCamera(
          -view.halfExtent,
          view.halfExtent,
          view.halfExtent,
          -view.halfExtent,
          view.near,
          view.far,
        )
      : new PerspectiveCamera(
          view.verticalFovDegrees ??
            PART_VISUAL_ADMISSION_VIEW_POLICY.perspectiveVerticalFovDegrees,
          1,
          view.near,
          view.far,
        );
  camera.name = `part-visual-admission-camera:${view.name}`;
  camera.position.fromArray(view.position);
  camera.up.fromArray(view.up);
  camera.lookAt(new Vector3(...view.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.userData = {
    renderRole: "part-visual-admission-camera",
    viewName: view.name,
    sharedFraming: true,
  };
  return camera;
}

type SourceFrame = MeshReferenceGeometryRecipe["assetToCatalogFrame"];

function properSourceFrame(frame: SourceFrame): {
  readonly matrix: OrientationMatrix;
  readonly translationLdu: LduVector3;
} {
  if (frame.schemaVersion !== "mesh-asset-to-catalog-frame/1") {
    throw new TypeError(
      `Visual admission requires mesh-asset-to-catalog-frame/1; received ${JSON.stringify(frame.schemaVersion)}.`,
    );
  }
  const orientation = PROPER_ORIENTATIONS.find(({ id }) => id === frame.orientationId);
  if (orientation === undefined) {
    throw new TypeError(
      `Visual admission frame ${JSON.stringify(frame.orientationId)} is not one of the ${PROPER_ORIENTATIONS.length} proper source/catalog orientations.`,
    );
  }
  if (
    !Array.isArray(frame.translationLdu) ||
    frame.translationLdu.length !== 3 ||
    !frame.translationLdu.every(Number.isSafeInteger)
  ) {
    throw new TypeError(
      `Visual admission frame translation must contain three safe-integer LDU coordinates; received ${JSON.stringify(frame.translationLdu)}.`,
    );
  }
  return { matrix: orientation.matrix, translationLdu: frame.translationLdu };
}

/**
 * How each attribute `LDrawLoader` emits moves into scene units: a point takes
 * the frame's translation and the LDU scale, a displacement (a conditional
 * line's `direction`, one point minus another) the scale alone, and a unit
 * normal only the rotation.
 */
const SOURCE_ATTRIBUTE_KINDS: Readonly<Record<string, "point" | "displacement" | "normal">> = {
  position: "point",
  control0: "point",
  control1: "point",
  direction: "displacement",
  normal: "normal",
};

interface SourceGeometryObject extends Object3D {
  readonly geometry: BufferGeometry;
}

function hasGeometry(object: Object3D): object is SourceGeometryObject {
  return (object as Partial<SourceGeometryObject>).geometry?.isBufferGeometry === true;
}

/**
 * Moves an `LDrawLoader` part tree from raw source LDU into Three scene units,
 * in place, with the arithmetic the production mesh route gives the candidate:
 * the recipe frame in LDU, written as the catalog resolver writes it, then
 * `lduToThreeVector` or `lduDirectionToThree`, rounded once into Float32. Both
 * sides then reach the GPU as scene-unit attributes under identity object
 * matrices, so equal attributes draw equal pixels.
 *
 * Placing the source with an object matrix instead sent only the source
 * through Three's decompose and compose round trip and the normal matrix of a
 * 0.05-scaled map. That different float path alone moved one underside-oblique
 * pixel by one channel step on 2026-09-24.
 *
 * The frame and the basis change are both proper rotations, so every triangle
 * keeps its winding. Equal attributes still need source coordinates Float32
 * holds exactly: the loader stores raw LDU in Float32 before this runs, while
 * production rounds once after scaling, so a coordinate such as 12.4 LDU can
 * land one Float32 step apart on the two sides.
 *
 * The loader's part cache shares these geometries with its clones, so a loader
 * is not reused once its output is baked.
 */
export function bakeLDrawSourceIntoCatalogThree(root: Object3D, frame: SourceFrame): void {
  const { matrix, translationLdu } = properSourceFrame(frame);
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = matrix;
  const [tx, ty, tz] = translationLdu;
  const identity = new Matrix4();
  const geometries = new Set<BufferGeometry>();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!hasGeometry(object)) return;
    if (!object.matrixWorld.equals(identity)) {
      throw new TypeError(
        `Visual admission bakes raw LDU source geometry, so every source object must sit at identity; ${object.type} ${JSON.stringify(object.name)} has world matrix ${JSON.stringify(object.matrixWorld.elements)}.`,
      );
    }
    geometries.add(object.geometry);
  });
  for (const geometry of geometries) {
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const kind = SOURCE_ATTRIBUTE_KINDS[name];
      if (
        kind === undefined ||
        !(attribute instanceof BufferAttribute) ||
        !(attribute.array instanceof Float32Array) ||
        attribute.itemSize !== 3 ||
        attribute.normalized
      ) {
        throw new TypeError(
          `Visual admission cannot move source attribute ${JSON.stringify(name)} into scene units; it bakes only Float32 xyz ${Object.keys(SOURCE_ATTRIBUTE_KINDS).join(", ")}.`,
        );
      }
      for (let vertex = 0; vertex < attribute.count; vertex += 1) {
        const x = attribute.getX(vertex);
        const y = attribute.getY(vertex);
        const z = attribute.getZ(vertex);
        const rotated: LduVector3 = [
          m11 * x + m12 * y + m13 * z,
          m21 * x + m22 * y + m23 * z,
          m31 * x + m32 * y + m33 * z,
        ];
        if (kind === "normal") {
          attribute.setXYZ(vertex, ...lduDirectionToThree(...rotated));
          continue;
        }
        const scene = lduToThreeVector(
          kind === "point" ? [rotated[0] + tx, rotated[1] + ty, rotated[2] + tz] : rotated,
        );
        attribute.setXYZ(vertex, scene.x, scene.y, scene.z);
      }
      attribute.needsUpdate = true;
    }
    geometry.boundingBox = null;
    geometry.boundingSphere = null;
  }
}
