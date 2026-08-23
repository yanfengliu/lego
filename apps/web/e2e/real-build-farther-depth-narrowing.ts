import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import type { StepCameraFrame, StepCameraView } from "./real-build-step-camera";

type BrowserModule = ReturnType<typeof JSON.parse>;
type DepthSurface = ReturnType<typeof JSON.parse>;

const PROBE_COLOR_ID = "builtin:magenta";
export const DEPTH_NARROWING_CACHE_MAX_ENTRIES = 1_280;
export const DEPTH_NARROWING_CACHE_MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;

interface RenderPart {
  readonly id: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: unknown;
}

interface ProbeCacheEntry {
  readonly surface: DepthSurface;
  readonly fragments: number;
  readonly payloadBytes: number;
}

export interface DepthNarrowingStatistics {
  readonly logicalRows: number;
  readonly prefixCaptures: number;
  readonly probeCaptures: number;
  readonly fallbackCaptures: number;
  readonly equalDepthFallbacks: number;
  readonly subjectRenders: number;
  readonly depthPackPasses: number;
  readonly depthPackPixels: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheEvictions: number;
  readonly cacheEntries: number;
  readonly cacheFragments: number;
  readonly cachePayloadBytes: number;
  readonly peakCacheEntries: number;
  readonly peakCacheFragments: number;
  readonly peakCachePayloadBytes: number;
}

export interface StepDepthProbeInput<D> {
  readonly baseDocument: D;
  readonly placedDocument: D;
  readonly probePartId: string;
  readonly catalogPartId: string;
  readonly chargeSubjectRender: () => void;
  readonly fallbackWholeSceneMask: () => Uint8Array;
}

export interface StepDepthNarrowingComposer<D> {
  /** At most one prefix, one probe per row, and one whole-scene fallback per row. */
  maximumSubjectRenders(offeredCount: number): number;
  beginBatch(document: D, subjectKey: string, chargeSubjectRender: () => void): void;
  probeMask(input: StepDepthProbeInput<D>): Uint8Array;
  endBatch(): void;
  statistics(): DepthNarrowingStatistics;
  dispose(): void;
}

function requireOfferedCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `Depth-composed narrowing offered count is ${String(value)}; required a non-negative safe integer.`,
    );
  }
  return value;
}

