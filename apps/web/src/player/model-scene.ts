import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LDrawLoader } from "three/addons/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";

import { PlayerDataError } from "./player-data";

/**
 * The player's 3D view: the packed model, loaded once with three's
 * LDrawLoader, shown through a printed step. Each top-level group the loader
 * builds is one row of the main model, in order, so row i belongs to step
 * stepOf[i]; parts of later steps are hidden, and the current step's parts
 * glow for HIGHLIGHT_HOLD_MS and fade over HIGHLIGHT_FADE_MS.
 *
 * The camera follows the build: each step frames the parts shown so far,
 * from VIEW_DIRECTION, until the viewer orbits, pans or zooms; "Reset view"
 * frames the current step again and resumes following.
 *
 * The host element carries what the scene actually shows, for tests and
 * probes: data-step, data-visible-parts and data-highlighted-parts.
 */
export const HIGHLIGHT_HOLD_MS = 1200;
export const HIGHLIGHT_FADE_MS = 800;
const HIGHLIGHT = new Color(0xff8a00);
const HIGHLIGHT_EMISSIVE = 0.45;
/** Camera direction from the model's centre, in three's axes (+Y up, +Z toward the default viewer). */
const VIEW_DIRECTION = new Vector3(-0.2, 0.7, 1).normalize();
const FIELD_OF_VIEW = 35;

export interface ModelScene {
  load(mpd: string, stepOf: readonly number[]): Promise<void>;
  showStep(step: number): void;
  resetView(): void;
  dispose(): void;
}

interface Glow {
  readonly mesh: Mesh | LineSegments;
  readonly original: Material | Material[];
  readonly copies: Material[];
  readonly lineColours: Color[];
}

const materialsOf = (material: Material | Material[]) =>
  Array.isArray(material) ? material : [material];

export function createModelScene(host: HTMLElement): ModelScene {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.prepend(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color(0xf4f4f1);
  scene.add(new AmbientLight(0xffffff, 0.5));
  scene.add(new HemisphereLight(0xffffff, 0x9a9a9a, 1.1));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-2, 4, 3);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.8);
  fill.position.set(3, 1, -2);
  scene.add(fill);
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 100_000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  // Any orbit, pan or zoom by the viewer stops the camera following the build.
  controls.addEventListener("start", () => {
    following = false;
  });

  let model: Group | null = null;
  let parts: readonly Object3D[] = [];
  let stepOf: readonly number[] = [];
  let partBoxes: readonly Box3[] = [];
  let following = true;
  let glows: Glow[] = [];
  let glowStarted = 0;
  let dirty = true;
  let frame = 0;
  let disposed = false;

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const onContextLost = (event: Event) => event.preventDefault();
  const onContextRestored = () => {
    dirty = true;
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

  const clearGlow = () => {
    for (const glow of glows) {
      glow.mesh.material = glow.original;
      for (const copy of glow.copies) copy.dispose();
    }
    glows = [];
    host.dataset.highlightedParts = "0";
    dirty = true;
  };

  const glowStrength = (now: number) => {
    const elapsed = now - glowStarted;
    if (elapsed <= HIGHLIGHT_HOLD_MS) return 1;
    return Math.max(0, 1 - (elapsed - HIGHLIGHT_HOLD_MS) / HIGHLIGHT_FADE_MS);
  };

  const applyGlow = (strength: number) => {
    for (const glow of glows) {
      glow.copies.forEach((copy, index) => {
        if (copy instanceof MeshStandardMaterial)
          copy.emissiveIntensity = HIGHLIGHT_EMISSIVE * strength;
        else if (copy instanceof LineBasicMaterial) {
          copy.color.copy(glow.lineColours[index]!).lerp(HIGHLIGHT, strength);
        }
      });
    }
    dirty = true;
  };

  const startGlow = (targets: readonly Object3D[]) => {
    clearGlow();
    for (const target of targets) {
      target.traverse((object) => {
        const mesh = object as Mesh | LineSegments;
        if (!(mesh instanceof Mesh) && !(mesh instanceof LineSegments)) return;
        // Conditional lines use their own shader; the faces and edges carry the glow.
        if ("isConditionalLine" in mesh && mesh.isConditionalLine) return;
        const original = mesh.material;
        const copies = materialsOf(original).map((material) => {
          const copy = material.clone();
          if (copy instanceof MeshStandardMaterial) copy.emissive.copy(HIGHLIGHT);
          return copy;
        });
        const lineColours = copies.map((copy) =>
          copy instanceof LineBasicMaterial ? copy.color.clone() : new Color(),
        );
        mesh.material = Array.isArray(original) ? copies : copies[0]!;
        glows.push({ mesh, original, copies, lineColours });
      });
    }
    glowStarted = performance.now();
    host.dataset.highlightedParts = String(targets.length);
    applyGlow(1);
  };

  const frameShown = () => {
    const box = new Box3();
    parts.forEach((part, index) => {
      if (part.visible) box.union(partBoxes[index]!);
    });
    if (box.isEmpty()) partBoxes.forEach((partBox) => box.union(partBox));
    if (box.isEmpty()) return;
    const bounds = box.getBoundingSphere(new Sphere());
    const vertical = (FIELD_OF_VIEW * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const distance =
      (Math.max(bounds.radius, 10) / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.05;
    camera.position.copy(bounds.center).addScaledVector(VIEW_DIRECTION, distance);
    camera.near = Math.max(1, distance / 100);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(bounds.center);
    controls.update();
    dirty = true;
  };

  const tick = () => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (glows.length > 0) {
      const strength = glowStrength(performance.now());
      if (strength <= 0) clearGlow();
      else applyGlow(strength);
    }
    if (controls.update()) dirty = true;
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);

  return {
    async load(mpd, steps) {
      const loader = new LDrawLoader();
      loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      const group = await new Promise<Group>((resolve, reject) =>
        loader.parse(mpd, resolve, reject),
      );
      if (disposed) return;
      if (group.children.length !== steps.length) {
        throw new PlayerDataError(
          `model.mpd loaded as ${group.children.length} parts but steps.json lists ${steps.length}; a part file may be missing from it. Regenerate it with npm start.`,
        );
      }
      // LDraw is -Y up; a half turn about X makes it three's +Y up without mirroring.
      group.rotation.x = Math.PI;
      scene.add(group);
      model = group;
      parts = [...group.children];
      stepOf = steps;
      group.updateMatrixWorld(true);
      partBoxes = parts.map((part) => new Box3().setFromObject(part));
    },
    showStep(step) {
      let visible = 0;
      const added: Object3D[] = [];
      parts.forEach((part, index) => {
        part.visible = stepOf[index]! <= step;
        if (part.visible) visible += 1;
        if (stepOf[index] === step) added.push(part);
      });
      host.dataset.step = String(step);
      host.dataset.visibleParts = String(visible);
      startGlow(added);
      if (following) frameShown();
    },
    resetView() {
      following = true;
      frameShown();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      clearGlow();
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      model?.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
