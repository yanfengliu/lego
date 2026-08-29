import { getPartDefinition } from "@lego-studio/catalog";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";
import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D, type Scene } from "three";

import { findBodyOverlaps, snapPlacementOrigin } from "../placement";
import { GROUND_PLANE_THREE_Y, resolveDropSupport, threePointToLdu } from "./drop-target";
import { createGhostHandle } from "./placement-ghost";

/** What the pointer is currently carrying, if anything. */
type Pending =
  | { readonly kind: "place"; readonly catalogPartId: string; readonly orientationId: string }
  | {
      readonly kind: "move";
      readonly partId: string;
      readonly catalogPartId: string;
      readonly orientationId: string;
    };

export interface PlacementRigOptions {
  readonly element: HTMLElement;
  readonly scene: Scene;
  readonly getCamera: () => Camera;
  readonly getParts: () => readonly PartInstance[];
  readonly getPartObjects: () => readonly Object3D[];
  /** Catalog part id currently being dragged out of the palette, if any. */
  readonly getDraggedCatalogPartId: () => string | null;
  readonly getOrientationId: () => string;
  readonly isSuspended: () => boolean;
  readonly onPlace: (catalogPartId: string, transform: RigidTransform) => void;
  readonly onMove: (partId: string, transform: RigidTransform) => void;
  /** Called when the user cancels, so the palette can un-arm itself. */
  readonly onDisarm: () => void;
  readonly requestRender: () => void;
}

export interface PlacementRig {
  /** Arms a move so the part follows the pointer until it is dropped. */
  beginMove(partId: string): void;
  cancel(): void;
  readonly isPlacing: boolean;
  dispose(): void;
}

function partIdFromObject(object: Object3D | null): string | null {
  let current = object;
  while (current) {
    if (typeof current.userData.partId === "string") return current.userData.partId;
    current = current.parent;
  }
  return null;
}

export function installPlacementRig(options: PlacementRigOptions): PlacementRig {
  const {
    element,
    scene,
    getCamera,
    getParts,
    getPartObjects,
    getDraggedCatalogPartId,
    getOrientationId,
    isSuspended,
    onPlace,
    onMove,
    onDisarm,
    requestRender,
  } = options;

  const ghost = createGhostHandle(scene);
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), -GROUND_PLANE_THREE_Y);
  const groundHit = new Vector3();
  let pending: Pending | null = null;
  let lastTransform: RigidTransform | null = null;

  function castFrom(clientX: number, clientY: number): void {
    const bounds = element.getBoundingClientRect();
    pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, getCamera());
  }

  /** Resolves the snapped transform under the pointer, or null if the ray escapes the scene. */
  function resolveTransform(
    clientX: number,
    clientY: number,
    active: Pending,
  ): RigidTransform | null {
    castFrom(clientX, clientY);
    const ignoreId = active.kind === "move" ? active.partId : null;
    const candidates = getPartObjects().filter((object) => partIdFromObject(object) !== ignoreId);
    const hit = raycaster.intersectObjects(candidates, true)[0];
    const hitPartId = partIdFromObject(hit?.object ?? null);
    const point = hit?.point ?? raycaster.ray.intersectPlane(groundPlane, groundHit) ?? null;
    if (!point) return null;

    const support = resolveDropSupport(hitPartId, getParts());
    try {
      return {
        positionLdu: snapPlacementOrigin({
          catalogPartId: active.catalogPartId,
          orientationId: active.orientationId,
          rawLdu: threePointToLdu(point),
          supportUndersideLdu: support.supportUndersideLdu,
        }),
        orientationId: active.orientationId,
      };
    } catch {
      // An unplaceable part simply shows no ghost; the palette cannot offer one.
      return null;
    }
  }

  function updateGhost(clientX: number, clientY: number): void {
    if (!pending || isSuspended()) return;
    const transform = resolveTransform(clientX, clientY, pending);
    lastTransform = transform;
    const definition = getPartDefinition(pending.catalogPartId);
    if (!transform || !definition) {
      if (ghost.hide()) requestRender();
      return;
    }
    const ignore = pending.kind === "move" ? [pending.partId] : [];
    const blocked = findBodyOverlaps(
      { catalogPartId: pending.catalogPartId, transform },
      getParts(),
      ignore,
    );
    if (ghost.show(definition, transform, blocked.length > 0 ? "blocked" : "valid")) {
      requestRender();
    }
  }

  function clearPending(): void {
    pending = null;
    lastTransform = null;
    if (ghost.hide()) requestRender();
  }

  function commit(): void {
    const active = pending;
    const transform = lastTransform;
    clearPending();
    if (!active || !transform) return;
    if (active.kind === "place") onPlace(active.catalogPartId, transform);
    else onMove(active.partId, transform);
  }

  /**
   * Selecting a part in the palette arms placement; the ghost then previews it
   * under the pointer until a click commits. The tool stays armed afterwards so
   * a row of parts can be laid down without returning to the palette.
   */
  const handlePointerMove = (event: PointerEvent) => {
    if (pending?.kind === "move") {
      updateGhost(event.clientX, event.clientY);
      return;
    }
    const catalogPartId = getDraggedCatalogPartId();
    if (catalogPartId === null || isSuspended()) {
      if (pending) clearPending();
      return;
    }
    const orientationId = getOrientationId();
    const definition = getPartDefinition(catalogPartId);
    if (!definition?.legalOrientationIds.includes(orientationId)) {
      if (pending) clearPending();
      return;
    }
    if (
      pending?.kind !== "place" ||
      pending.catalogPartId !== catalogPartId ||
      pending.orientationId !== orientationId
    ) {
      pending = { kind: "place", catalogPartId, orientationId };
    }
    updateGhost(event.clientX, event.clientY);
  };
  // Both kinds commit on release, so click-then-click and press-and-drag work.
  const handlePointerUp = (event: PointerEvent) => {
    if (!pending || event.button !== 0) return;
    updateGhost(event.clientX, event.clientY);
    commit();
  };
  const handlePointerLeave = () => {
    if (pending?.kind === "place") clearPending();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    clearPending();
    onDisarm();
  };

  element.addEventListener("pointermove", handlePointerMove);
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("pointerleave", handlePointerLeave);
  element.addEventListener("keydown", handleKeyDown);

  return {
    beginMove(partId) {
      const part = getParts().find(({ id }) => id === partId);
      if (!part || isSuspended()) return;
      pending = {
        kind: "move",
        partId,
        catalogPartId: part.catalogPartId,
        orientationId: part.transform.orientationId,
      };
      lastTransform = null;
    },
    cancel: clearPending,
    get isPlacing() {
      return pending !== null;
    },
    dispose() {
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointerleave", handlePointerLeave);
      element.removeEventListener("keydown", handleKeyDown);
      ghost.dispose();
    },
  };
}
