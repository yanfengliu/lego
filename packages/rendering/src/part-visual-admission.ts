import { deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  MESH_RENDER_UNITS_PER_LDU,
  UPRIGHT_ORIENTATIONS,
  type MeshReferenceGeometryRecipe,
} from "@lego-studio/catalog";
import { Box3, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

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

/** Maps raw LDraw LDU through the catalog recipe's frame and then into Three +Y-up units. */
export function ldrawAssetToCatalogThreeMatrix(
  frame: MeshReferenceGeometryRecipe["assetToCatalogFrame"],
): Matrix4 {
  if (frame.schemaVersion !== "mesh-asset-to-catalog-frame/1") {
    throw new TypeError(
      `Visual admission requires mesh-asset-to-catalog-frame/1; received ${JSON.stringify(frame.schemaVersion)}.`,
    );
  }
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === frame.orientationId);
  if (orientation === undefined) {
    throw new TypeError(
      `Visual admission frame ${JSON.stringify(frame.orientationId)} is not one of ${UPRIGHT_ORIENTATIONS.map(({ id }) => id).join(", ")}.`,
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
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = orientation.matrix;
  const [tx, ty, tz] = frame.translationLdu;
  const scale = MESH_RENDER_UNITS_PER_LDU;
  return new Matrix4().set(
    m11 * scale,
    m12 * scale,
    m13 * scale,
    tx * scale,
    -m21 * scale,
    -m22 * scale,
    -m23 * scale,
    -ty * scale,
    m31 * scale,
    m32 * scale,
    m33 * scale,
    tz * scale,
    0,
    0,
    0,
    1,
  );
}
