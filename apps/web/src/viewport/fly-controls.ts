/**
 * WASD camera movement, expressed as displacements along the camera's own
 * basis. Kept free of Three.js so the feel — speed scaling, diagonal
 * normalisation, boost — is unit-testable without a renderer.
 */

/** Physical key positions, so the rig stays under the left hand on any layout. */
export const FLY_KEY_AXES: Readonly<Record<string, keyof FlyAxes>> = Object.freeze({
  KeyW: "forward",
  KeyS: "forward",
  KeyA: "right",
  KeyD: "right",
  KeyQ: "up",
  KeyE: "up",
});

const FLY_KEY_SIGNS: Readonly<Record<string, number>> = Object.freeze({
  KeyW: 1,
  KeyS: -1,
  KeyD: 1,
  KeyA: -1,
  KeyE: 1,
  KeyQ: -1,
});

export const BOOST_KEYS: readonly string[] = Object.freeze(["ShiftLeft", "ShiftRight"]);

/** Slowest and fastest the rig may travel, in scene units per second. */
export const MIN_FLY_SPEED = 0.4 as const;
export const MAX_FLY_SPEED = 40 as const;
export const BOOST_MULTIPLIER = 3 as const;

export interface FlyAxes {
  readonly forward: number;
  readonly right: number;
  readonly up: number;
}

export interface FlyInput {
  /** KeyboardEvent.code values currently held down. */
  readonly pressedKeys: Iterable<string>;
  /** Distance from camera to orbit target; movement scales with it. */
  readonly orbitDistance: number;
  readonly seconds: number;
}

export function isFlyKey(code: string): boolean {
  return code in FLY_KEY_AXES;
}

/** Raw per-axis intent in [-1, 1]; opposing keys cancel. */
export function flyAxesFromKeys(pressedKeys: Iterable<string>): FlyAxes {
  const axes = { forward: 0, right: 0, up: 0 };
  for (const code of pressedKeys) {
    const axis = FLY_KEY_AXES[code];
    if (axis === undefined) continue;
    axes[axis] += FLY_KEY_SIGNS[code] ?? 0;
  }
  return {
    forward: Math.sign(axes.forward),
    right: Math.sign(axes.right),
    up: Math.sign(axes.up),
  };
}

/**
 * Travel scales with how far out the user is, so the same keypress feels the
 * same whether they are inspecting one stud or the whole model.
 */
export function flySpeed(orbitDistance: number, boosted: boolean): number {
  if (!Number.isFinite(orbitDistance) || orbitDistance < 0) {
    throw new RangeError(
      `fly speed needs a non-negative finite orbit distance, received ${orbitDistance}`,
    );
  }
  const scaled = Math.min(Math.max(orbitDistance * 1.2, MIN_FLY_SPEED), MAX_FLY_SPEED);
  return boosted ? scaled * BOOST_MULTIPLIER : scaled;
}

/**
 * Displacement along the camera basis for one frame. Diagonals are normalised
 * so holding two keys never travels faster than holding one.
 */
export function flyDisplacement({ pressedKeys, orbitDistance, seconds }: FlyInput): FlyAxes {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`fly displacement needs a non-negative frame time, received ${seconds}`);
  }
  const held = [...pressedKeys];
  const axes = flyAxesFromKeys(held);
  const magnitude = Math.hypot(axes.forward, axes.right, axes.up);
  if (magnitude === 0) return { forward: 0, right: 0, up: 0 };

  const boosted = held.some((code) => BOOST_KEYS.includes(code));
  const step = (flySpeed(orbitDistance, boosted) * seconds) / magnitude;
  return {
    forward: axes.forward * step,
    right: axes.right * step,
    up: axes.up * step,
  };
}
