import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  FartherNarrowingBatchObservation,
  FartherNarrowingBatchOutcomeObservation,
  FartherNarrowingRenderObservation,
} from "./real-build-farther-step";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import {
  REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
  REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
} from "./real-build-production-policy";
import type { RealBuildPanelSpec } from "./real-build-safety";

export const STEP7_GATE3_PRODUCTION_NARROWING_LIMIT =
  REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET;
export const STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT = 32_768 as const;
export const STEP7_GATE3_CANDIDATE_LIMIT = REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET;
export const STEP7_GATE3_MAXIMUM_BATCHES = 4_096;

/** Runs during same-origin module initialization, outside Playwright's CSP-bypassing evaluator. */
export const STEP7_GATE3_MODULE_INITIALIZATION_EVAL_BLOCKED = (() => {
  try {
    Reflect.apply(globalThis.eval, globalThis, ["1"]);
    return false;
  } catch {
    return true;
  }
})();

const MAXIMUM_THROWN_MESSAGE_CHARACTERS = 512;
const NON_PRIMITIVE_THROWN_FALLBACK = "a thrown non-primitive value";
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_STRING_SLICE = String.prototype.slice;
const SAFE_NUMBER_TO_STRING = Number.prototype.toString;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_ERROR_CONSTRUCTOR = Error;
const SAFE_ERROR_IS_ERROR = (
  SAFE_ERROR_CONSTRUCTOR as ErrorConstructor & {
    readonly isError?: (value: unknown) => boolean;
  }
).isError;

const boundedThrownString = (value: string): string =>
  value.length <= MAXIMUM_THROWN_MESSAGE_CHARACTERS
    ? value
    : `${SAFE_REFLECT_APPLY(SAFE_STRING_SLICE, value, [
        0,
        MAXIMUM_THROWN_MESSAGE_CHARACTERS - 3,
      ])}...`;

const boundedNativeErrorMessage = (value: unknown): string | null => {
  if (SAFE_ERROR_IS_ERROR === undefined) return null;
  try {
    if (!SAFE_REFLECT_APPLY(SAFE_ERROR_IS_ERROR, SAFE_ERROR_CONSTRUCTOR, [value])) return null;
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, "message");
    const ownValue =
      descriptor === undefined
        ? undefined
        : SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(descriptor, "value");
    return ownValue !== undefined && typeof ownValue.value === "string"
      ? boundedThrownString(ownValue.value)
      : null;
  } catch {
    return null;
  }
};

export function describeBrowserThrown(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return boundedThrownString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return SAFE_REFLECT_APPLY(SAFE_NUMBER_TO_STRING, value, []);
  }
  if (typeof value === "bigint") return "a thrown bigint";
  if (typeof value === "symbol") return "a thrown symbol";
  const nativeErrorMessage = boundedNativeErrorMessage(value);
  if (nativeErrorMessage !== null) return nativeErrorMessage;
  return NON_PRIMITIVE_THROWN_FALLBACK;
}

type Step7Piece = Omit<RealBuildPanelSpec["pieces"][number], "expectedTransform">;

export type Step7Gate3Panel = Omit<RealBuildPanelSpec, "pieces" | "omittedPieces"> & {
  readonly pieces: readonly Step7Piece[];
  readonly omittedPieces: readonly [];
};

export interface Step7Gate3RuntimeOptions {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly latticeUrl: string;
  readonly renderingUrl: string;
  readonly kernelUrl: string;
  readonly commandsUrl: string;
  readonly assemblyUrl: string;
  readonly renderScale: number;
  readonly panelWidth: number;
  readonly workFactor: number;
  readonly proximityMarginPx: number;
  readonly minimumScoreMargin: number;
  readonly deferredCandidateBudget: typeof STEP7_GATE3_CANDIDATE_LIMIT;
  readonly deferredNarrowingRenderBudget: typeof STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT;
  readonly inputDigests: { readonly pdf: string };
}

export interface Step7Gate3Origin {
  readonly candidateId: string;
  readonly documentHash: string;
  readonly pieces: readonly FartherPlacementWitness[];
}

export interface Step7Gate3BrowserInput {
  readonly schemaVersion: "lego.step7-gate3-diagnostic-input/1";
  readonly observationMode: "current-migrated";
  readonly baseDocument: BrickDocumentV1;
  readonly baseDocumentHash: string;
  readonly origins: readonly Step7Gate3Origin[];
  readonly panel: Step7Gate3Panel;
  readonly options: Step7Gate3RuntimeOptions;
}

