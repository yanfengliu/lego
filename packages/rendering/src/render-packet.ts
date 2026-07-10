import {
  canonicalDigest,
  deepFreeze,
  isBoundedDataOnlyJson,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";
import {
  validateRenderPacketV1,
  validateValidationReportV1,
  type Hash,
  type RenderPacketV1,
  type RenderViewArtifactV1,
  type ValidationReportV1,
} from "@lego-studio/protocol";
import { Box3, Vector3 } from "three";

import { CANONICAL_VIEW_NAMES, createCanonicalViewPacket } from "./cameras.ts";
import { CANONICAL_CAMERA_POLICY_VERSION, RENDERING_VERSION } from "./constants.ts";
import { THREE_UNITS_PER_LDU } from "./coordinates.ts";
import type { CanonicalViewDefinition, CanonicalViewPacket } from "./types.ts";

export const CANONICAL_RENDER_VIEW_SET_VERSION = "lego.canonical-render-views/1" as const;
export const CANONICAL_RENDER_PASSES = [
  "beauty",
] as const satisfies readonly RenderViewArtifactV1["pass"][];

const PROJECTIONS = [
  "perspective",
  "orthographic",
  "orthographic",
  "orthographic",
  "orthographic",
  "orthographic",
  "orthographic",
] as const;

export const CANONICAL_RENDER_VIEW_SET = deepFreeze({
  schemaVersion: "lego.canonical-render-view-set/1",
  version: CANONICAL_RENDER_VIEW_SET_VERSION,
  cameraPolicyVersion: CANONICAL_CAMERA_POLICY_VERSION,
  views: CANONICAL_VIEW_NAMES.map((viewId, index) => ({
    viewId,
    projection: PROJECTIONS[index]!,
    passes: CANONICAL_RENDER_PASSES,
  })),
} as const);

export const CANONICAL_RENDER_VIEW_SET_HASH = canonicalDigest(CANONICAL_RENDER_VIEW_SET);

export const CANONICAL_CAPTURE_POLICY = deepFreeze({
  schemaVersion: "lego.canonical-capture-policy/1",
  version: "lego.canonical-capture/1",
  viewSetHash: CANONICAL_RENDER_VIEW_SET_HASH,
  passes: CANONICAL_RENDER_PASSES,
  mediaType: "image/png",
  width: 640,
  height: 480,
  devicePixelRatio: 1,
  maxArtifactBytes: 16 * 1024 * 1024,
  maxTotalArtifactBytes: CANONICAL_VIEW_NAMES.length * 16 * 1024 * 1024,
} as const);

export const CANONICAL_CAPTURE_POLICY_HASH = canonicalDigest(CANONICAL_CAPTURE_POLICY);

export type CanonicalRenderPacketErrorCode =
  | "INPUT_INVALID"
  | "VALIDATION_REPORT_INVALID"
  | "STALE_DOCUMENT_HASH"
  | "STALE_TRUTH_HASH"
  | "CAMERA_PACKET_INVALID"
  | "CAMERA_VIEW_SET_MISMATCH"
  | "MISSING_CANONICAL_VIEW"
  | "DUPLICATE_CANONICAL_VIEW"
  | "EXTRA_CANONICAL_VIEW"
  | "MISMATCHED_CANONICAL_VIEW"
  | "CAPTURE_METADATA_MISMATCH"
  | "CAPTURE_ARTIFACT_MISMATCH"
  | "CAPTURE_POLICY_MISMATCH"
  | "RENDER_PACKET_PROTOCOL_INVALID";

export class CanonicalRenderPacketError extends Error {
  public readonly code: CanonicalRenderPacketErrorCode;
  public readonly path: string;

  public constructor(code: CanonicalRenderPacketErrorCode, message: string, path = "") {
    super(message);
    this.name = "CanonicalRenderPacketError";
    this.code = code;
    this.path = path;
  }
}

export interface CreateCanonicalRenderPacketInput {
  readonly documentHash: Hash;
  readonly truthSnapshotHash: Hash;
  readonly validationReport: ValidationReportV1;
  readonly rendererSnapshotHash: Hash;
  readonly browserBuildHash: Hash;
  readonly cameraPacket: CanonicalViewPacket;
  readonly capturedViews: readonly RenderViewArtifactV1[];
}

export interface CanonicalRenderPacketSummary {
  readonly schemaVersion: "lego.canonical-render-packet-summary/1";
  readonly packetHash: Sha256Digest;
  readonly documentHash: Hash;
  readonly viewCount: number;
  readonly viewIds: readonly string[];
  readonly passes: readonly RenderViewArtifactV1["pass"][];
  readonly totalByteLength: number;
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CAMERA_INPUT_LIMITS = { maxDepth: 8, maxNodes: 512 } as const;
const CAPTURE_INPUT_LIMITS = { maxDepth: 8, maxNodes: 1024 } as const;
const REPORT_INPUT_LIMITS = { maxDepth: 12, maxNodes: 250_000 } as const;
const PACKET_INPUT_LIMITS = { maxDepth: 8, maxNodes: 2048 } as const;
const viewOrder = new Map(CANONICAL_VIEW_NAMES.map((viewId, index) => [viewId, index]));
const projectionByView = new Map(
  CANONICAL_RENDER_VIEW_SET.views.map(({ viewId, projection }) => [viewId, projection]),
);

function fail(code: CanonicalRenderPacketErrorCode, message: string, path = ""): never {
  throw new CanonicalRenderPacketError(code, message, path);
}

function requireHash(value: unknown, path: string): asserts value is Hash {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    fail("INPUT_INVALID", `${path} must be a canonical SHA-256 hash`, path);
  }
}

function detachedClone<T>(
  value: T,
  path: string,
  limits: { readonly maxDepth: number; readonly maxNodes: number },
): T {
  if (!isBoundedDataOnlyJson(value, limits)) {
    return fail("INPUT_INVALID", `${path || "input"} must be bounded data-only JSON`, path);
  }
  try {
    return structuredClone(value);
  } catch {
    return fail("INPUT_INVALID", `${path} must be detached structured-cloneable data`, path);
  }
}

function finiteVector(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ValidViewNumbers extends Record<string, unknown> {
  readonly projection: "perspective" | "orthographic";
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly near: number;
  readonly far: number;
  readonly frameRadius: number;
  readonly verticalFovDegrees: number | null;
}

function validViewNumbers(view: Record<string, unknown>): view is ValidViewNumbers {
  return (
    finiteVector(view.position) &&
    finiteVector(view.target) &&
    finiteVector(view.up) &&
    typeof view.near === "number" &&
    Number.isFinite(view.near) &&
    view.near > 0 &&
    typeof view.far === "number" &&
    Number.isFinite(view.far) &&
    view.far > view.near &&
    typeof view.frameRadius === "number" &&
    Number.isFinite(view.frameRadius) &&
    view.frameRadius > 0 &&
    (view.projection === "perspective"
      ? typeof view.verticalFovDegrees === "number" &&
        Number.isFinite(view.verticalFovDegrees) &&
        view.verticalFovDegrees > 0 &&
        view.verticalFovDegrees < 179
      : view.verticalFovDegrees === null)
  );
}

function canonicalizeCameraPacket(value: unknown, documentHash: Hash): CanonicalViewPacket {
  const packet = detachedClone(value, "/cameraPacket", CAMERA_INPUT_LIMITS);
  if (!isRecord(packet)) {
    fail("CAMERA_PACKET_INVALID", "Canonical camera packet must be an object", "/cameraPacket");
  }
  if (packet.documentHash !== documentHash) {
    fail(
      "STALE_DOCUMENT_HASH",
      "Canonical camera packet targets a different document hash",
      "/cameraPacket/documentHash",
    );
  }
  if (
    packet.schemaVersion !== "lego.canonical-view-packet/1" ||
    packet.rendererVersion !== RENDERING_VERSION ||
    packet.cameraPolicyVersion !== CANONICAL_CAMERA_POLICY_VERSION ||
    packet.coordinateSystem !== "three-plus-y-up" ||
    packet.sourceCoordinateSystem !== "ldu-minus-y-up" ||
    packet.threeUnitsPerLdu !== THREE_UNITS_PER_LDU ||
    typeof packet.usedFallbackBounds !== "boolean"
  ) {
    fail("CAMERA_PACKET_INVALID", "Canonical camera packet metadata is invalid", "/cameraPacket");
  }
  const bounds = packet.bounds;
  if (!isRecord(bounds) || !finiteVector(bounds.min) || !finiteVector(bounds.max)) {
    fail(
      "CAMERA_PACKET_INVALID",
      "Canonical camera packet bounds are invalid",
      "/cameraPacket/bounds",
    );
  }
  const minBounds = bounds.min;
  const maxBounds = bounds.max;
  if (minBounds.some((minimum, axis) => minimum > maxBounds[axis]!)) {
    fail(
      "CAMERA_PACKET_INVALID",
      "Canonical camera packet bounds are inverted",
      "/cameraPacket/bounds",
    );
  }
  const views = packet.views;
  if (!Array.isArray(views)) {
    fail(
      "CAMERA_PACKET_INVALID",
      "Canonical camera packet views are invalid",
      "/cameraPacket/views",
    );
  }

  const byName = new Map<string, CanonicalViewDefinition>();
  for (const rawView of views) {
    if (!isRecord(rawView) || typeof rawView.name !== "string") {
      fail(
        "CAMERA_VIEW_SET_MISMATCH",
        "Canonical camera packet contains a malformed view",
        "/cameraPacket/views",
      );
    }
    const viewName = rawView.name;
    if (byName.has(viewName)) {
      fail(
        "CAMERA_VIEW_SET_MISMATCH",
        "Canonical camera packet contains a duplicate view",
        "/cameraPacket/views",
      );
    }
    const projection = projectionByView.get(viewName as CanonicalViewDefinition["name"]);
    if (
      projection === undefined ||
      projection !== rawView.projection ||
      !validViewNumbers(rawView)
    ) {
      fail(
        "CAMERA_VIEW_SET_MISMATCH",
        "Canonical camera packet does not match the required named view set",
        "/cameraPacket/views",
      );
    }
    byName.set(viewName, {
      name: viewName as CanonicalViewDefinition["name"],
      projection: rawView.projection,
      position: [...rawView.position],
      target: [...rawView.target],
      up: [...rawView.up],
      near: rawView.near,
      far: rawView.far,
      frameRadius: rawView.frameRadius,
      verticalFovDegrees: rawView.verticalFovDegrees,
    });
  }
  if (byName.size !== CANONICAL_VIEW_NAMES.length) {
    fail(
      "CAMERA_VIEW_SET_MISMATCH",
      "Canonical camera packet is missing a required named view",
      "/cameraPacket/views",
    );
  }

  const canonicalPacket = {
    schemaVersion: "lego.canonical-view-packet/1",
    rendererVersion: RENDERING_VERSION,
    cameraPolicyVersion: CANONICAL_CAMERA_POLICY_VERSION,
    documentHash,
    coordinateSystem: "three-plus-y-up",
    sourceCoordinateSystem: "ldu-minus-y-up",
    threeUnitsPerLdu: THREE_UNITS_PER_LDU,
    bounds: {
      min: [...minBounds],
      max: [...maxBounds],
    },
    usedFallbackBounds: packet.usedFallbackBounds,
    views: CANONICAL_VIEW_NAMES.map((viewId) => byName.get(viewId)!),
  } satisfies CanonicalViewPacket;
  const expectedBounds = canonicalPacket.usedFallbackBounds
    ? new Box3()
    : new Box3(
        new Vector3(...canonicalPacket.bounds.min),
        new Vector3(...canonicalPacket.bounds.max),
      );
  const expectedPacket = createCanonicalViewPacket({ documentHash, bounds: expectedBounds });
  if (canonicalDigest(canonicalPacket) !== canonicalDigest(expectedPacket)) {
    fail(
      "CAMERA_VIEW_SET_MISMATCH",
      "Canonical camera packet geometry does not match its pinned bounds and policy",
      "/cameraPacket/views",
    );
  }

  return deepFreeze(canonicalPacket);
}

function canonicalizeCapturedViews(
  values: readonly RenderViewArtifactV1[],
): readonly RenderViewArtifactV1[] {
  if (!Array.isArray(values)) {
    fail("RENDER_PACKET_PROTOCOL_INVALID", "Render packet views must be an array", "/views");
  }
  if (values.length > CANONICAL_VIEW_NAMES.length) {
    fail(
      "EXTRA_CANONICAL_VIEW",
      "Render packet contains more than seven canonical views",
      "/views",
    );
  }

  const byViewId = new Map<string, RenderViewArtifactV1>();
  for (const view of values) {
    if (typeof view !== "object" || view === null || typeof view.viewId !== "string") {
      fail("RENDER_PACKET_PROTOCOL_INVALID", "Render packet contains a malformed view", "/views");
    }
    if (byViewId.has(view.viewId)) {
      fail("DUPLICATE_CANONICAL_VIEW", "Render packet contains a duplicate view", "/views");
    }
    if (!viewOrder.has(view.viewId)) {
      fail("EXTRA_CANONICAL_VIEW", "Render packet contains an unknown canonical view", "/views");
    }
    if (view.pass !== "beauty") {
      fail(
        "MISMATCHED_CANONICAL_VIEW",
        "The current renderer supports only the beauty pass",
        "/views",
      );
    }
    byViewId.set(view.viewId, view);
  }

  if (byViewId.size !== CANONICAL_VIEW_NAMES.length) {
    fail("MISSING_CANONICAL_VIEW", "Render packet is missing a required canonical view", "/views");
  }

  const ordered = CANONICAL_VIEW_NAMES.map((viewId) => byViewId.get(viewId)!);
  let totalByteLength = 0;
  for (const view of ordered) {
    if (
      view.width !== CANONICAL_CAPTURE_POLICY.width ||
      view.height !== CANONICAL_CAPTURE_POLICY.height ||
      view.devicePixelRatio !== CANONICAL_CAPTURE_POLICY.devicePixelRatio
    ) {
      fail(
        "CAPTURE_METADATA_MISMATCH",
        "Captured view metadata does not match the canonical capture policy",
        "/views",
      );
    }
    if (
      typeof view.artifact !== "object" ||
      view.artifact === null ||
      view.artifact.kind !== "render" ||
      view.artifact.mediaType !== CANONICAL_CAPTURE_POLICY.mediaType ||
      !Number.isInteger(view.artifact.byteLength) ||
      view.artifact.byteLength <= 0 ||
      view.artifact.byteLength > CANONICAL_CAPTURE_POLICY.maxArtifactBytes
    ) {
      fail(
        "CAPTURE_ARTIFACT_MISMATCH",
        "Captured view artifact does not match the canonical capture policy",
        "/views",
      );
    }
    totalByteLength += view.artifact.byteLength;
  }
  if (totalByteLength > CANONICAL_CAPTURE_POLICY.maxTotalArtifactBytes) {
    fail(
      "CAPTURE_ARTIFACT_MISMATCH",
      "Captured view artifacts exceed the canonical total byte budget",
      "/views",
    );
  }

  return ordered;
}

function normalizeCanonicalRenderPacket(value: unknown): RenderPacketV1 {
  const packet = detachedClone(value, "", PACKET_INPUT_LIMITS) as RenderPacketV1;
  if (!validateRenderPacketV1(packet)) {
    fail(
      "RENDER_PACKET_PROTOCOL_INVALID",
      `RenderPacket protocol validation failed: ${validateRenderPacketV1.errors?.[0]?.message ?? "invalid packet"}`,
      validateRenderPacketV1.errors?.[0]?.instancePath ?? "",
    );
  }
  if (packet.capturePolicyHash !== CANONICAL_CAPTURE_POLICY_HASH) {
    fail(
      "CAPTURE_POLICY_MISMATCH",
      "Render packet is not pinned to the active canonical capture policy",
      "/capturePolicyHash",
    );
  }
  const views = canonicalizeCapturedViews(packet.views);
  return deepFreeze({ ...packet, views });
}

export function createCanonicalRenderPacket(
  input: CreateCanonicalRenderPacketInput,
): RenderPacketV1 {
  requireHash(input.documentHash, "/documentHash");
  requireHash(input.truthSnapshotHash, "/truthSnapshotHash");
  requireHash(input.rendererSnapshotHash, "/rendererSnapshotHash");
  requireHash(input.browserBuildHash, "/browserBuildHash");

  const report = detachedClone(input.validationReport, "/validationReport", REPORT_INPUT_LIMITS);
  if (!validateValidationReportV1(report)) {
    fail(
      "VALIDATION_REPORT_INVALID",
      "Validation report is malformed",
      validateValidationReportV1.errors?.[0]?.instancePath ?? "/validationReport",
    );
  }
  if (report.targetDocumentHash !== input.documentHash) {
    fail(
      "STALE_DOCUMENT_HASH",
      "Validation report targets a different document hash",
      "/validationReport/targetDocumentHash",
    );
  }
  if (report.truthSnapshotHash !== input.truthSnapshotHash) {
    fail(
      "STALE_TRUTH_HASH",
      "Validation report targets a different truth snapshot",
      "/validationReport/truthSnapshotHash",
    );
  }

  const cameraPacket = canonicalizeCameraPacket(input.cameraPacket, input.documentHash);
  const capturedViews = canonicalizeCapturedViews(
    detachedClone(input.capturedViews, "/capturedViews", CAPTURE_INPUT_LIMITS),
  );
  const cameraSnapshotHash = canonicalDigest({
    schemaVersion: "lego.canonical-camera-snapshot/1",
    viewSetHash: CANONICAL_RENDER_VIEW_SET_HASH,
    cameraPacket,
  });

  return normalizeCanonicalRenderPacket({
    schemaVersion: "lego.render-packet/1",
    documentHash: input.documentHash,
    validationReportHash: canonicalDigest(report),
    rendererSnapshotHash: input.rendererSnapshotHash,
    cameraSnapshotHash,
    capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
    browserBuildHash: input.browserBuildHash,
    views: capturedViews,
  });
}

export function canonicalRenderPacketHash(value: unknown): Sha256Digest {
  return canonicalDigest(normalizeCanonicalRenderPacket(value));
}

export function summarizeCanonicalRenderPacket(value: unknown): CanonicalRenderPacketSummary {
  const packet = normalizeCanonicalRenderPacket(value);
  const passes = [...new Set(packet.views.map(({ pass }) => pass))].sort();
  return deepFreeze({
    schemaVersion: "lego.canonical-render-packet-summary/1",
    packetHash: canonicalDigest(packet),
    documentHash: packet.documentHash,
    viewCount: packet.views.length,
    viewIds: packet.views.map(({ viewId }) => viewId),
    passes,
    totalByteLength: packet.views.reduce((total, { artifact }) => total + artifact.byteLength, 0),
  });
}
