import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { BrickDocumentV1, RigidTransform, ValidationReportV1 } from "@lego-studio/protocol";
import {
  createCameraForView,
  createCanonicalViewPacket,
  deriveBrickScene,
  THREE_UNITS_PER_LDU,
  fitPerspectiveCameraToFrame,
  orbitCameraFrustum,
  setBrickSceneSelection,
  type CanonicalViewPacket,
  type DerivedBrickScene,
} from "@lego-studio/rendering";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  MOUSE,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { GROUND_UNDERSIDE_LDU } from "../placement";
import { installFlyRig } from "../viewport/install-fly-rig";
import { installSelectionRig } from "../viewport/install-selection";
import { installPlacementRig, type PlacementRig } from "../viewport/install-placement";

export interface BrickViewportSnapshot {
  readonly contextLost: boolean;
  readonly viewPacket: CanonicalViewPacket | null;
  readonly rendererMemory: {
    readonly geometries: number;
    readonly textures: number;
  } | null;
}

export interface BrickViewportHandle {
  captureCanonicalViews(): Promise<Record<string, string>>;
  getSnapshot(): BrickViewportSnapshot;
  /** Arms a move so the part follows the pointer until it is dropped. */
  beginMove(partId: string): void;
}

interface BrickViewportProps {
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly selectedPartId: string | null;
  readonly previewing: boolean;
  /** Changing this re-frames the camera; editing the model never does. */
  readonly frameToken: number;
  /** Catalog part being dragged out of the palette, if any. */
  readonly draggedCatalogPartId: string | null;
  readonly onSelectPart: (partId: string | null) => void;
  readonly onPlacePart: (catalogPartId: string, transform: RigidTransform) => void;
  readonly onMovePart: (partId: string, transform: RigidTransform) => void;
  /** Called when the user presses Escape, so the palette can un-arm. */
  readonly onDisarm: () => void;
}

interface ViewportRuntime {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
  readonly grid: GridHelper;
  camera: Camera;
  controls: OrbitControls;
  projection: DerivedBrickScene | null;
  packet: CanonicalViewPacket | null;
  /** Covers the model and the ground grid so neither clips while orbiting. */
  sceneRadius: number;
}

const GRID_HALF_EXTENT = 20;
const GRID_SCENE_RADIUS = GRID_HALF_EXTENT * Math.SQRT2;

/** About six studs of working area, so an empty scene is not framed inside a brick. */
const MIN_INTERACTIVE_FRAME_RADIUS = 6;

/**
 * Left drag is reserved for selection and part dragging, so orbiting moves to
 * the middle button and panning to the right button.
 */
function configureOrbitControls(controls: OrbitControls, sceneRadius: number): void {
  controls.enableDamping = false;
  controls.screenSpacePanning = true;
  controls.maxDistance = sceneRadius * 50;
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.PAN };
}

/**
 * The canonical packet frustum is pinned to the distance it was authored at, so
 * an interactive camera that dollies past it loses the model. Retarget the
 * frustum to the live orbit distance before every frame instead.
 */
