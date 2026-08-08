import { Box3, OrthographicCamera, Vector3 } from "three";

import { overlap, type Silhouette } from "./silhouette.ts";

/**
 * Fits the camera a booklet panel was drawn with, against geometry we already
 * know.
 *
 * This is the move that makes closed-loop assembly cheap. At step N the model
 * built so far is known exactly, so recovering the panel's camera is an
 * optimisation against known geometry rather than a guess, and every panel
 * re-calibrates from scratch — camera drift cannot accumulate across 359 steps.
 *
 * Four of the six parameters are solved rather than searched. Once a view
 * direction is chosen, the scale and the image-plane offset follow in closed
 * form from the two silhouettes' areas and centroids, so the search is a plain
 * two-dimensional sweep over azimuth and elevation. Continuous roll is not a
 * parameter: printed panels are axis-aligned, and a free roll term would trade a
 * real constraint for a degree of freedom that only helps the fit lie. The one
 * discrete half-turn `upSign` carries is not fitted either — see below.
 */
export interface OrthographicViewParameters {
  /** Rotation about the vertical axis, degrees. */
  readonly azimuthDegrees: number;
  /** Angle above the horizon, degrees. */
  readonly elevationDegrees: number;
  /** Image scale: how many pixels one world unit spans. */
  readonly pixelsPerUnit: number;
  /** Where the camera's view axis lands in the image, in pixels. */
  readonly centerXPx: number;
  readonly centerYPx: number;
  /**
   * Which way the model's own up axis points in the image: `1` up the page,
   * `-1` down it. Defaults to `1`.
   *
   * This is the half-turn a booklet takes when it turns the model over, and it
   * is not expressible as an azimuth and an elevation. Turning a model by any
   * half-turn `R` about a horizontal axis and photographing it from a camera at
   * `(A, e)` is the same picture as photographing the *unturned* model from
   * `R⁻¹` of that camera — and `R⁻¹` carries the up vector to `-Y`, because a
   * half-turn about a horizontal axis is exactly what inverts up. Negating the
   * azimuth and the elevation moves the eye; it does not roll the image, and no
   * `(A, e)` pair does: with up pinned to `+Y`, the image's vertical axis always
   * has a positive world-`Y` component while `|e| < 90`, so the rolled image is
   * outside the family.
   *
   * It is a fact about which face the panel draws, supplied by the booklet's own
   * rotate-the-model icon, rather than a parameter any fit may move: a projected
   * square lattice is invariant under it, so no fit could recover it and a fit
   * free to choose it would only gain a way to lie. `fitCameraToSilhouette` and
   * its refinement never set it.
   */
  readonly upSign?: 1 | -1;
}

export interface OrthographicViewFrame {
  readonly widthPx: number;
  readonly heightPx: number;
  /** What the camera looks at, in Three.js world units. */
  readonly target: readonly [number, number, number];
  /** Half-extent of everything that must stay inside the depth range. */
  readonly sceneRadius: number;
}

const DEGREES = Math.PI / 180;

/**
 * The frame a derived scene should be fitted in: what to look at, and how much
 * depth range has to stay inside the frustum. Every step of a build needs one,
 * and deriving it from the scene's own bounds is what keeps the camera pointed
 * at the model as the model grows.
 */
export function instructionViewFrame(
  bounds: Box3,
  widthPx: number,
  heightPx: number,
): OrthographicViewFrame {
  if (bounds.isEmpty()) {
    return { widthPx, heightPx, target: [0, 0, 0], sceneRadius: 1 };
  }
  const center = bounds.getCenter(new Vector3());
  return {
    widthPx,
    heightPx,
    target: [center.x, center.y, center.z],
    // Half the diagonal, floored so a single-part model still has a frustum.
    sceneRadius: Math.max(bounds.min.distanceTo(bounds.max) / 2, 0.5),
  };
}

function requireFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${String(value)}`);
  }
  return value;
}

/** Unit vector from the target toward the camera. */
export function viewDirection(azimuthDegrees: number, elevationDegrees: number): Vector3 {
  const azimuth = requireFinite(azimuthDegrees, "azimuthDegrees") * DEGREES;
  const elevation = requireFinite(elevationDegrees, "elevationDegrees") * DEGREES;
  const horizontal = Math.cos(elevation);
  return new Vector3(
    horizontal * Math.sin(azimuth),
    Math.sin(elevation),
    horizontal * Math.cos(azimuth),
  );
}

/**
 * An orthographic camera whose projection puts a camera-space point at pixel
 * `(centerX + x * pixelsPerUnit, centerY - y * pixelsPerUnit)`. The asymmetric
 * frustum is what carries the image-plane offset, so the camera stays on the
 * view axis and the fit's translation never leaks into its rotation.
 */
export function createOrthographicViewCamera(
  parameters: OrthographicViewParameters,
  frame: OrthographicViewFrame,
): OrthographicCamera {
  const { widthPx, heightPx, sceneRadius } = frame;
  const pixelsPerUnit = requireFinite(parameters.pixelsPerUnit, "pixelsPerUnit");
  if (pixelsPerUnit <= 0) {
    throw new RangeError(`pixelsPerUnit must be positive, received ${pixelsPerUnit}`);
  }
  if (!(sceneRadius > 0) || !Number.isFinite(sceneRadius)) {
    throw new RangeError(`sceneRadius must be a positive finite number, received ${sceneRadius}`);
  }
  const centerX = requireFinite(parameters.centerXPx, "centerXPx");
  const centerY = requireFinite(parameters.centerYPx, "centerYPx");

  const camera = new OrthographicCamera(
    -centerX / pixelsPerUnit,
    (widthPx - centerX) / pixelsPerUnit,
    centerY / pixelsPerUnit,
    -(heightPx - centerY) / pixelsPerUnit,
    0.01,
    sceneRadius * 8,
  );
  const target = new Vector3(...frame.target);
  const direction = viewDirection(parameters.azimuthDegrees, parameters.elevationDegrees);
  camera.position.copy(target).addScaledVector(direction, sceneRadius * 4);
  const upSign = parameters.upSign ?? 1;
  if (upSign !== 1 && upSign !== -1) {
    throw new RangeError(
      `upSign must be 1 or -1, received ${String(upSign)}. It is which way the model's own up axis ` +
        `points in the image, not a scale: a booklet that turns the model over inverts it, and ` +
        `nothing in between exists.`,
    );
  }
  // Straight down or straight up leaves the default up vector parallel to the
  // view axis, which makes lookAt degenerate; fall back to the world Z axis.
  const looksAlongUp = Math.abs(Math.abs(parameters.elevationDegrees) - 90) < 1e-6;
  camera.up.set(
    0,
    looksAlongUp ? 0 : upSign,
    looksAlongUp ? -Math.sign(parameters.elevationDegrees) * upSign : 0,
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.userData = { renderRole: "fitted-instruction-camera", ...parameters };
  return camera;
}

export interface CameraFitCandidate extends OrthographicViewParameters {
  readonly iou: number;
}

export interface CameraFitResult {
  readonly best: CameraFitCandidate | null;
  /** Every direction tried, best first, for inspecting a fit that went wrong. */
  readonly ranked: readonly CameraFitCandidate[];
  readonly renders: number;
  /** Set when no direction produced any overlap at all. */
  readonly failure: string | null;
}

export interface CameraFitOptions {
  /** Azimuths to sweep, degrees. */
  readonly azimuthDegrees?: readonly number[];
  /** Elevations to sweep, degrees. */
  readonly elevationDegrees?: readonly number[];
  /**
   * Local refinement passes around the best direction. Each halves the step and
   * re-tries the eight neighbours, so the angular resolution improves by 2^n:
   * five passes take the default 15-degree sweep to under half a degree. That
   * resolution is the fit's error floor, and on a small target half a degree of
   * residual rotation already costs several points of IoU.
   */
  readonly refinePasses?: number;
  /** How many of the swept directions are kept in `ranked`. */
  readonly keepRanked?: number;
  /**
   * How many times the scale-and-offset solve may be re-measured per direction.
   * One is exact when the trial render lands wholly inside the frame — a fit
   * seeded at the answer scores 1.0000 after a single pass — but a seed at
   * twice the scale in the opposite corner measures a clipped silhouette and
   * needs five (measured 0.807 at three passes, 0.976 at five). Passes stop as
   * soon as the solve settles, so a good seed does not pay for the budget.
   */
  readonly alignmentPasses?: number;
}

/**
 * A trial render of the known geometry under one set of view parameters. The
 * fitter never touches a renderer itself, which is what lets the search be
 * tested without a graphics context.
 */
export type RenderSilhouette = (parameters: OrthographicViewParameters) => Silhouette;

const DEFAULT_AZIMUTHS = Array.from({ length: 24 }, (_, index) => index * 15);
const DEFAULT_ELEVATIONS = [10, 20, 25, 30, 35, 40, 50];

/**
 * Solves the scale and offset that carry one silhouette onto another.
 *
 * Equal-area scaling, not bounding-box scaling: a booklet panel shows a few
 * parts we have not placed yet, and one stray part on the edge of the picture
 * moves a bounding box by its whole width while moving the area by a percent.
 */
function alignTo(
  trial: Silhouette,
  target: Silhouette,
  parameters: OrthographicViewParameters,
): OrthographicViewParameters | null {
  if (trial.area === 0 || target.area === 0) return null;
  const scale = Math.sqrt(target.area / trial.area);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    ...parameters,
    pixelsPerUnit: parameters.pixelsPerUnit * scale,
    centerXPx: target.centroidXPx! - scale * (trial.centroidXPx! - parameters.centerXPx),
    centerYPx: target.centroidYPx! - scale * (trial.centroidYPx! - parameters.centerYPx),
  };
}

