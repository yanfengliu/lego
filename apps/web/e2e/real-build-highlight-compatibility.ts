import { createHash } from "node:crypto";

import { measureWholeStepMaskEvidence } from "./real-build-contract";

export const HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA =
  "lego.highlight-exclusivity-render-cases/1" as const;
export const HIGHLIGHT_EXCLUSIVITY_COMPATIBILITY_SCHEMA =
  "lego.highlight-exclusivity-renderer-compatibility/1" as const;
export const HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION =
  "lego.highlight-exclusivity-fixed-cases/1" as const;
export const HIGHLIGHT_EXCLUSIVITY_DERIVATION_VERSION =
  "lego.highlight-exclusivity-derivation/1" as const;
export const HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET = 8 as const;

export const HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS = {
  width: 500,
  height: 375,
  probeHex: "923978",
  finish: "instruction",
  silhouetteMode: true,
  azimuthDegrees: 41,
  elevationDegrees: 26,
  pixelsPerUnit: 52,
  centerXPx: 250,
  centerYPx: 232.5,
} as const;

export const HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY = [
  {
    caseId: "adjacent-small-pieces",
    pieceKeys: ["adjacent-left", "adjacent-right"],
  },
  {
    caseId: "separated-small-pieces",
    pieceKeys: ["separated-left", "separated-right"],
  },
] as const;

export const HIGHLIGHT_EXCLUSIVITY_LIMITS = {
  maximumRawBytes: 2 * 1024 * 1024,
  maximumSummaryBytes: 512 * 1024,
  maximumDecodedMaskBytes: 1024 * 1024,
  maximumPixelsPerCase: 1024 * 1024,
  maximumDimension: 2048,
} as const;

const PACKED_MASK_ENCODING = "base64-lsb0-bitset/1" as const;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export interface HighlightExclusivityPackedMask {
  readonly encoding: typeof PACKED_MASK_ENCODING;
  readonly byteLength: number;
  readonly digest: string;
  readonly data: string;
}

export interface HighlightExclusivityRenderCase {
  readonly caseId: (typeof HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY)[number]["caseId"];
  readonly width: number;
  readonly height: number;
  readonly pieceKeys: readonly string[];
  readonly highlightMask: HighlightExclusivityPackedMask;
  readonly pieceMasks: readonly HighlightExclusivityPackedMask[];
}

export interface HighlightExclusivityRenderCases {
  readonly schemaVersion: typeof HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA;
  readonly registryVersion: typeof HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION;
  readonly render: typeof HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS;
  readonly cases: readonly HighlightExclusivityRenderCase[];
}

interface MaskEvidenceSummary {
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
}

export interface HighlightExclusivityCompatibility {
  readonly schemaVersion: typeof HIGHLIGHT_EXCLUSIVITY_COMPATIBILITY_SCHEMA;
  readonly renderCasesDigest: string;
  readonly registryVersion: typeof HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION;
  readonly derivationVersion: typeof HIGHLIGHT_EXCLUSIVITY_DERIVATION_VERSION;
  readonly policyTargetExclusiveHighlightPixelsPerPiece: typeof HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET;
  readonly cases: readonly (MaskEvidenceSummary & {
    readonly caseId: string;
    readonly caseDigest: string;
    readonly pixelCount: number;
  })[];
  readonly observedMinimumExclusivePixels: number;
  readonly policyMinimumExclusiveHighlightPixelsPerPiece: typeof HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET;
}

export interface HighlightExclusivityCompilation {
  readonly renderCases: HighlightExclusivityRenderCases;
  readonly summary: HighlightExclusivityCompatibility;
  readonly summaryBytes: Uint8Array;
}

interface DecodedRenderCase {
  readonly value: HighlightExclusivityRenderCase;
  readonly highlightMask: Uint8Array;
  readonly pieceMasks: readonly Uint8Array[];
}

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const encodeCompact = (value: unknown): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(value)}\n`);

const encodeSummary = (value: unknown): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(value, null, 1)}\n`);

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object; received ${JSON.stringify(value)}.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TypeError(
      `${label} must contain exactly [${wanted.join(", ")}]; received [${actual.join(", ")}].`,
    );
  }
}

