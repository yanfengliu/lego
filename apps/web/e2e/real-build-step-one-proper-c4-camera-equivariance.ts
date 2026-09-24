import { LDU_TO_THREE_AXIS_SIGNS } from "@lego-studio/rendering";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "./real-build-panel-camera-resolver-boundary";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";

export type RealBuildStepOneProperC4QuarterTurn = 0 | 90 | 180 | 270;

const QUARTER_TURNS: readonly RealBuildStepOneProperC4QuarterTurn[] = [0, 90, 180, 270];

function quarterTurn(value: unknown, label: string): RealBuildStepOneProperC4QuarterTurn {
  if (!QUARTER_TURNS.includes(value as RealBuildStepOneProperC4QuarterTurn)) {
    throw new RangeError(`${label} must be exactly 0, 90, 180, or 270 degrees.`);
  }
  return value as RealBuildStepOneProperC4QuarterTurn;
}

function hypothesis(value: unknown): StepCameraLatticeHypothesis {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Proper-C4 camera equivariance requires one exact D4 hypothesis.");
  }
  const supplied = value as Partial<StepCameraLatticeHypothesis>;
  const retained = PANEL_CAMERA_ANGULAR_HYPOTHESES.find(
    (candidate) =>
      candidate.latticeHand === supplied.latticeHand &&
      candidate.latticeDeterminant === supplied.latticeDeterminant &&
      candidate.turnDegrees === supplied.turnDegrees,
  );
  if (retained === undefined || Reflect.ownKeys(value).length !== 3) {
    throw new TypeError("Proper-C4 camera equivariance requires one coherent exact D4 hypothesis.");
  }
  return retained;
}

function normalized(value: number): RealBuildStepOneProperC4QuarterTurn {
  return (((value % 360) + 360) % 360) as RealBuildStepOneProperC4QuarterTurn;
}

/**
 * The scene yaw one degree of document yaw becomes. A member turns its
 * representative by `upright-yaw-q`, a turn about LDU +Y. The renderer's basis
 * change `D` carries that to a turn about scene `det(D) * D * (0, 1, 0)`, which
 * is scene +Y times `sx * sz`. Under the half-turn about X this is -1: a member
 * turned by q is the representative turned by -q in the scene.
 */
const [SX, , SZ] = LDU_TO_THREE_AXIS_SIGNS;
const SCENE_YAW_PER_DOCUMENT_YAW = SX * SZ;

/**
 * Maps a camera on raw member Rq(representative) back to the representative camera.
 *
 * Turning the model by scene yaw `phi` looks the same as turning the camera by
 * `-phi`. A hypothesis puts its camera at scene azimuth `A + t` on the fitted
 * hand and `180 - (A + t)` on the reflected one, so the representative's turn
 * is `tMember - determinant * phi`, with `phi = SCENE_YAW_PER_DOCUMENT_YAW * q`.
 */
export function mapRealBuildStepOneProperC4MemberCameraToRepresentative(
  suppliedHypothesis: unknown,
  suppliedMemberTurnDegrees: unknown,
): StepCameraLatticeHypothesis {
  const retained = hypothesis(suppliedHypothesis);
  const memberTurn = quarterTurn(suppliedMemberTurnDegrees, "Proper-C4 member turn");
  return intrinsicRealBuildFreeze({
    latticeHand: retained.latticeHand,
    latticeDeterminant: retained.latticeDeterminant,
    turnDegrees: normalized(
      retained.turnDegrees - retained.latticeDeterminant * SCENE_YAW_PER_DOCUMENT_YAW * memberTurn,
    ),
  });
}

/** Inverse map used to render a rotated member for one retained representative camera. */
export function mapRealBuildStepOneProperC4RepresentativeCameraToMember(
  suppliedHypothesis: unknown,
  suppliedMemberTurnDegrees: unknown,
): StepCameraLatticeHypothesis {
  const retained = hypothesis(suppliedHypothesis);
  const memberTurn = quarterTurn(suppliedMemberTurnDegrees, "Proper-C4 member turn");
  return intrinsicRealBuildFreeze({
    latticeHand: retained.latticeHand,
    latticeDeterminant: retained.latticeDeterminant,
    turnDegrees: normalized(
      retained.turnDegrees + retained.latticeDeterminant * SCENE_YAW_PER_DOCUMENT_YAW * memberTurn,
    ),
  });
}
