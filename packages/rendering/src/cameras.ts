import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

import { CANONICAL_CAMERA_POLICY_VERSION, RENDERING_VERSION } from "./constants.ts";
import { THREE_UNITS_PER_LDU } from "./coordinates.ts";
import type {
  CanonicalCamera,
  CanonicalViewDefinition,
  CanonicalViewName,
  CanonicalViewPacket,
  CanonicalViewPacketOptions,
  DerivedBrickScene,
} from "./types.ts";

export const CANONICAL_VIEW_NAMES = [
  "isometric",
  "front",
  "back",
  "left",
  "right",
  "top",
  "underside",
] as const satisfies readonly CanonicalViewName[];

interface ViewBasis {
  readonly name: CanonicalViewName;
  readonly direction: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly projection: "perspective" | "orthographic";
}

const VIEW_BASES: readonly ViewBasis[] = [
  { name: "isometric", direction: [1, 1, 1], up: [0, 1, 0], projection: "perspective" },
  { name: "front", direction: [0, 0, 1], up: [0, 1, 0], projection: "orthographic" },
  { name: "back", direction: [0, 0, -1], up: [0, 1, 0], projection: "orthographic" },
  { name: "left", direction: [-1, 0, 0], up: [0, 1, 0], projection: "orthographic" },
  { name: "right", direction: [1, 0, 0], up: [0, 1, 0], projection: "orthographic" },
  { name: "top", direction: [0, 1, 0], up: [0, 0, -1], projection: "orthographic" },
  { name: "underside", direction: [0, -1, 0], up: [0, 0, 1], projection: "orthographic" },
] as const;

const FALLBACK_MIN = new Vector3(-0.5, -0.5, -0.5);
const FALLBACK_MAX = new Vector3(0.5, 0.5, 0.5);

function tuple(vector: Vector3): readonly [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return value;
}

export function createCanonicalViewPacket(
  projection: Pick<DerivedBrickScene, "documentHash" | "bounds">,
  options: CanonicalViewPacketOptions = {},
): CanonicalViewPacket {
  const padding = requirePositiveFinite(options.padding ?? 1.35, "padding");
  const perspectiveFovDegrees = requirePositiveFinite(
    options.perspectiveFovDegrees ?? 35,
    "perspectiveFovDegrees",
  );
  if (perspectiveFovDegrees >= 179) {
    throw new RangeError("perspectiveFovDegrees must be less than 179");
  }

  const usedFallbackBounds = projection.bounds.isEmpty();
  const min = usedFallbackBounds ? FALLBACK_MIN.clone() : projection.bounds.min.clone();
  const max = usedFallbackBounds ? FALLBACK_MAX.clone() : projection.bounds.max.clone();
  const center = min.clone().add(max).multiplyScalar(0.5);
  const radius = Math.max(min.distanceTo(max) / 2, 0.5);
  const frameRadius = radius * padding;
  const fovRadians = (perspectiveFovDegrees * Math.PI) / 180;
  const perspectiveDistance = frameRadius / Math.sin(fovRadians / 2);
  const orthographicDistance = frameRadius * 3;

  const views = VIEW_BASES.map(({ name, direction, up, projection: viewProjection }) => {
    const normalizedDirection = new Vector3(...direction).normalize();
    const distance = viewProjection === "perspective" ? perspectiveDistance : orthographicDistance;
    const position = center.clone().addScaledVector(normalizedDirection, distance);
    const near = Math.max(0.01, distance - frameRadius * 1.5);
    const far = distance + frameRadius * 2.5;

    return {
      name,
      projection: viewProjection,
      position: tuple(position),
      target: tuple(center),
      up,
      near,
      far,
      frameRadius,
      verticalFovDegrees: viewProjection === "perspective" ? perspectiveFovDegrees : null,
    } satisfies CanonicalViewDefinition;
  });

  return {
    schemaVersion: "lego.canonical-view-packet/1",
    rendererVersion: RENDERING_VERSION,
    cameraPolicyVersion: CANONICAL_CAMERA_POLICY_VERSION,
    documentHash: projection.documentHash,
    coordinateSystem: "three-plus-y-up",
    sourceCoordinateSystem: "ldu-minus-y-up",
    threeUnitsPerLdu: THREE_UNITS_PER_LDU,
    bounds: { min: tuple(min), max: tuple(max) },
    usedFallbackBounds,
    views,
  };
}

export function createCameraForView(
  view: CanonicalViewDefinition,
  aspectRatio = 1,
): CanonicalCamera {
  requirePositiveFinite(aspectRatio, "aspectRatio");
  let camera: PerspectiveCamera | OrthographicCamera;

  if (view.projection === "perspective") {
    if (view.verticalFovDegrees === null) {
      throw new TypeError("Perspective canonical view requires verticalFovDegrees");
    }
    const verticalHalfFov = (view.verticalFovDegrees * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspectRatio);
    const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
    const requiredDistance = view.frameRadius / Math.sin(limitingHalfFov);
    const target = new Vector3(...view.target);
    const direction = new Vector3(...view.position).sub(target).normalize();
    const portraitConstrained = horizontalHalfFov < verticalHalfFov;
    const near = portraitConstrained
      ? Math.max(0.01, requiredDistance - view.frameRadius * 1.5)
      : view.near;
    const far = portraitConstrained ? requiredDistance + view.frameRadius * 2.5 : view.far;
    camera = new PerspectiveCamera(view.verticalFovDegrees, aspectRatio, near, far);
    if (portraitConstrained) {
      camera.position.copy(target.clone().addScaledVector(direction, requiredDistance));
    } else {
      camera.position.fromArray(view.position);
    }
  } else {
    const halfHeight = view.frameRadius * Math.max(1, 1 / aspectRatio);
    const halfWidth = halfHeight * aspectRatio;
    camera = new OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      view.near,
      view.far,
    );
  }

  camera.name = `canonical-camera:${view.name}`;
  if (view.projection === "orthographic") camera.position.fromArray(view.position);
  camera.up.fromArray(view.up);
  camera.lookAt(new Vector3(...view.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.userData = {
    renderRole: "canonical-camera",
    canonicalViewName: view.name,
    canonicalProjection: view.projection,
  };
  return camera;
}

export function fitPerspectiveCameraToFrame(
  camera: PerspectiveCamera,
  target: Vector3,
  frameRadius: number,
  aspectRatio: number,
): void {
  requirePositiveFinite(frameRadius, "frameRadius");
  requirePositiveFinite(aspectRatio, "aspectRatio");
  const verticalHalfFov = (camera.fov * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspectRatio);
  const requiredDistance = frameRadius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
  const offset = camera.position.clone().sub(target);
  const currentDistance = offset.length();
  const tolerance = Number.EPSILON * Math.max(1, currentDistance, requiredDistance) * 8;
  if (requiredDistance > currentDistance + tolerance) {
    const direction = currentDistance > 0 ? offset.normalize() : new Vector3(1, 1, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, requiredDistance);
    camera.near = Math.max(0.01, requiredDistance - frameRadius * 1.5);
    camera.far = requiredDistance + frameRadius * 2.5;
  }
  camera.aspect = aspectRatio;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
