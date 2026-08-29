import { PerspectiveCamera, Scene } from "three";
import { describe, expect, it } from "vitest";

import { installPlacementRig } from "./install-placement";

class PlacementElement extends EventTarget {
  public getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 };
  }
}

function pointerEvent(type: "pointermove" | "pointerup") {
  const event = new Event(type);
  Object.defineProperties(event, {
    clientX: { value: 50 },
    clientY: { value: 50 },
    button: { value: 0 },
  });
  return event;
}

describe("installPlacementRig orientation state", () => {
  it("refreshes an armed part's ghost and authored transform when its legal orientation changes", () => {
    const element = new PlacementElement();
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.01, 1000);
    camera.position.set(0, 5, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    let catalogPartId = "builtin:axle-1x3";
    let orientationId = "upright-yaw-0";
    const placements: { catalogPartId: string; orientationId: string; positionLdu: number[] }[] =
      [];
    const rig = installPlacementRig({
      element: element as unknown as HTMLElement,
      scene,
      getCamera: () => camera,
      getParts: () => [],
      getPartObjects: () => [],
      getDraggedCatalogPartId: () => catalogPartId,
      getOrientationId: () => orientationId,
      isSuspended: () => false,
      onPlace: (placedCatalogPartId, transform) =>
        placements.push({
          catalogPartId: placedCatalogPartId,
          orientationId: transform.orientationId,
          positionLdu: [...transform.positionLdu],
        }),
      onMove: () => undefined,
      onDisarm: () => undefined,
      requestRender: () => undefined,
    });

    try {
      element.dispatchEvent(pointerEvent("pointermove"));
      orientationId = "proper-m-00pp000p0";
      element.dispatchEvent(pointerEvent("pointermove"));
      element.dispatchEvent(pointerEvent("pointerup"));
      expect(placements).toHaveLength(1);
      expect(placements[0]).toMatchObject({
        catalogPartId: "builtin:axle-1x3",
        orientationId: "proper-m-00pp000p0",
      });
      expect(placements[0]!.positionLdu[1]).toBe(-18);
      expect(placements[0]!.positionLdu.every(Number.isSafeInteger)).toBe(true);

      catalogPartId = "builtin:brick-1x1";
      element.dispatchEvent(pointerEvent("pointermove"));
      element.dispatchEvent(pointerEvent("pointerup"));
      expect(placements).toHaveLength(1);
    } finally {
      rig.dispose();
    }
    expect(scene.children).toHaveLength(0);
  });
});
