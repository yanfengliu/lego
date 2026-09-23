import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import type { PanelFace } from "../src/assembly/panel-face.ts";

export type RealBuildPrefix50Step44LaterSourceRasterPurpose =
  | "page45-camera-raster"
  | "page45-contact-raster"
  | "page45-review-artifact-raster"
  | "page45-promotion-raster";

export type RealBuildPrefix50Step44LaterSourceVectorPurpose =
  "page44-step43-vector" | "page45-step44-vector";

export type RealBuildPrefix50Step44LaterSourceDerivedOperationRequest =
  | Readonly<{
      kind: "raster-page";
      purpose: RealBuildPrefix50Step44LaterSourceRasterPurpose;
      densityDpi: number;
      retainDecodedBytes: boolean;
    }>
  | Readonly<{
      kind: "panel-prefix";
      purpose: RealBuildPrefix50Step44LaterSourceVectorPurpose;
    }>;

export interface RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation {
  readonly schemaVersion: "lego.real-build-prefix50-step44-prepared-derived-operation/1";
  readonly requestCommitment: `sha256:${string}`;
  readonly outputScopeCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44LaterSourcePanelRow {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly rotationIconPresent: boolean;
  readonly panelFace: PanelFace;
}

interface RasterResultBody {
  readonly kind: "raster-page";
  readonly purpose: RealBuildPrefix50Step44LaterSourceRasterPurpose;
  readonly physicalPageNumber: 45;
  readonly densityDpi: number;
  readonly rendererVersion: string;
  readonly popplerToolchainCommitment: `sha256:${string}`;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly derivedCommitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44LaterSourceRasterResult =
  | Readonly<RasterResultBody & { readonly retainDecodedBytes: false }>
  | Readonly<
      RasterResultBody & {
        readonly retainDecodedBytes: true;
        readonly pngBytes: Uint8Array;
        readonly rgba: Uint8Array;
      }
    >;

export interface RealBuildPrefix50Step44LaterSourcePanelResult {
  readonly kind: "panel-prefix";
  readonly purpose: RealBuildPrefix50Step44LaterSourceVectorPurpose;
  readonly physicalPageNumber: 44 | 45;
  readonly firstPrintedStep: 1;
  readonly lastPrintedStep: 43 | 44;
  readonly pageCeiling: 44 | 45;
  readonly rows: readonly RealBuildPrefix50Step44LaterSourcePanelRow[];
  readonly rowsCommitment: `sha256:${string}`;
  readonly derivedCommitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44LaterSourceDerivedOperationResult =
  RealBuildPrefix50Step44LaterSourceRasterResult | RealBuildPrefix50Step44LaterSourcePanelResult;

export interface RealBuildPrefix50Step44LaterSourcePreparedState {
  readonly repositoryRoot: string;
  readonly outputCandidate: string;
  readonly requestSnapshot: unknown;
}

const RASTER_PURPOSES = new Set<RealBuildPrefix50Step44LaterSourceRasterPurpose>([
  "page45-camera-raster",
  "page45-contact-raster",
  "page45-review-artifact-raster",
  "page45-promotion-raster",
]);
export const REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT =
  "output/playwright/real-build-prefix50-step44-later-source-derived" as const;
const preparedOperations = new WeakMap<object, RealBuildPrefix50Step44LaterSourcePreparedState>();

export function requireRealBuildPrefix50Step44ExactKeys(
  value: object,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain only ${wanted.join(", ")}.`);
}

function snapshotUntrustedRequest(value: unknown): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError("request is not one object");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError("request has a custom prototype");
    if (Object.getOwnPropertySymbols(value).length !== 0)
      throw new TypeError("request has symbol keys");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).sort();
    if (keys.length < 1 || keys.length > 4) throw new TypeError("request key count is unbounded");
    const snapshot: Record<string, string | number | boolean> = {};
    for (const key of keys) {
      if (key.length < 1 || key.length > 64) throw new TypeError("request key is unbounded");
      const descriptor = descriptors[key]!;
      if (!("value" in descriptor)) throw new TypeError("request has an accessor");
      if (
        typeof descriptor.value !== "string" &&
        typeof descriptor.value !== "number" &&
        typeof descriptor.value !== "boolean"
      )
        throw new TypeError("request has a non-primitive field");
      if (
        (typeof descriptor.value === "string" && descriptor.value.length > 128) ||
        (typeof descriptor.value === "number" && !Number.isFinite(descriptor.value))
      )
        throw new TypeError("request field is unbounded or non-finite");
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return Object.freeze({ malformedRequest: true as const });
  }
}

function requireRequest(
  value: RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
): RealBuildPrefix50Step44LaterSourceDerivedOperationRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Later-source derivation requires one closed operation request.");
  if (value.kind === "raster-page") {
    requireRealBuildPrefix50Step44ExactKeys(
      value,
      ["densityDpi", "kind", "purpose", "retainDecodedBytes"],
      "Later-source raster request",
    );
    if (
      !RASTER_PURPOSES.has(value.purpose) ||
      !Number.isSafeInteger(value.densityDpi) ||
      value.densityDpi < 1 ||
      value.densityDpi > 600 ||
      typeof value.retainDecodedBytes !== "boolean"
    )
      throw new RangeError(
        "Later-source raster request requires one exact page-45 purpose, a 1..600 integer DPI, and one explicit retention decision.",
      );
    return value;
  }
  if (value.kind === "panel-prefix") {
    requireRealBuildPrefix50Step44ExactKeys(
      value,
      ["kind", "purpose"],
      "Later-source panel-prefix request",
    );
    if (value.purpose !== "page44-step43-vector" && value.purpose !== "page45-step44-vector")
      throw new TypeError("Later-source panel-prefix request requires one exact vector purpose.");
    return value;
  }
  throw new TypeError("Later-source derivation requires one closed operation request.");
}

export function prepareRealBuildPrefix50Step44LaterSourceDerivedOperation(input: {
  readonly repositoryRoot: string;
  readonly request: unknown;
}): RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation {
  requireRealBuildPrefix50Step44ExactKeys(
    input,
    ["repositoryRoot", "request"],
    "Later-source preparation input",
  );
  const repositoryRoot = realpathSync.native(resolve(input.repositoryRoot));
  const requestSnapshot = snapshotUntrustedRequest(input.request);
  const requestCommitment = canonicalDigest({ request: requestSnapshot });
  const outputScopeCommitment = canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-derived-output-scope/1",
    repositoryIdentityCommitment: canonicalDigest({ canonicalRepositoryRoot: repositoryRoot }),
    nonce: randomUUID(),
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-prepared-derived-operation/1" as const,
    requestCommitment,
    outputScopeCommitment,
  };
  const prepared = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  preparedOperations.set(
    prepared,
    Object.freeze({
      repositoryRoot,
      outputCandidate: `${REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT}/scope-${outputScopeCommitment.slice(7)}`,
      requestSnapshot,
    }),
  );
  return prepared;
}

export function stateForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(
  prepared: RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
): RealBuildPrefix50Step44LaterSourcePreparedState {
  const state = preparedOperations.get(prepared);
  if (
    state === undefined ||
    prepared.schemaVersion !== "lego.real-build-prefix50-step44-prepared-derived-operation/1"
  )
    throw new TypeError("Later-source derivation requires its exact opaque prepared operation.");
  return state;
}

export function requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(
  prepared: RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
): RealBuildPrefix50Step44LaterSourceDerivedOperationRequest {
  const state = stateForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(prepared);
  return requireRequest(
    state.requestSnapshot as RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
  );
}

export function physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(
  prepared: RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
): 44 | 45 {
  const request = requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(prepared);
  return request.kind === "panel-prefix" && request.purpose === "page44-step43-vector" ? 44 : 45;
}
