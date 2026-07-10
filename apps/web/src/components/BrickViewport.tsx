import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";
import {
  createCameraForView,
  createCanonicalViewPacket,
  deriveBrickScene,
  fitPerspectiveCameraToFrame,
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
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { keyboardSelection } from "../viewport-navigation";

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
}

interface BrickViewportProps {
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly selectedPartId: string | null;
  readonly previewing: boolean;
  readonly onSelectPart: (partId: string | null) => void;
}

interface ViewportRuntime {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
  readonly grid: GridHelper;
  camera: Camera;
  controls: OrbitControls;
  projection: DerivedBrickScene | null;
  packet: CanonicalViewPacket | null;
}

function partIdFromObject(object: Object3D | null): string | null {
  let current = object;
  while (current) {
    if (typeof current.userData.partId === "string") return current.userData.partId;
    current = current.parent;
  }
  return null;
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
    { document, validationReport, selectedPartId, previewing, onSelectPart },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const runtimeRef = useRef<ViewportRuntime | null>(null);
    const previewingRef = useRef(previewing);
    const selectedPartIdRef = useRef(selectedPartId);
    const onSelectPartRef = useRef(onSelectPart);
    const [contextLost, setContextLost] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const contextLostRef = useRef(false);
    const capturePromiseRef = useRef<Promise<Record<string, string>> | null>(null);

    previewingRef.current = previewing;
    selectedPartIdRef.current = selectedPartId;
    onSelectPartRef.current = onSelectPart;
    contextLostRef.current = contextLost;

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
        "ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape",
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
      controls.enableDamping = false;
      controls.screenSpacePanning = true;
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
      };
      runtimeRef.current = runtime;

      const render = () => {
        if (!contextLostRef.current) renderer.render(scene, runtime.camera);
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

      const pointer = new Vector2();
      const raycaster = new Raycaster();
      let pointerStart: { x: number; y: number; button: number } | null = null;
      const handlePointerDown = (event: PointerEvent) => {
        pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (previewingRef.current || !runtime.projection) return;
        const started = pointerStart;
        pointerStart = null;
        if (
          !started ||
          started.button !== 0 ||
          Math.hypot(event.clientX - started.x, event.clientY - started.y) > 4
        ) {
          return;
        }
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, runtime.camera);
        const hit = raycaster.intersectObjects(
          [...runtime.projection.partObjects.values()],
          true,
        )[0];
        onSelectPartRef.current(partIdFromObject(hit?.object ?? null));
      };
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointerup", handlePointerUp);
      const handleKeyDown = (event: KeyboardEvent) => {
        if (previewingRef.current || !runtime.projection) return;
        const next = keyboardSelection(
          selectedPartIdRef.current,
          [...runtime.projection.partObjects.keys()],
          event.key,
        );
        if (next === undefined) return;
        event.preventDefault();
        onSelectPartRef.current(next);
      };
      renderer.domElement.addEventListener("keydown", handleKeyDown);

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
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        renderer.domElement.removeEventListener("pointerup", handlePointerUp);
        renderer.domElement.removeEventListener("keydown", handleKeyDown);
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
      let camera: Camera;
      try {
        replacement = deriveBrickScene(document, { validationReport });
        packet = createCanonicalViewPacket(replacement);
        const view = packet.views[0];
        if (!view) throw new Error("Canonical isometric view is unavailable");
        camera = createCameraForView(
          view,
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
        );
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
      runtime.controls.dispose();
      runtime.camera = camera;
      runtime.controls = new OrbitControls(runtime.camera, runtime.renderer.domElement);
      runtime.controls.enableDamping = false;
      runtime.controls.screenSpacePanning = true;
      runtime.controls.target.copy(new Vector3(...view.target));
      runtime.controls.addEventListener("change", () => {
        if (!contextLostRef.current) runtime.renderer.render(runtime.scene, runtime.camera);
      });
      runtime.controls.update();
      runtime.grid.position.y = runtime.projection.bounds.isEmpty()
        ? -0.5
        : runtime.projection.bounds.min.y - 0.02;
      runtime.renderer.render(runtime.scene, runtime.camera);
    }, [document, validationReport]);

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