function syncOrbitFrustum(runtime: ViewportRuntime): void {
  const { camera } = runtime;
  if (!(camera instanceof PerspectiveCamera)) return;
  const { near, far } = orbitCameraFrustum(
    camera.position.distanceTo(runtime.controls.target),
    runtime.sceneRadius,
  );
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

function resizeCamera(
  camera: Camera,
  width: number,
  height: number,
  target?: Vector3,
  frameRadius?: number,
): void {
  if (camera instanceof PerspectiveCamera) {
    if (target && frameRadius)
      fitPerspectiveCameraToFrame(camera, target, frameRadius, width / height);
    else {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
}

export const BrickViewport = forwardRef<BrickViewportHandle, BrickViewportProps>(
  function BrickViewport(
    {
      document,
      validationReport,
      selectedPartId,
      previewing,
      frameToken,
      draggedCatalogPartId,
      onSelectPart,
      onPlacePart,
      onMovePart,
      onDisarm,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const runtimeRef = useRef<ViewportRuntime | null>(null);
    const previewingRef = useRef(previewing);
    const selectedPartIdRef = useRef(selectedPartId);
    const onSelectPartRef = useRef(onSelectPart);
    const documentRef = useRef(document);
    const draggedCatalogPartIdRef = useRef(draggedCatalogPartId);
    const onPlacePartRef = useRef(onPlacePart);
    const onMovePartRef = useRef(onMovePart);
    const onDisarmRef = useRef(onDisarm);
    const placementRef = useRef<PlacementRig | null>(null);
    const [contextLost, setContextLost] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const contextLostRef = useRef(false);
    const framedTokenRef = useRef<number | null>(null);
    const capturePromiseRef = useRef<Promise<Record<string, string>> | null>(null);

    previewingRef.current = previewing;
    selectedPartIdRef.current = selectedPartId;
    onSelectPartRef.current = onSelectPart;
    contextLostRef.current = contextLost;
    documentRef.current = document;
    draggedCatalogPartIdRef.current = draggedCatalogPartId;
    onPlacePartRef.current = onPlacePart;
    onMovePartRef.current = onMovePart;
    onDisarmRef.current = onDisarm;

    useImperativeHandle(
      ref,
      () => ({
        async captureCanonicalViews() {
          if (capturePromiseRef.current) return capturePromiseRef.current;
          const capture = async () => {
            const runtime = runtimeRef.current;
            const host = hostRef.current;
            if (!runtime || !host || !runtime.packet || contextLostRef.current) return {};

            const previousSize = runtime.renderer.getSize(new Vector2());
            const previousPixelRatio = runtime.renderer.getPixelRatio();
            const width = 640;
            const height = 480;
            runtime.renderer.setPixelRatio(1);
            runtime.renderer.setSize(width, height, false);
            try {
              const captures: Record<string, string> = {};
              for (const view of runtime.packet.views) {
                const camera = createCameraForView(view, width / height);
                runtime.renderer.render(runtime.scene, camera);
                captures[view.name] = runtime.renderer.domElement.toDataURL("image/png");
              }
              return captures;
            } finally {
              runtime.renderer.setPixelRatio(previousPixelRatio);
              runtime.renderer.setSize(previousSize.x, previousSize.y, false);
              resizeCamera(
                runtime.camera,
                previousSize.x,
                previousSize.y,
                runtime.controls.target,
                runtime.packet.views[0]?.frameRadius,
              );
              runtime.renderer.render(runtime.scene, runtime.camera);
            }
          };
          const pending = capture().finally(() => {
            if (capturePromiseRef.current === pending) capturePromiseRef.current = null;
          });
          capturePromiseRef.current = pending;
          return pending;
        },
        beginMove(partId: string) {
          placementRef.current?.beginMove(partId);
        },
        getSnapshot() {
          const runtime = runtimeRef.current;
          return {
            contextLost: contextLostRef.current,
            viewPacket: runtime?.packet ?? null,
            rendererMemory: runtime
              ? {
                  geometries: runtime.renderer.info.memory.geometries,
                  textures: runtime.renderer.info.memory.textures,
                }
              : null,
          };
        },
      }),
      [],
    );

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.className = "brick-canvas";
      renderer.domElement.setAttribute("aria-label", "Interactive derived brick model");
      renderer.domElement.setAttribute(
        "aria-keyshortcuts",
        "W A S D Q E Shift ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape",
      );
      renderer.domElement.tabIndex = 0;
      host.append(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(0x111512);
      const ambient = new AmbientLight(0xe7eee7, 1.65);
      ambient.userData.renderRole = "viewport-light";
      scene.add(ambient);
      const key = new DirectionalLight(0xfff4d2, 4.3);
      key.position.set(7, 10, 8);
      key.userData.renderRole = "viewport-light";
      scene.add(key);
      const fill = new DirectionalLight(0x9bb9df, 1.6);
      fill.position.set(-8, 5, -7);
      fill.userData.renderRole = "viewport-light";
      scene.add(fill);

      const grid = new GridHelper(40, 80, 0x5e685f, 0x273028);
      grid.material.transparent = true;
      grid.material.opacity = 0.52;
      grid.userData.renderRole = "viewport-grid";
      scene.add(grid);

      const camera = new PerspectiveCamera(35, 1, 0.01, 1000);
      camera.position.set(6, 5, 6);
      const controls = new OrbitControls(camera, renderer.domElement);
      configureOrbitControls(controls, GRID_SCENE_RADIUS);
      controls.target.set(0, 0, 0);
      controls.update();

      const runtime: ViewportRuntime = {
        scene,
        renderer,
        grid,
        camera,
        controls,
        projection: null,
        packet: null,
        sceneRadius: GRID_SCENE_RADIUS,
      };
      runtimeRef.current = runtime;

      const render = () => {
        if (contextLostRef.current) return;
        syncOrbitFrustum(runtime);
        renderer.render(scene, runtime.camera);
      };
      controls.addEventListener("change", render);

      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        resizeCamera(
          runtime.camera,
          width,
          height,
          runtime.controls.target,
          runtime.packet?.views[0]?.frameRadius,
        );
        render();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const placement = installPlacementRig({
        element: renderer.domElement,
        scene,
        getCamera: () => runtime.camera,
        getParts: () => documentRef.current.parts,
        getPartObjects: () => [...(runtime.projection?.partObjects.values() ?? [])],
        getDraggedCatalogPartId: () => draggedCatalogPartIdRef.current,
        getOrientationId: () => "upright-yaw-0",
        isSuspended: () => previewingRef.current || contextLostRef.current,
        onPlace: (catalogPartId, transform) => onPlacePartRef.current(catalogPartId, transform),
        onMove: (partId, transform) => onMovePartRef.current(partId, transform),
        onDisarm: () => onDisarmRef.current(),
        requestRender: render,
      });
      placementRef.current = placement;

      const disposeSelectionRig = installSelectionRig({
        element: renderer.domElement,
        getCamera: () => runtime.camera,
        getPartObjects: () => [...(runtime.projection?.partObjects.values() ?? [])],
        isSuspended: () => previewingRef.current || runtime.projection === null,
        isPlacing: () => placement.isPlacing,
        getSelectedPartId: () => selectedPartIdRef.current,
        onSelect: (partId) => onSelectPartRef.current(partId),
        onBeginMove: (partId) => placement.beginMove(partId),
      });

      const disposeFlyRig = installFlyRig({
        element: renderer.domElement,
        isSuspended: () => contextLostRef.current,
        getTarget: () => ({
          cameraPosition: runtime.camera.position,
          cameraMatrixWorld: runtime.camera.matrixWorld,
          orbitTarget: runtime.controls.target,
          applyMovement: () => runtime.controls.update(),
        }),
      });

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        contextLostRef.current = true;
        setContextLost(true);
      };
      const handleContextRestored = () => {
        contextLostRef.current = false;
        setContextLost(false);
        render();
      };
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

      return () => {
        resizeObserver.disconnect();
        controls.removeEventListener("change", render);
        runtime.controls.dispose();
        disposeSelectionRig();
        disposeFlyRig();
        placement.dispose();
        placementRef.current = null;
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
        runtime.projection?.dispose();
        grid.geometry.dispose();
        grid.material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        runtimeRef.current = null;
      };
    }, []);

    useEffect(() => {
      const runtime = runtimeRef.current;
      const host = hostRef.current;
      if (!runtime || !host) return;

      let replacement: DerivedBrickScene | null = null;
      let packet: CanonicalViewPacket;
      try {
        replacement = deriveBrickScene(document, { validationReport });
        packet = createCanonicalViewPacket(replacement);
        if (!packet.views[0]) throw new Error("Canonical isometric view is unavailable");
      } catch (error) {
        replacement?.dispose();
        setRenderError(error instanceof Error ? error.message : "Model rendering failed");
        return;
      }

      runtime.projection?.dispose();
      runtime.projection = replacement;
      runtime.packet = packet;
      runtime.scene.add(replacement.root);
      setRenderError(null);

      const view = packet.views[0]!;
      runtime.sceneRadius = Math.max(view.frameRadius, GRID_SCENE_RADIUS);
      runtime.controls.maxDistance = runtime.sceneRadius * 50;

      // The camera belongs to the user. Editing the model must never move it,
      // so re-framing happens only on the first render and when the caller
      // explicitly asks for it (new model, import, reset).
      if (framedTokenRef.current !== frameToken) {
        framedTokenRef.current = frameToken;
        // The canonical packet frames an empty document with a half-unit box,
        // which is right for deterministic capture but puts an interactive
        // camera inside the first brick placed. Never frame tighter than a
        // usable working area.
        const camera = createCameraForView(
          { ...view, frameRadius: Math.max(view.frameRadius, MIN_INTERACTIVE_FRAME_RADIUS) },
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
        );
        runtime.controls.dispose();
        runtime.camera = camera;
        runtime.controls = new OrbitControls(runtime.camera, runtime.renderer.domElement);
        configureOrbitControls(runtime.controls, runtime.sceneRadius);
        runtime.controls.target.copy(new Vector3(...view.target));
        runtime.controls.addEventListener("change", () => {
          if (contextLostRef.current) return;
          syncOrbitFrustum(runtime);
          runtime.renderer.render(runtime.scene, runtime.camera);
        });
        runtime.controls.update();
      }

      // The build plate is fixed truth, so the grid marks it rather than
      // drifting with whatever the model's lowest point happens to be.
      runtime.grid.position.y = -GROUND_UNDERSIDE_LDU * THREE_UNITS_PER_LDU;
      syncOrbitFrustum(runtime);
      runtime.renderer.render(runtime.scene, runtime.camera);
    }, [document, validationReport, frameToken]);

    useEffect(() => {
      const runtime = runtimeRef.current;
      if (!runtime?.projection) return;
      setBrickSceneSelection(runtime.projection, selectedPartId ? [selectedPartId] : []);
      if (!contextLostRef.current) runtime.renderer.render(runtime.scene, runtime.camera);
    }, [document, selectedPartId]);

    return (
      <div
        ref={hostRef}
        className={`brick-viewport${contextLost ? " has-context-loss" : ""}`}
        role="application"
        aria-label="3D brick model viewport"
      >
        {contextLost ? (
          <div className="context-loss-message" role="status">
            The graphics context was lost. Waiting for the browser to restore it…
          </div>
        ) : null}
        {renderError ? (
          <div className="context-loss-message" role="alert">
            Retained the last valid view. {renderError}
          </div>
        ) : null}
        {document.parts.length === 0 ? (
          <div className="viewport-message">
            <strong>Start with a basic brick</strong>
            <span>Choose a part, color, then place it at the origin.</span>
          </div>
        ) : null}
        {previewing ? <div className="preview-ribbon">Unaccepted candidate preview</div> : null}
        <div className="sr-only" aria-live="polite">
          {previewing
            ? "Candidate preview is visible; selection is disabled."
            : selectedPartId
              ? `Selected part ${selectedPartId}`
              : "No part selected"}
        </div>
        <div className="viewport-axis" aria-hidden="true">
          <span className="axis-x">X</span>
          <span className="axis-y">Y</span>
          <span className="axis-z">Z</span>
        </div>
      </div>
    );
  },
);
