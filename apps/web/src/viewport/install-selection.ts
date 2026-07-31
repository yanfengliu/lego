import { Raycaster, Vector2, type Camera, type Object3D } from "three";

import { keyboardSelection } from "../viewport-navigation";

/** Pointer travel, in CSS pixels, still treated as a click rather than a drag. */
const CLICK_SLOP_PX = 4;

export interface SelectionRigOptions {
  readonly element: HTMLElement;
  readonly getCamera: () => Camera;
  readonly getPartObjects: () => readonly Object3D[];
  readonly isSuspended: () => boolean;
  /** True while a ghost is following the pointer, so a release must not reselect. */
  readonly isPlacing: () => boolean;
  readonly getSelectedPartId: () => string | null;
  readonly onSelect: (partId: string | null) => void;
  readonly onBeginMove: (partId: string) => void;
}

export function partIdFromObject(object: Object3D | null): string | null {
  let current = object;
  while (current) {
    if (typeof current.userData.partId === "string") return current.userData.partId;
    current = current.parent;
  }
  return null;
}

/**
 * Left-click selection and double-click-to-move. Kept separate from orbiting,
 * which now lives on the middle and right buttons.
 */
export function installSelectionRig({
  element,
  getCamera,
  getPartObjects,
  isSuspended,
  isPlacing,
  getSelectedPartId,
  onSelect,
  onBeginMove,
}: SelectionRigOptions): () => void {
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  let pointerStart: { x: number; y: number; button: number } | null = null;
  let movingAtPointerDown = false;

  const pickAt = (clientX: number, clientY: number): string | null => {
    const bounds = element.getBoundingClientRect();
    pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, getCamera());
    const hit = raycaster.intersectObjects([...getPartObjects()], true)[0];
    return partIdFromObject(hit?.object ?? null);
  };

  const handlePointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
    movingAtPointerDown = isPlacing();
  };
  const handlePointerUp = (event: PointerEvent) => {
    const started = pointerStart;
    pointerStart = null;
    if (isSuspended() || movingAtPointerDown) return;
    if (
      !started ||
      started.button !== 0 ||
      Math.hypot(event.clientX - started.x, event.clientY - started.y) > CLICK_SLOP_PX
    ) {
      return;
    }
    onSelect(pickAt(event.clientX, event.clientY));
  };
  const handleDoubleClick = (event: MouseEvent) => {
    if (isSuspended()) return;
    const partId = pickAt(event.clientX, event.clientY);
    if (!partId) return;
    event.preventDefault();
    onSelect(partId);
    onBeginMove(partId);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isSuspended()) return;
    const partIds = getPartObjects()
      .map((object) => partIdFromObject(object))
      .filter((partId): partId is string => partId !== null);
    const next = keyboardSelection(getSelectedPartId(), partIds, event.key);
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
  };

  element.addEventListener("pointerdown", handlePointerDown);
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("dblclick", handleDoubleClick);
  element.addEventListener("keydown", handleKeyDown);

  return () => {
    element.removeEventListener("pointerdown", handlePointerDown);
    element.removeEventListener("pointerup", handlePointerUp);
    element.removeEventListener("dblclick", handleDoubleClick);
    element.removeEventListener("keydown", handleKeyDown);
  };
}