export interface ReservationObservation {
  readonly sourceParentCandidateId: string;
  readonly parentCandidateId: string;
  readonly reservedBefore: number;
  readonly requested: number;
  readonly reservedAfter: number;
  readonly accepted: boolean;
}

export interface RendererObservation {
  created: number;
  renderCalls: number;
  disposeCalls: number;
}

export interface ParentObservation {
  readonly sourceParentCandidateId: string;
  readonly parentCandidateId: string;
  readonly sourceDocumentHash: string;
  readonly reconstructedDocumentHash: string;
  readonly hashAfterRasterPreparation: string;
  readonly hashAfterExpansion: string;
  readonly narrowingRenders: number;
  readonly offeredPerPiece: readonly number[];
  readonly carriedPerPiece: readonly number[];
  readonly completeLeaves: readonly {
    readonly candidateId: string;
    readonly documentHash: string;
    readonly pieces: readonly FartherPlacementWitness[];
  }[];
  readonly renderer: Readonly<RendererObservation>;
  readonly candidateLedgerDelta: number;
}

export interface Step7Gate3BrowserResult {
  readonly schemaVersion: "lego.step7-gate3-diagnostic-browser-result/1";
  readonly status: "complete" | "failed";
  readonly fullWorkloadComplete: boolean;
  readonly productionFrontierAdmitted: false;
  readonly documentsPublished: false;
  readonly inputFrozen: boolean;
  readonly inputMutation: boolean;
  readonly browserInputDigestBefore: string | null;
  readonly browserInputDigestAfter: string | null;
  readonly inputDocumentFrozen: boolean;
  readonly inputDocumentMutation: boolean;
  readonly observationMode: Step7Gate3BrowserInput["observationMode"];
  readonly sourceBaseDocumentHash: string;
  readonly migrationReport: {
    readonly schemaVersion: string;
    readonly migrated: boolean;
    readonly fromCatalogVersion: string;
    readonly toCatalogVersion: string;
    readonly fromTruthHash: string;
    readonly toTruthHash: string;
    readonly addedColorIds: readonly string[];
    readonly addedCatalogPartIds: readonly string[];
    readonly catalogInterpretationChanges: readonly unknown[];
    readonly truthComponentChanges: readonly unknown[];
    readonly blockingReasons: readonly string[];
  } | null;
  readonly migrationPartsPreserved: boolean;
  readonly parentMigrations: readonly {
    readonly sourceParentCandidateId: string;
    readonly sourceDocumentHash: string;
    readonly sourceHashVerified: boolean;
    readonly parentCandidateId: string;
    readonly currentDocumentHash: string;
    readonly partsPreserved: boolean;
  }[];
  readonly productionNarrowingLimit: typeof STEP7_GATE3_PRODUCTION_NARROWING_LIMIT;
  readonly diagnosticNarrowingLimit: typeof STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT;
  readonly candidateLimit: typeof STEP7_GATE3_CANDIDATE_LIMIT;
  readonly orderedSourceParentIds: readonly string[];
  readonly orderedParentIds: readonly string[];
  readonly parentStarts: readonly {
    readonly sourceParentCandidateId: string;
    readonly parentCandidateId: string;
  }[];
  readonly parentTerminals: readonly {
    readonly sourceParentCandidateId: string;
    readonly parentCandidateId: string;
  }[];
  readonly parentAttempts: number;
  readonly panel: {
    readonly stepNumber: 7;
    readonly pageNumber: 13;
    readonly width: number;
    readonly height: number;
    readonly workPixelsDigest: string;
    readonly builtMaskDigest: string;
    readonly highlightMaskDigest: string;
    readonly highlightStrokeMaskDigest: string;
    readonly fit: unknown;
  } | null;
  readonly panelPng: string | null;
  readonly parents: readonly ParentObservation[];
  readonly batches: readonly FartherNarrowingBatchObservation[];
  readonly batchOutcomes: readonly FartherNarrowingBatchOutcomeObservation[];
  readonly renders: readonly FartherNarrowingRenderObservation[];
  readonly reservations: readonly ReservationObservation[];
  readonly sharedRenderDemand: number;
  readonly candidateDemand: number;
  readonly narrowingRefused: boolean;
  readonly candidateRefused: boolean;
  readonly production8192ShadowRefusal: {
    readonly sourceParentCandidateId: string;
    readonly parentCandidateId: string;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly budget: typeof STEP7_GATE3_PRODUCTION_NARROWING_LIMIT;
  } | null;
  readonly cleanupFailures: readonly string[];
  readonly failure: string | null;
}