export function fitOrthographicView(
  renderSilhouette: RenderSilhouette,
  target: Silhouette,
  seed: Pick<OrthographicViewParameters, "pixelsPerUnit" | "centerXPx" | "centerYPx">,
  options: CameraFitOptions = {},
): CameraFitResult {
  const azimuths = options.azimuthDegrees ?? DEFAULT_AZIMUTHS;
  const elevations = options.elevationDegrees ?? DEFAULT_ELEVATIONS;
  const refinePasses = options.refinePasses ?? 5;
  const keepRanked = options.keepRanked ?? 8;
  const alignmentPasses = options.alignmentPasses ?? 6;
  if (!Number.isInteger(alignmentPasses) || alignmentPasses < 1) {
    throw new RangeError(
      `alignmentPasses must be a positive integer, received ${String(alignmentPasses)}`,
    );
  }
  if (azimuths.length === 0 || elevations.length === 0) {
    throw new RangeError(
      `A camera fit needs at least one azimuth and one elevation to sweep, received ${azimuths.length} and ${elevations.length}. ` +
        `Omit the option to sweep the defaults, or pass the previous step's fitted direction to search a narrow window around it.`,
    );
  }
  if (target.area === 0) {
    return {
      best: null,
      ranked: [],
      renders: 0,
      failure:
        `The target silhouette is empty: no pixel of the ${target.width}x${target.height} raster differed from the background. ` +
        `Either the crop holds no model art, or it was keyed against the wrong background colour — a booklet page also needs a tolerance above 0 for its antialiasing.`,
    };
  }

  let renders = 0;
  const scored: CameraFitCandidate[] = [];
  const seen = new Set<string>();

  const score = (azimuthDegrees: number, elevationDegrees: number): CameraFitCandidate | null => {
    const key = `${azimuthDegrees.toFixed(4)}:${elevationDegrees.toFixed(4)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    let current: OrthographicViewParameters = { ...seed, azimuthDegrees, elevationDegrees };
    let trial = renderSilhouette(current);
    renders += 1;
    // The align is exact only when the trial render is whole. A seed that puts
    // the model half outside the frame measures a truncated area and centroid,
    // so the first correction is wrong and the second — measured on a render
    // that is now nearly in place — is right. Iterate until it settles.
    for (let pass = 0; pass < alignmentPasses; pass += 1) {
      const aligned = alignTo(trial, target, current);
      if (!aligned) return null;
      const settled =
        Math.abs(aligned.pixelsPerUnit - current.pixelsPerUnit) < current.pixelsPerUnit * 5e-4 &&
        Math.abs(aligned.centerXPx - current.centerXPx) < 0.1 &&
        Math.abs(aligned.centerYPx - current.centerYPx) < 0.1;
      current = aligned;
      trial = renderSilhouette(current);
      renders += 1;
      if (settled) break;
    }
    const candidate = { ...current, iou: overlap(trial, target).iou };
    scored.push(candidate);
    return candidate;
  };

  for (const elevationDegrees of elevations) {
    for (const azimuthDegrees of azimuths) score(azimuthDegrees, elevationDegrees);
  }

  let best = scored.reduce<CameraFitCandidate | null>(
    (leader, candidate) => (leader === null || candidate.iou > leader.iou ? candidate : leader),
    null,
  );
  if (best === null || best.iou === 0) {
    const swept = `${azimuths.length} azimuths x ${elevations.length} elevations in ${renders} renders`;
    const seedDescription = `seed pixelsPerUnit=${seed.pixelsPerUnit}, centre=(${seed.centerXPx}, ${seed.centerYPx})`;
    return {
      best: null,
      ranked: [],
      renders,
      failure:
        best === null
          ? `Every swept direction rendered an empty silhouette (${swept}), so the geometry never reached the frame. ` +
            `Check that the frame's target and sceneRadius came from this scene's own bounds, and that ${seedDescription} does not put the model outside the raster.`
          : `No swept direction overlapped the ${target.area}-pixel target at all (${swept}), so the best intersection over union was 0. ` +
            `The model and the target are disjoint rather than merely misaligned: this is usually the wrong document for this panel, or a target keyed from a different background than the render.`,
    };
  }

  // The sweep only has to land in the right basin. Refinement halves the step
  // each pass, so three passes take a 15-degree grid to under 2 degrees.
  let azimuthStep = azimuths.length > 1 ? Math.abs(azimuths[1]! - azimuths[0]!) : 15;
  let elevationStep = elevations.length > 1 ? Math.abs(elevations[1]! - elevations[0]!) : 10;
  for (let pass = 0; pass < refinePasses; pass += 1) {
    azimuthStep /= 2;
    elevationStep /= 2;
    const around = best;
    for (const azimuthOffset of [-azimuthStep, 0, azimuthStep]) {
      for (const elevationOffset of [-elevationStep, 0, elevationStep]) {
        if (azimuthOffset === 0 && elevationOffset === 0) continue;
        const candidate = score(
          around.azimuthDegrees + azimuthOffset,
          around.elevationDegrees + elevationOffset,
        );
        if (candidate && candidate.iou > best.iou) best = candidate;
      }
    }
  }

  return {
    best,
    ranked: [...scored].sort((left, right) => right.iou - left.iou).slice(0, keepRanked),
    renders,
    failure: null,
  };
}