function strictJson(bytes: Uint8Array, label: string, maximumBytes: number): unknown {
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    throw new TypeError(
      `${label} must contain 1..${maximumBytes} bytes; received ${bytes.length}.`,
    );
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new TypeError(
      `${label} must be strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}

function safePixelCount(width: unknown, height: unknown, label: string): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw new TypeError(`${label} dimensions must be safe integers; received ${width}x${height}.`);
  }
  const typedWidth = width as number;
  const typedHeight = height as number;
  if (typedWidth <= 0 || typedHeight <= 0) {
    throw new TypeError(
      `${label} dimensions must be positive; received ${typedWidth}x${typedHeight}.`,
    );
  }
  const pixels = typedWidth * typedHeight;
  if (!Number.isSafeInteger(pixels) || pixels <= 0) {
    throw new TypeError(
      `${label} dimension multiplication must produce a positive safe pixel count; received ${typedWidth}x${typedHeight}.`,
    );
  }
  if (
    typedWidth > HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDimension ||
    typedHeight > HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDimension ||
    pixels > HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumPixelsPerCase
  ) {
    throw new TypeError(
      `${label} is ${typedWidth}x${typedHeight}/${pixels}px, beyond the ${HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDimension}px dimension and ${HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumPixelsPerCase}px area limits.`,
    );
  }
  return pixels;
}

function decodeMask(
  value: unknown,
  pixelCount: number,
  label: string,
  budget: { decodedBytes: number },
): { readonly value: HighlightExclusivityPackedMask; readonly pixels: Uint8Array } {
  const mask = record(value, label);
  exactKeys(mask, ["encoding", "byteLength", "digest", "data"], label);
  if (mask.encoding !== PACKED_MASK_ENCODING) {
    throw new TypeError(
      `${label}.encoding must be ${PACKED_MASK_ENCODING}; received ${JSON.stringify(mask.encoding)}.`,
    );
  }
  if (typeof mask.data !== "string" || !BASE64_PATTERN.test(mask.data)) {
    throw new TypeError(`${label}.data must be canonical padded base64.`);
  }
  const packed = Buffer.from(mask.data, "base64");
  budget.decodedBytes += packed.length;
  if (budget.decodedBytes > HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDecodedMaskBytes) {
    throw new TypeError(
      `Highlight compatibility decoded masks exceed ${HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDecodedMaskBytes} bytes at ${label}; refuse the bundle before retaining more data.`,
    );
  }
  if (packed.toString("base64") !== mask.data) {
    throw new TypeError(`${label}.data is not the canonical base64 spelling of its decoded bytes.`);
  }
  const expectedBytes = Math.ceil(pixelCount / 8);
  if (
    !Number.isSafeInteger(mask.byteLength) ||
    mask.byteLength !== packed.length ||
    packed.length !== expectedBytes
  ) {
    throw new TypeError(
      `${label} must decode to exactly ${expectedBytes} bytes for ${pixelCount} pixels; declared ${String(mask.byteLength)}, decoded ${packed.length}.`,
    );
  }
  if (typeof mask.digest !== "string" || !SHA256_PATTERN.test(mask.digest)) {
    throw new TypeError(`${label}.digest must be a lowercase sha256 digest.`);
  }
  if (digest(packed) !== mask.digest) {
    throw new TypeError(
      `${label} bytes do not match ${mask.digest}; regenerate the mask from the fixed renderer case.`,
    );
  }
  const remainder = pixelCount % 8;
  if (remainder !== 0 && (packed.at(-1)! & ~((1 << remainder) - 1)) !== 0) {
    throw new TypeError(
      `${label} sets padding bits beyond pixel ${pixelCount - 1}; zero every trailing LSB0 bit.`,
    );
  }
  const pixels = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    pixels[index] = (packed[index >> 3]! >> (index & 7)) & 1;
  }
  return {
    value: {
      encoding: PACKED_MASK_ENCODING,
      byteLength: packed.length,
      digest: mask.digest,
      data: mask.data,
    },
    pixels,
  };
}

function parseRenderSettings(value: unknown): typeof HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS {
  const render = record(value, "Highlight compatibility render settings");
  const expected = HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS;
  exactKeys(render, Object.keys(expected), "Highlight compatibility render settings");
  safePixelCount(render.width, render.height, "Highlight compatibility render settings");
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (render[key] !== expectedValue) {
      throw new TypeError(
        `Highlight compatibility render setting ${key} must be ${JSON.stringify(expectedValue)}; received ${JSON.stringify(render[key])}.`,
      );
    }
  }
  return expected;
}

function parseCase(
  value: unknown,
  registry: (typeof HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY)[number],
  budget: { decodedBytes: number },
): DecodedRenderCase {
  const input = record(value, `Highlight compatibility case ${registry.caseId}`);
  exactKeys(
    input,
    ["caseId", "width", "height", "pieceKeys", "highlightMask", "pieceMasks"],
    `Highlight compatibility case ${registry.caseId}`,
  );
  if (input.caseId !== registry.caseId) {
    throw new TypeError(
      `Highlight compatibility case registry position requires ${registry.caseId}; received ${JSON.stringify(input.caseId)}. Missing, duplicated, or reordered cases are not evidence.`,
    );
  }
  const pixelCount = safePixelCount(
    input.width,
    input.height,
    `Compatibility case ${registry.caseId}`,
  );
  if (
    input.width !== HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width ||
    input.height !== HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height
  ) {
    throw new TypeError(
      `Compatibility case ${registry.caseId} must use ${HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width}x${HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height}; received ${String(input.width)}x${String(input.height)}.`,
    );
  }
  if (
    !Array.isArray(input.pieceKeys) ||
    JSON.stringify(input.pieceKeys) !== JSON.stringify(registry.pieceKeys)
  ) {
    throw new TypeError(
      `Compatibility case ${registry.caseId} must bind piece keys [${registry.pieceKeys.join(", ")}] in registry order; received ${JSON.stringify(input.pieceKeys)}.`,
    );
  }
  if (!Array.isArray(input.pieceMasks) || input.pieceMasks.length !== registry.pieceKeys.length) {
    throw new TypeError(
      `Compatibility case ${registry.caseId} needs exactly ${registry.pieceKeys.length} piece masks; received ${Array.isArray(input.pieceMasks) ? input.pieceMasks.length : "non-array"}.`,
    );
  }
  const highlight = decodeMask(
    input.highlightMask,
    pixelCount,
    `${registry.caseId}.highlightMask`,
    budget,
  );
  const pieces = input.pieceMasks.map((mask, index) =>
    decodeMask(mask, pixelCount, `${registry.caseId}.pieceMasks[${index}]`, budget),
  );
  return {
    value: {
      caseId: registry.caseId,
      width: input.width as number,
      height: input.height as number,
      pieceKeys: [...registry.pieceKeys],
      highlightMask: highlight.value,
      pieceMasks: pieces.map(({ value: packed }) => packed),
    },
    highlightMask: highlight.pixels,
    pieceMasks: pieces.map(({ pixels }) => pixels),
  };
}

function parseRenderCasesInternal(bytes: Uint8Array): {
  readonly value: HighlightExclusivityRenderCases;
  readonly decodedCases: readonly DecodedRenderCase[];
} {
  const root = record(
    strictJson(
      bytes,
      "Highlight exclusivity render cases",
      HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumRawBytes,
    ),
    "Highlight exclusivity render cases",
  );
  exactKeys(root, ["schemaVersion", "registryVersion", "render", "cases"], "Render cases");
  if (root.schemaVersion !== HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA) {
    throw new TypeError(
      `Render cases schema must be ${HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA}; received ${JSON.stringify(root.schemaVersion)}.`,
    );
  }
  if (root.registryVersion !== HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION) {
    throw new TypeError(
      `Render cases registry must be ${HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION}; received ${JSON.stringify(root.registryVersion)}.`,
    );
  }
  const render = parseRenderSettings(root.render);
  if (
    !Array.isArray(root.cases) ||
    root.cases.length !== HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY.length
  ) {
    throw new TypeError(
      `Render cases must contain exactly ${HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY.length} fixed cases; received ${Array.isArray(root.cases) ? root.cases.length : "non-array"}.`,
    );
  }
  const rootCases = root.cases as unknown[];
  const budget = { decodedBytes: 0 };
  const decodedCases = HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY.map((registry, index) =>
    parseCase(rootCases[index], registry, budget),
  );
  const normalized: HighlightExclusivityRenderCases = {
    schemaVersion: HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA,
    registryVersion: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
    render,
    cases: decodedCases.map(({ value }) => value),
  };
  const canonical = encodeCompact(normalized);
  if (!bytesEqual(bytes, canonical)) {
    throw new TypeError(
      "Highlight exclusivity render cases are not the exact canonical JSON bytes; regenerate instead of reformatting, reordering, or duplicating keys.",
    );
  }
  return { value: normalized, decodedCases };
}

export function parseHighlightExclusivityRenderCases(
  bytes: Uint8Array,
): HighlightExclusivityRenderCases {
  return parseRenderCasesInternal(bytes).value;
}

/**
 * Recomputes the renderer-compatibility summary from retained mask bits.
 *
 * This proves internal consistency only. A live source-mirror renderer must independently reproduce the
 * raw role before a run may claim that these bytes came from the renderer.
 */
export function compileHighlightExclusivityCompatibility(
  renderCasesBytes: Uint8Array,
): HighlightExclusivityCompilation {
  const { value, decodedCases } = parseRenderCasesInternal(renderCasesBytes);
  const cases = decodedCases.map((entry) => {
    const measured = measureWholeStepMaskEvidence(
      entry.pieceMasks,
      entry.highlightMask,
      entry.value.width,
    );
    if (
      measured.unionHighlightPixels <= 0 ||
      measured.summedPieceHighlightPixels < measured.unionHighlightPixels
    ) {
      throw new TypeError(
        `Compatibility case ${entry.value.caseId} has no positive jointly covered highlight, so it cannot test the explicit policy.`,
      );
    }
    // Named field by field rather than spread, because this summary is a
    // committed calibration bound by digest: spreading the measurement means
    // any field added to it for any other reason silently invalidates the
    // artifact, and the run then refuses its own inputs. What this artifact
    // certifies is exclusivity, so exclusivity is what it records.
    return {
      caseId: entry.value.caseId,
      caseDigest: digest(encodeCompact(entry.value)),
      pixelCount: entry.highlightMask.length,
      unionHighlightPixels: measured.unionHighlightPixels,
      summedPieceHighlightPixels: measured.summedPieceHighlightPixels,
      exclusiveHighlightPixelsByPiece: measured.exclusiveHighlightPixelsByPiece,
    };
  });
  const observedMinimumExclusivePixels = Math.min(
    ...cases.flatMap(({ exclusiveHighlightPixelsByPiece }) => exclusiveHighlightPixelsByPiece),
  );
  if (observedMinimumExclusivePixels < HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET) {
    throw new TypeError(
      `Fixed renderer masks do not support the explicit ${HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET}px exclusivity policy: ` +
        `the observed per-piece minimum is ${observedMinimumExclusivePixels}. This compatibility check does not derive ` +
        `the policy or authenticate visual correctness; inspect the live renderer cases instead of lowering the policy.`,
    );
  }
  const summary: HighlightExclusivityCompatibility = {
    schemaVersion: HIGHLIGHT_EXCLUSIVITY_COMPATIBILITY_SCHEMA,
    renderCasesDigest: digest(renderCasesBytes),
    registryVersion: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
    derivationVersion: HIGHLIGHT_EXCLUSIVITY_DERIVATION_VERSION,
    policyTargetExclusiveHighlightPixelsPerPiece: HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET,
    cases,
    observedMinimumExclusivePixels,
    policyMinimumExclusiveHighlightPixelsPerPiece: HIGHLIGHT_EXCLUSIVITY_POLICY_TARGET,
  };
  return { renderCases: value, summary, summaryBytes: encodeSummary(summary) };
}

/** Verifies exact role hashes and exact compiler output; it deliberately does not authenticate origin. */
export function verifyHighlightExclusivityCompatibility(input: {
  readonly renderCasesBytes: Uint8Array;
  readonly summaryBytes: Uint8Array;
  readonly expectedRenderCasesDigest: string;
  readonly expectedCompatibilityDigest: string;
}): HighlightExclusivityCompatibility {
  if (!SHA256_PATTERN.test(input.expectedRenderCasesDigest)) {
    throw new TypeError("Expected highlight render-cases role digest must be lowercase sha256.");
  }
  if (!SHA256_PATTERN.test(input.expectedCompatibilityDigest)) {
    throw new TypeError("Expected highlight compatibility role digest must be lowercase sha256.");
  }
  if (digest(input.renderCasesBytes) !== input.expectedRenderCasesDigest) {
    throw new TypeError(
      `Highlight render-cases bytes do not match bound raw role ${input.expectedRenderCasesDigest}.`,
    );
  }
  if (
    input.summaryBytes.length === 0 ||
    input.summaryBytes.length > HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumSummaryBytes
  ) {
    throw new TypeError(
      `Highlight compatibility summary must contain 1..${HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumSummaryBytes} bytes; received ${input.summaryBytes.length}.`,
    );
  }
  if (digest(input.summaryBytes) !== input.expectedCompatibilityDigest) {
    throw new TypeError(
      `Highlight compatibility bytes do not match bound summary role ${input.expectedCompatibilityDigest}.`,
    );
  }
  const compiled = compileHighlightExclusivityCompatibility(input.renderCasesBytes);
  if (!bytesEqual(input.summaryBytes, compiled.summaryBytes)) {
    throw new TypeError(
      "Highlight compatibility summary is not the exact byte-for-byte compiler output from the bound raw masks; regenerate it instead of editing or self-rehashing derived claims.",
    );
  }
  return compiled.summary;
}
