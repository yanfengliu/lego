import { Vector3, type Matrix4 } from "three";

import { BOOST_KEYS, flyDisplacement, isFlyKey } from "./fly-controls";

const WORLD_UP = new Vector3(0, 1, 0);
/** Ignore frame gaps longer than this; a backgrounded tab must not teleport the camera. */
const MAX_FRAME_SECONDS = 0.1;

/** The slice of the viewport runtime the rig drives, kept narrow for testability. */
export interface FlyRigTarget {
  readonly cameraPosition: Vector3;
  readonly cameraMatrixWorld: Matrix4;
  readonly orbitTarget: Vector3;
  applyMovement(): void;
}

export interface FlyRigOptions {
  readonly element: HTMLElement;
  readonly getTarget: () => FlyRigTarget | null;
  /** True while the camera must not respond, such as during a candidate preview. */
  readonly isSuspended: () => boolean;
}

/**
 * Installs WASD/QE camera flight on an element. Movement is applied to both the
 * camera and the orbit target, so orbiting afterwards pivots around wherever
 * the user flew to rather than snapping back.
 */
export function installFlyRig({ element, getTarget, isSuspended }: FlyRigOptions): () => void {
  const pressedKeys = new Set<string>();
  const right = new Vector3();
  const up = new Vector3();
  const back = new Vector3();
  const step = new Vector3();
  let frame: number | null = null;
  let lastTime = 0;

  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(advance);
  };

  function advance(now: number): void {
    frame = null;
    const target = getTarget();
    if (pressedKeys.size === 0 || !target || isSuspended()) return;

    const seconds = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = now;
    const displacement = flyDisplacement({
      pressedKeys,
      orbitDistance: target.cameraPosition.distanceTo(target.orbitTarget),
      seconds,
    });
    target.cameraMatrixWorld.extractBasis(right, up, back);
    step
      .set(0, 0, 0)
      .addScaledVector(back, -displacement.forward)
      .addScaledVector(right, displacement.right)
      // World up keeps Q/E vertical no matter where the camera is looking.
      .addScaledVector(WORLD_UP, displacement.up);
    target.cameraPosition.add(step);
    target.orbitTarget.add(step);
    target.applyMovement();
    schedule();
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (BOOST_KEYS.includes(event.code)) {
      pressedKeys.add(event.code);
      return;
    }
    if (!isFlyKey(event.code) || isSuspended()) return;
    event.preventDefault();
    if (pressedKeys.size === 0) lastTime = performance.now();
    pressedKeys.add(event.code);
    if (event.shiftKey) for (const boost of BOOST_KEYS) pressedKeys.add(boost);
    schedule();
  };
  const handleKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.code);
    if (!event.shiftKey) for (const boost of BOOST_KEYS) pressedKeys.delete(boost);
    if (pressedKeys.size === 0) stop();
  };
  // Losing focus mid-flight would otherwise strand the camera in motion.
  const handleBlur = () => {
    pressedKeys.clear();
    stop();
  };

  element.addEventListener("keydown", handleKeyDown);
  element.addEventListener("keyup", handleKeyUp);
  element.addEventListener("blur", handleBlur);
  window.addEventListener("blur", handleBlur);

  return () => {
    stop();
    element.removeEventListener("keydown", handleKeyDown);
    element.removeEventListener("keyup", handleKeyUp);
    element.removeEventListener("blur", handleBlur);
    window.removeEventListener("blur", handleBlur);
  };
}