const exactKeys = (value: object, keys: readonly string[], label: string): void => {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(
      `${label} keys are [${actual.join(", ")}]; required [${expected.join(", ")}].`,
    );
  }
};

export function assertInputProjection(input: Step7Gate3BrowserInput): void {
  exactKeys(
    input,
    [
      "schemaVersion",
      "observationMode",
      "baseDocument",
      "baseDocumentHash",
      "origins",
      "panel",
      "options",
    ],
    "Step-7 diagnostic input",
  );
  exactKeys(
    input.options,
    [
      "pdfjsUrl",
      "workerUrl",
      "pdfUrl",
      "latticeUrl",
      "renderingUrl",
      "kernelUrl",
      "commandsUrl",
      "assemblyUrl",
      "renderScale",
      "panelWidth",
      "workFactor",
      "proximityMarginPx",
      "minimumScoreMargin",
      "deferredCandidateBudget",
      "deferredNarrowingRenderBudget",
      "inputDigests",
    ],
    "Step-7 diagnostic runtime options",
  );
  exactKeys(
    input.panel,
    [
      "stepNumber",
      "pageNumber",
      "panelFace",
      "minXPt",
      "maxXPt",
      "minYPt",
      "maxYPt",
      "calloutBoxes",
      "mappedCalloutKeys",
      "pieces",
      "omittedPieces",
      "calloutPieces",
      "classifiedPhysicalCalloutPieces",
      "semanticMultiplierQuantity",
      "omittedPhysicalPieces",
      "action",
      "coverageFailures",
      "missingDesigns",
      "unresolvedCallouts",
    ],
    "Step-7 diagnostic panel",
  );
  exactKeys(
    input.panel.action,
    ["kind", "assembledPieces", "evidenceDigest"],
    "Step-7 diagnostic action",
  );
  if (
    input.schemaVersion !== "lego.step7-gate3-diagnostic-input/1" ||
    input.observationMode !== "current-migrated" ||
    input.origins.length !== 4 ||
    input.panel.stepNumber !== 7 ||
    input.panel.pageNumber !== 13 ||
    input.panel.panelFace !== "underside" ||
    input.panel.pieces.length !== 4 ||
    input.panel.omittedPieces.length !== 0 ||
    input.panel.action.kind !== "place-callouts" ||
    input.panel.action.assembledPieces !== 4 ||
    input.options.deferredCandidateBudget !== STEP7_GATE3_CANDIDATE_LIMIT ||
    input.options.deferredNarrowingRenderBudget !== STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT
  ) {
    throw new TypeError(
      "Step-7 diagnostic input does not describe the exact four-parent bounded control.",
    );
  }
  for (const [index, piece] of input.panel.pieces.entries()) {
    exactKeys(
      piece,
      [
        "identityKey",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
        "calloutKey",
        "identificationConfidence",
        "cropDigest",
        "identificationInputDigest",
      ],
      `Step-7 diagnostic panel piece ${index}`,
    );
    if (Object.hasOwn(piece, "expectedTransform")) {
      throw new TypeError(`Step-7 diagnostic panel piece ${index} leaked expectedTransform.`);
    }
  }
  for (const [originIndex, origin] of input.origins.entries()) {
    exactKeys(
      origin,
      ["candidateId", "documentHash", "pieces"],
      `Step-7 diagnostic origin ${originIndex}`,
    );
    if (origin.candidateId !== `step-006:${origin.documentHash}` || origin.pieces.length !== 4) {
      throw new TypeError(`Step-7 diagnostic origin ${originIndex} has inconsistent identity.`);
    }
    for (const [pieceIndex, piece] of origin.pieces.entries()) {
      exactKeys(
        piece,
        ["catalogPartId", "colorId", "transform"],
        `Step-7 diagnostic origin ${originIndex} piece ${pieceIndex}`,
      );
      exactKeys(
        piece.transform,
        ["positionLdu", "orientationId"],
        `Step-7 diagnostic origin ${originIndex} piece ${pieceIndex} transform`,
      );
    }
  }
}

export function freezeDataOnlyGraph(value: unknown, seen = new WeakSet<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  const object = value as object;
  if (seen.has(object)) return;
  seen.add(object);
  const descriptors = Object.getOwnPropertyDescriptors(object);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) {
      throw new TypeError(`Step-7 diagnostic input data property ${key} is an accessor.`);
    }
    freezeDataOnlyGraph(descriptor.value, seen);
  }
  Object.freeze(object);
}

export async function sha256Utf8(value: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
