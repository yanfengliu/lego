import { canonicalDigest, deepFreeze } from "../../brick-kernel/src/canonical.ts";

export const PART_VISUAL_ADMISSION_VIEW_NAMES = [
  "top",
  "bottom",
  "front",
  "back",
  "left",
  "right",
  "isometric",
  "underside-oblique",
] as const;

export type PartVisualAdmissionViewName = (typeof PART_VISUAL_ADMISSION_VIEW_NAMES)[number];

interface PartVisualAdmissionViewBasis {
  readonly name: PartVisualAdmissionViewName;
  readonly direction: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly projection: "orthographic" | "perspective";
}

const VIEW_BASES = [
  { name: "top", direction: [0, 1, 0], up: [0, 0, -1], projection: "orthographic" },
  { name: "bottom", direction: [0, -1, 0], up: [0, 0, 1], projection: "orthographic" },
  { name: "front", direction: [0, 0, 1], up: [0, 1, 0], projection: "orthographic" },
  { name: "back", direction: [0, 0, -1], up: [0, 1, 0], projection: "orthographic" },
  { name: "left", direction: [-1, 0, 0], up: [0, 1, 0], projection: "orthographic" },
  { name: "right", direction: [1, 0, 0], up: [0, 1, 0], projection: "orthographic" },
  {
    name: "isometric",
    direction: [1, 1, 1],
    up: [0, 1, 0],
    projection: "perspective",
  },
  {
    name: "underside-oblique",
    direction: [1, -1, 1],
    up: [0, 1, 0],
    projection: "perspective",
  },
] as const satisfies readonly PartVisualAdmissionViewBasis[];

export const PART_VISUAL_ADMISSION_VIEW_POLICY = deepFreeze({
  schemaVersion: "lego.part-visual-admission-view-policy/1",
  version: "lego.part-visual-admission-views/1",
  sourceCoordinateSystem: "ldraw-plus-y-down-ldu",
  catalogCoordinateSystem: "catalog-minus-y-up-ldu",
  renderCoordinateSystem: "three-plus-y-up",
  fit: "one-union-bounds-sphere-shared-by-source-and-candidate",
  perspectiveVerticalFovDegrees: 35,
  views: VIEW_BASES,
} as const);

export const PART_VISUAL_ADMISSION_VIEW_POLICY_HASH = canonicalDigest(
  PART_VISUAL_ADMISSION_VIEW_POLICY,
);

export const PART_VISUAL_ADMISSION_CAPTURE_POLICY = deepFreeze({
  schemaVersion: "lego.part-visual-admission-capture-policy/1",
  version: "lego.part-visual-admission-capture/1",
  viewPolicyHash: PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
  width: 640,
  height: 640,
  devicePixelRatio: 1,
  padding: 1.2,
  mediaType: "image/png",
  rgbaOrigin: "bottom-left",
  backgroundRgba: [255, 255, 255, 255],
  material: {
    kind: "MeshStandardMaterial",
    color: "#8f99a3",
    roughness: 1,
    metalness: 0,
    side: "FrontSide",
  },
  lights: [
    { kind: "AmbientLight", color: "#ffffff", intensity: 1.1 },
    {
      kind: "DirectionalLight",
      color: "#ffffff",
      intensity: 2.2,
      position: [4, 7, 5],
    },
    {
      kind: "DirectionalLight",
      color: "#dce8ff",
      intensity: 0.7,
      position: [-5, 2, -4],
    },
  ],
  renderer: {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    shadows: false,
    toneMapping: "NoToneMapping",
    outputColorSpace: "SRGBColorSpace",
  },
  maxPngBytes: 4 * 1024 * 1024,
  maxTotalPngBytes: 64 * 1024 * 1024,
  maxTransferredRgbaBytes: 64 * 1024 * 1024,
} as const);

export const PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH = canonicalDigest(
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
);