function renderParts(document: unknown, label: string): readonly RenderPart[] {
  const parts = (document as { readonly parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    throw new TypeError(`${label} must expose a dense parts array before depth composition.`);
  }
  return parts.map((part, index) => {
    if (typeof part !== "object" || part === null) {
      throw new TypeError(`${label}.parts[${index}] must be a brick part object.`);
    }
    const candidate = part as Partial<RenderPart>;
    if (
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      typeof candidate.catalogPartId !== "string" ||
      candidate.catalogPartId.length === 0 ||
      typeof candidate.colorId !== "string" ||
      candidate.colorId.length === 0 ||
      typeof candidate.transform !== "object" ||
      candidate.transform === null
    ) {
      throw new TypeError(
        `${label}.parts[${index}] must expose non-empty id, catalogPartId, colorId, and an object transform.`,
      );
    }
    return candidate as RenderPart;
  });
}

function descriptor(part: RenderPart): string {
  return JSON.stringify({
    id: part.id,
    catalogPartId: part.catalogPartId,
    colorId: part.colorId,
    transform: part.transform,
  });
}

function probeRenderDescriptor(part: RenderPart): string {
  return JSON.stringify({
    catalogPartId: part.catalogPartId,
    colorId: part.colorId,
    transform: part.transform,
  });
}

function requireExactAddedProbe(input: {
  readonly baseDocument: unknown;
  readonly placedDocument: unknown;
  readonly probePartId: string;
  readonly catalogPartId: string;
}): {
  readonly placedParts: readonly RenderPart[];
  readonly probeRenderDescriptor: string;
} {
  const before = renderParts(input.baseDocument, "Depth-composed narrowing base document");
  const after = renderParts(input.placedDocument, "Depth-composed narrowing placed document");
  if (after.length !== before.length + 1) {
    throw new TypeError(
      `Depth-composed narrowing placement ${JSON.stringify(input.probePartId)} changed the render subject from ${before.length} to ${after.length} parts; required exactly one added probe.`,
    );
  }
  const beforeById = new Map(before.map((part) => [part.id, descriptor(part)] as const));
  if (beforeById.size !== before.length) {
    throw new TypeError("Depth-composed narrowing base document contains duplicate part ids.");
  }
  const afterById = new Map(after.map((part) => [part.id, descriptor(part)] as const));
  if (afterById.size !== after.length) {
    throw new TypeError("Depth-composed narrowing placed document contains duplicate part ids.");
  }
  for (const [partId, beforeDescriptor] of beforeById) {
    if (afterById.get(partId) !== beforeDescriptor) {
      throw new TypeError(
        `Depth-composed narrowing placement ${JSON.stringify(input.probePartId)} changed retained render descriptor ${JSON.stringify(partId)}; prefix/probe partitioning requires every retained part to be byte-identical.`,
      );
    }
  }
  if (beforeById.has(input.probePartId)) {
    throw new TypeError(
      `Depth-composed narrowing probe id ${JSON.stringify(input.probePartId)} already exists in the base document.`,
    );
  }
  const probe = after.find((part) => part.id === input.probePartId);
  if (
    probe === undefined ||
    probe.catalogPartId !== input.catalogPartId ||
    probe.colorId !== PROBE_COLOR_ID
  ) {
    throw new TypeError(
      `Depth-composed narrowing probe ${JSON.stringify(input.probePartId)} must be the one added ${JSON.stringify(input.catalogPartId)} part painted ${JSON.stringify(PROBE_COLOR_ID)}.`,
    );
  }
  return Object.freeze({
    placedParts: after,
    probeRenderDescriptor: probeRenderDescriptor(probe),
  });
}

/** Creates the parent-local exact-depth scorer used only by the opt-in fixed-budget route. */
export function createStepDepthNarrowingComposer<D>(input: {
  readonly rendering: Pick<PreparedRealBuildModules, "rendering">["rendering"];
  readonly renderer: BrowserModule;
  readonly view: StepCameraView;
  readonly frame: StepCameraFrame;
  readonly centrePx: readonly [number, number];
  readonly widthPx: number;
  readonly heightPx: number;
}): StepDepthNarrowingComposer<D> {
  const { rendering, renderer, view, frame, centrePx, widthPx, heightPx } = input;
  const camera = rendering.createOrthographicViewCamera(
    { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
    frame,
  );
  const cache = new Map<string, ProbeCacheEntry>();
  let prefix: DepthSurface | null = null;
  let batchMode: "none" | "depth" | "whole-scene" = "none";
  let logicalRows = 0;
  let prefixCaptures = 0;
  let probeCaptures = 0;
  let fallbackCaptures = 0;
  let equalDepthFallbacks = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheEvictions = 0;
  let cacheFragments = 0;
  let cachePayloadBytes = 0;
  let peakCacheEntries = 0;
  let peakCacheFragments = 0;
  let peakCachePayloadBytes = 0;
  let disposed = false;

  const requireLive = (): void => {
    if (!disposed) return;
    throw new Error("Cannot use a disposed step depth-narrowing composer.");
  };
  const touch = (key: string): ProbeCacheEntry | null => {
    const entry = cache.get(key);
    if (entry === undefined) return null;
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  };
  const evictOldest = (): void => {
    const oldest = cache.entries().next().value as [string, ProbeCacheEntry] | undefined;
    if (oldest === undefined) return;
    cache.delete(oldest[0]);
    cacheFragments -= oldest[1].fragments;
    cachePayloadBytes -= oldest[1].payloadBytes;
    cacheEvictions += 1;
  };
  const retain = (key: string, entry: ProbeCacheEntry): void => {
    if (entry.payloadBytes > DEPTH_NARROWING_CACHE_MAX_PAYLOAD_BYTES) return;
    while (
      cache.size >= DEPTH_NARROWING_CACHE_MAX_ENTRIES ||
      cachePayloadBytes + entry.payloadBytes > DEPTH_NARROWING_CACHE_MAX_PAYLOAD_BYTES
    ) {
      evictOldest();
    }
    cache.set(key, entry);
    cacheFragments += entry.fragments;
    cachePayloadBytes += entry.payloadBytes;
    peakCacheEntries = Math.max(peakCacheEntries, cache.size);
    peakCacheFragments = Math.max(peakCacheFragments, cacheFragments);
    peakCachePayloadBytes = Math.max(peakCachePayloadBytes, cachePayloadBytes);
  };
  const derive = (document: D): BrowserModule => {
    const scene = rendering.deriveBrickScene(document, { finish: "instruction" });
    rendering.setInstructionSilhouetteMode(scene.root, true);
    return scene;
  };

  return Object.freeze({
    maximumSubjectRenders(offeredCount: number): number {
      const offered = requireOfferedCount(offeredCount);
      return 1 + offered * 2;
    },
    beginBatch(document: D, subjectKey: string, chargeSubjectRender: () => void): void {
      requireLive();
      if (batchMode !== "none") {
        throw new TypeError(
          "Cannot begin a depth-composed narrowing batch before ending the previous batch.",
        );
      }
      if (
        renderParts(document, "Depth-composed narrowing base document").some(
          (part) => part.colorId === PROBE_COLOR_ID,
        )
      ) {
        batchMode = "whole-scene";
        return;
      }
      const scene = derive(document);
      try {
        chargeSubjectRender();
        prefix = renderer.captureDepthSurface(scene.root, camera, subjectKey);
        prefixCaptures += 1;
        batchMode = "depth";
      } finally {
        scene.dispose();
      }
    },
    probeMask(probeInput: StepDepthProbeInput<D>): Uint8Array {
      requireLive();
      logicalRows += 1;
      if (batchMode === "none") {
        throw new TypeError(
          "Cannot compose a probe before capturing this narrowing batch's prefix.",
        );
      }
      const exactProbe = requireExactAddedProbe(probeInput);
      if (batchMode === "whole-scene") {
        probeInput.chargeSubjectRender();
        fallbackCaptures += 1;
        return new Uint8Array(probeInput.fallbackWholeSceneMask());
      }
      if (prefix === null) {
        throw new TypeError(
          "Depth-composed narrowing entered depth mode without its authenticated prefix surface.",
        );
      }
      const cacheKey = exactProbe.probeRenderDescriptor;
      let entry = touch(cacheKey);
      if (entry === null) {
        cacheMisses += 1;
        const scene = derive(probeInput.placedDocument);
        try {
          const scenePartIds = [...(scene.partObjects as Map<string, unknown>).keys()];
          if (
            scenePartIds.length !== exactProbe.placedParts.length ||
            scenePartIds.some(
              (partId) => !exactProbe.placedParts.some((part) => part.id === partId),
            )
          ) {
            throw new TypeError(
              `Depth-composed narrowing derived ${scenePartIds.length} unique scene parts for ${exactProbe.placedParts.length} placed document parts; the exact prefix/probe partition is unavailable.`,
            );
          }
          for (const [partId, object] of scene.partObjects as Map<string, { visible: boolean }>) {
            object.visible = partId === probeInput.probePartId;
          }
          probeInput.chargeSubjectRender();
          const surface = renderer.captureSparseDepthSurface(scene.root, camera, cacheKey);
          probeCaptures += 1;
          const fragments = surface.nonClearPixels as number;
          entry = { surface, fragments, payloadBytes: fragments * 8 };
          retain(cacheKey, entry);
        } finally {
          scene.dispose();
        }
      } else {
        cacheHits += 1;
      }
      const composed = rendering.composeInstructionDepthPrefixWithSparseProbe(
        prefix,
        entry.surface,
      );
      if (composed.status === "composed") return new Uint8Array(composed.probeVisibleMask);
      if (composed.reason !== "equal-depth-tie") {
        throw new TypeError(
          `Depth-composed narrowing refused exact probe descriptor ${JSON.stringify(cacheKey)} with ${String(composed.reason)}: ${String(composed.message)}`,
        );
      }
      equalDepthFallbacks += 1;
      probeInput.chargeSubjectRender();
      fallbackCaptures += 1;
      return new Uint8Array(probeInput.fallbackWholeSceneMask());
    },
    endBatch(): void {
      requireLive();
      if (batchMode === "none") {
        throw new TypeError("Cannot end a depth-composed narrowing batch that has no prefix.");
      }
      prefix = null;
      batchMode = "none";
    },
    statistics(): DepthNarrowingStatistics {
      const depthPackPasses = prefixCaptures + probeCaptures;
      return Object.freeze({
        logicalRows,
        prefixCaptures,
        probeCaptures,
        fallbackCaptures,
        equalDepthFallbacks,
        subjectRenders: prefixCaptures + probeCaptures + fallbackCaptures,
        depthPackPasses,
        depthPackPixels: depthPackPasses * widthPx * heightPx,
        cacheHits,
        cacheMisses,
        cacheEvictions,
        cacheEntries: cache.size,
        cacheFragments,
        cachePayloadBytes,
        peakCacheEntries,
        peakCacheFragments,
        peakCachePayloadBytes,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      prefix = null;
      batchMode = "none";
      cache.clear();
      cacheFragments = 0;
      cachePayloadBytes = 0;
    },
  });
}
