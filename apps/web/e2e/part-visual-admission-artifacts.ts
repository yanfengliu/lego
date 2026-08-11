import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  PART_VISUAL_ADMISSION_VIEW_POLICY,
  PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
} from "@lego-studio/rendering";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import type { Stats } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import type {
  PartVisualAdmissionCaptureResult,
  PartVisualAdmissionCaptureTransport,
} from "../src/part-visual-admission-renderer.ts";
import { inspectPng } from "./callout-publication.ts";
import type { VerifiedMaterializedLDrawClosure } from "./part-visual-admission-source.ts";

const PACKET_SCHEMA = "lego.part-visual-admission-packet/1";
const MAXIMUM_MANIFEST_BYTES = 4 * 1024 * 1024;

interface PublishedImage {
  readonly side: "source" | "candidate";
  readonly viewName: string;
  readonly cameraName: string;
  readonly projection: "orthographic" | "perspective";
  readonly path: string;
  readonly sha256: Sha256Digest;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly rgbaSha256: Sha256Digest;
  readonly rgbaBytes: number;
  readonly rgbaOrigin: "bottom-left";
}

export interface PartVisualAdmissionPacket {
  readonly schemaVersion: typeof PACKET_SCHEMA;
  readonly runId: string;
  readonly createdAt: string;
  readonly reviewState: "pending";
  readonly source: Omit<VerifiedMaterializedLDrawClosure, "manifestPath" | "libraryPath">;
  readonly candidate: {
    readonly catalogId: string;
    readonly catalogHash: Sha256Digest;
    readonly definitionHash: Sha256Digest;
    readonly meshHash: Sha256Digest;
    readonly frameHash: Sha256Digest;
  };
  readonly policy: {
    readonly viewPolicy: typeof PART_VISUAL_ADMISSION_VIEW_POLICY;
    readonly viewPolicyHash: Sha256Digest;
    readonly capturePolicy: typeof PART_VISUAL_ADMISSION_CAPTURE_POLICY;
    readonly capturePolicyHash: Sha256Digest;
  };
  readonly cameraPacket: PartVisualAdmissionCaptureResult["cameraPacket"];
  readonly cameraPacketHash: Sha256Digest;
  readonly sourceBounds: PartVisualAdmissionCaptureResult["sourceBounds"];
  readonly candidateBounds: PartVisualAdmissionCaptureResult["candidateBounds"];
  readonly renderer: {
    readonly browserVersion: string;
    readonly build: PartVisualAdmissionCaptureResult["rendererBuild"];
    readonly buildHash: Sha256Digest;
  };
  readonly images: readonly PublishedImage[];
  readonly diagnosticMetrics: PartVisualAdmissionCaptureResult["metrics"];
  readonly renderDiagnostics: PartVisualAdmissionCaptureResult["diagnostics"];
  readonly sceneAudit: PartVisualAdmissionCaptureResult["sceneAudit"];
  readonly cleanup: PartVisualAdmissionCaptureResult["cleanup"];
  readonly packetHash: Sha256Digest;
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function sameFile(
  left: ReturnType<typeof fstatSync>,
  right: ReturnType<typeof fstatSync>,
): boolean {
  return (
    left.ino === right.ino &&
    (left.dev === 0 || right.dev === 0 || left.dev === right.dev) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

function exactFile(path: string, maximumBytes: number, label: string): Buffer {
  const beforePath = lstatSync(path);
  if (beforePath.isSymbolicLink() || !beforePath.isFile()) {
    throw new TypeError(`${label} is not an ordinary regular file: ${path}.`);
  }
  if (beforePath.size <= 0 || beforePath.size > maximumBytes) {
    throw new RangeError(
      `${label} is ${beforePath.size} bytes; allowed range is 1..${maximumBytes}: ${path}.`,
    );
  }
  const descriptor = openSync(path, "r");
  try {
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const afterPath = lstatSync(path);
    if (!sameFile(before, after) || !sameFile(after, afterPath)) {
      throw new Error(`${label} changed during its exact read: ${path}.`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function dataUrlBytes(capture: PartVisualAdmissionCaptureTransport): Buffer {
  const prefix = "data:image/png;base64,";
  if (!capture.pngDataUrl.startsWith(prefix)) {
    throw new TypeError(`${capture.side}/${capture.viewName} is not a base64 PNG data URL.`);
  }
  const encoded = capture.pngDataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) {
    throw new TypeError(`${capture.side}/${capture.viewName} contains malformed base64 PNG data.`);
  }
  return Buffer.from(encoded, "base64");
}

function validateCapture(
  capture: PartVisualAdmissionCaptureTransport,
  expectedSide: "source" | "candidate",
  expectedView: (typeof PART_VISUAL_ADMISSION_VIEW_NAMES)[number],
  expectedProjection: "orthographic" | "perspective",
): { readonly png: Buffer; readonly rgba: Buffer } {
  if (
    capture.side !== expectedSide ||
    capture.viewName !== expectedView ||
    capture.cameraName !== `part-visual-admission-camera:${expectedView}` ||
    capture.projection !== expectedProjection ||
    capture.width !== PART_VISUAL_ADMISSION_CAPTURE_POLICY.width ||
    capture.height !== PART_VISUAL_ADMISSION_CAPTURE_POLICY.height
  ) {
    throw new TypeError(
      `Visual-admission capture at ${expectedSide}/${expectedView} has mismatched side, label, projection, or dimensions: ${JSON.stringify({ side: capture.side, viewName: capture.viewName, cameraName: capture.cameraName, projection: capture.projection, width: capture.width, height: capture.height })}.`,
    );
  }
  const png = dataUrlBytes(capture);
  if (png.length <= 0 || png.length > PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes) {
    throw new RangeError(
      `${capture.side}/${capture.viewName} PNG is ${png.length} bytes; allowed range is 1..${PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes}.`,
    );
  }
  const dimensions = inspectPng(png);
  if (dimensions.width !== capture.width || dimensions.height !== capture.height) {
    throw new Error(
      `${capture.side}/${capture.viewName} PNG IHDR is ${dimensions.width}x${dimensions.height}, not ${capture.width}x${capture.height}.`,
    );
  }
  const rgba = Buffer.from(capture.rgbaBase64, "base64");
  const expectedRgbaBytes = capture.width * capture.height * 4;
  if (
    rgba.length !== expectedRgbaBytes ||
    capture.rgbaBytes !== expectedRgbaBytes ||
    capture.rgbaSha256 !== sha256(rgba)
  ) {
    throw new Error(
      `${capture.side}/${capture.viewName} RGBA transport is ${rgba.length} bytes/${sha256(rgba)}, not ${capture.rgbaBytes} bytes/${capture.rgbaSha256}; expected ${expectedRgbaBytes} raw bytes.`,
    );
  }
  return { png, rgba };
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) mkdirSync(path);
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new TypeError(
      `Visual-admission artifact directory is not an ordinary directory: ${path}.`,
    );
  }
}

function outputRoot(path: string): string {
  const repository = realpathSync.native(process.cwd());
  const absolute = resolve(path);
  if (!inside(repository, absolute)) {
    throw new TypeError(
      `Visual-admission packet output must stay below repository ${repository}; received ${absolute}.`,
    );
  }
  const candidate = relative(repository, absolute).replaceAll("\\", "/");
  if (!/^(?:output|test-results)(?:\/[A-Za-z0-9._@-]+)+$/u.test(candidate)) {
    throw new TypeError(
      `Visual-admission packet output must be a strict descendant of ignored output/ or test-results/; received ${candidate}.`,
    );
  }
  let current = repository;
  for (const segment of candidate.split("/")) {
    current = join(current, segment);
    ensureDirectory(current);
  }
  return absolute;
}

function writeExclusive(path: string, bytes: Uint8Array): void {
  const descriptor = openSync(path, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0)
        throw new Error(`Writing ${path} stopped at ${offset}/${bytes.length} bytes.`);
      offset += count;
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function boundedCleanup(path: string, expected: Stats): void {
  if (!existsSync(path)) return;
  const observed = lstatSync(path);
  if (
    observed.isSymbolicLink() ||
    !observed.isDirectory() ||
    observed.ino !== expected.ino ||
    (observed.dev !== 0 && expected.dev !== 0 && observed.dev !== expected.dev)
  ) {
    throw new Error(`Refusing cleanup of replaced visual-admission staging directory ${path}.`);
  }
  rmSync(path, { recursive: true, force: false, maxRetries: 0 });
}

function promoteStagingDirectory(staging: string, final: string, expected: Stats): void {
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      renameSync(staging, final);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (!["EPERM", "EACCES"].includes(code ?? "") || existsSync(final)) throw error;
      const observed = lstatSync(staging);
      if (
        observed.isSymbolicLink() ||
        !observed.isDirectory() ||
        observed.ino !== expected.ino ||
        (observed.dev !== 0 && expected.dev !== 0 && observed.dev !== expected.dev)
      ) {
        throw new Error(
          `Refusing retry for replaced visual-admission staging directory ${staging}.`,
          { cause: error },
        );
      }
      Atomics.wait(sleeper, 0, 0, 25);
    }
  }
  throw new Error(`Could not promote visual-admission staging directory ${staging}.`, {
    cause: lastError,
  });
}

export function publishPartVisualAdmissionPacket(input: {
  readonly outputRoot: string;
  readonly source: VerifiedMaterializedLDrawClosure;
  readonly capture: PartVisualAdmissionCaptureResult;
  readonly browserVersion: string;
  readonly timestamp?: string;
  readonly nonce?: string;
}): {
  readonly directory: string;
  readonly packetPath: string;
  readonly packet: PartVisualAdmissionPacket;
} {
  if (
    input.capture.sourceClosureDigest !== input.source.manifestDigest ||
    input.capture.viewPolicyHash !== PART_VISUAL_ADMISSION_VIEW_POLICY_HASH ||
    input.capture.capturePolicyHash !== PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH ||
    input.capture.cameraPacketHash !== canonicalDigest(input.capture.cameraPacket) ||
    input.capture.rendererBuildHash !== canonicalDigest(input.capture.rendererBuild)
  ) {
    throw new Error(
      "Visual-admission browser capture does not bind the verified source or active policies.",
    );
  }
  if (
    input.capture.sceneAudit.gridHelpers !== 0 ||
    input.capture.sceneAudit.shadowCasters !== 0 ||
    input.capture.sceneAudit.shadowReceivers !== 0 ||
    input.capture.sceneAudit.selectionObjects !== 0 ||
    input.capture.sceneAudit.sharedMaterialInstances !== 1 ||
    input.capture.sceneAudit.primaryMaterialSide !== "FrontSide"
  ) {
    throw new Error(
      `Visual-admission scene is not clean and shared-material: ${JSON.stringify(input.capture.sceneAudit)}.`,
    );
  }
  if (
    !input.capture.cleanup.rendererDisposed ||
    !input.capture.cleanup.contextLossRequested ||
    !input.capture.cleanup.canvasRemoved ||
    input.capture.cleanup.canvasesRemaining !== 0
  ) {
    throw new Error(
      `Visual-admission browser resources were not fully retired: ${JSON.stringify(input.capture.cleanup)}.`,
    );
  }
  if (input.capture.captures.length !== PART_VISUAL_ADMISSION_VIEW_NAMES.length * 2) {
    throw new RangeError(
      `Visual admission returned ${input.capture.captures.length} captures; expected 16 exact side/view pairs.`,
    );
  }
  const prepared: { capture: PartVisualAdmissionCaptureTransport; png: Buffer; rgba: Buffer }[] =
    [];
  let totalPngBytes = 0;
  let totalRgbaBytes = 0;
  for (const [sideIndex, side] of (["source", "candidate"] as const).entries()) {
    for (const [viewIndex, viewName] of PART_VISUAL_ADMISSION_VIEW_NAMES.entries()) {
      const capture =
        input.capture.captures[sideIndex * PART_VISUAL_ADMISSION_VIEW_NAMES.length + viewIndex]!;
      const view = input.capture.cameraPacket.views[viewIndex]!;
      const decoded = validateCapture(capture, side, viewName, view.projection);
      prepared.push({ capture, ...decoded });
      totalPngBytes += decoded.png.length;
      totalRgbaBytes += decoded.rgba.length;
    }
  }
  if (
    totalPngBytes > PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxTotalPngBytes ||
    totalRgbaBytes > PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxTransferredRgbaBytes
  ) {
    throw new RangeError(
      `Visual-admission transport totals ${totalPngBytes} PNG and ${totalRgbaBytes} RGBA bytes; limits are ${PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxTotalPngBytes} and ${PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxTransferredRgbaBytes}.`,
    );
  }

  const createdAt = input.timestamp ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(createdAt)) {
    throw new TypeError(`Visual-admission timestamp must be canonical UTC ISO-8601: ${createdAt}.`);
  }
  const nonce = input.nonce ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(nonce)) {
    throw new TypeError(`Visual-admission nonce must be lowercase UUIDv4: ${nonce}.`);
  }
  const binding = canonicalDigest({
    source: input.source.manifestDigest,
    catalog: input.capture.catalogHash,
    definition: input.capture.definitionHash,
    mesh: input.capture.meshHash,
    frame: input.capture.frameHash,
    camera: input.capture.cameraPacketHash,
  }).slice("sha256:".length, "sha256:".length + 12);
  const runId = `${createdAt.replaceAll(/[:.]/gu, "-")}-${binding}-${nonce}`;
  const root = outputRoot(input.outputRoot);
  const runs = join(root, "runs");
  ensureDirectory(runs);
  const staging = join(runs, `.tmp-${runId}`);
  const final = join(runs, runId);
  if (existsSync(staging) || existsSync(final)) {
    throw new Error(`Visual-admission immutable run already exists: ${runId}.`);
  }
  mkdirSync(staging);
  const stagingIdentity = statSync(staging);
  try {
    ensureDirectory(join(staging, "source"));
    ensureDirectory(join(staging, "candidate"));
    const images: PublishedImage[] = [];
    for (const { capture, png, rgba } of prepared) {
      const path = `${capture.side}/${capture.viewName}.png`;
      writeExclusive(join(staging, ...path.split("/")), png);
      images.push({
        side: capture.side,
        viewName: capture.viewName,
        cameraName: capture.cameraName,
        projection: capture.projection,
        path,
        sha256: sha256(png),
        bytes: png.length,
        width: capture.width,
        height: capture.height,
        rgbaSha256: sha256(rgba),
        rgbaBytes: rgba.length,
        rgbaOrigin: PART_VISUAL_ADMISSION_CAPTURE_POLICY.rgbaOrigin,
      });
    }
    const source = Object.fromEntries(
      Object.entries(input.source).filter(
        ([key]) => key !== "manifestPath" && key !== "libraryPath",
      ),
    ) as Omit<VerifiedMaterializedLDrawClosure, "manifestPath" | "libraryPath">;
    const packetBase = {
      schemaVersion: PACKET_SCHEMA,
      runId,
      createdAt,
      reviewState: "pending" as const,
      source,
      candidate: {
        catalogId: input.capture.catalogId,
        catalogHash: input.capture.catalogHash,
        definitionHash: input.capture.definitionHash,
        meshHash: input.capture.meshHash,
        frameHash: input.capture.frameHash,
      },
      policy: {
        viewPolicy: PART_VISUAL_ADMISSION_VIEW_POLICY,
        viewPolicyHash: PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
        capturePolicy: PART_VISUAL_ADMISSION_CAPTURE_POLICY,
        capturePolicyHash: PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
      },
      cameraPacket: input.capture.cameraPacket,
      cameraPacketHash: input.capture.cameraPacketHash,
      sourceBounds: input.capture.sourceBounds,
      candidateBounds: input.capture.candidateBounds,
      renderer: {
        browserVersion: input.browserVersion,
        build: input.capture.rendererBuild,
        buildHash: input.capture.rendererBuildHash,
      },
      images,
      diagnosticMetrics: input.capture.metrics,
      renderDiagnostics: input.capture.diagnostics,
      sceneAudit: input.capture.sceneAudit,
      cleanup: input.capture.cleanup,
    } as const;
    const packet = deepFreeze({
      ...packetBase,
      packetHash: canonicalDigest(packetBase),
    }) satisfies PartVisualAdmissionPacket;
    writeExclusive(join(staging, "packet.json"), Buffer.from(`${canonicalStringify(packet)}\n`));
    promoteStagingDirectory(staging, final, stagingIdentity);
    const packetPath = join(final, "packet.json");
    const retained = JSON.parse(
      exactFile(packetPath, MAXIMUM_MANIFEST_BYTES, "visual-admission packet").toString("utf8"),
    ) as PartVisualAdmissionPacket;
    const { packetHash, ...retainedBase } = retained;
    if (packetHash !== canonicalDigest(retainedBase) || packetHash !== packet.packetHash) {
      throw new Error(
        `Published visual-admission packet ${runId} failed its retained digest check.`,
      );
    }
    for (const image of packet.images) {
      const bytes = exactFile(
        join(final, ...image.path.split("/")),
        PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes,
        `visual-admission image ${image.path}`,
      );
      if (bytes.length !== image.bytes || sha256(bytes) !== image.sha256) {
        throw new Error(
          `Published visual-admission image ${image.path} failed its retained digest check.`,
        );
      }
    }
    return { directory: final, packetPath, packet };
  } catch (error) {
    if (existsSync(staging)) boundedCleanup(staging, stagingIdentity);
    throw error;
  }
}
