import { createHash } from "node:crypto";

import { PART_IDENTIFICATION_MODEL_ID } from "../../../scripts/part-identification-model.mjs";
import { PART_TRUTH_PATH } from "../../../scripts/part-identification-truth-key.mjs";
import { BoundedFileReadError, readContainedBoundedRegularFile } from "./bounded-file-read";
import {
  verifyHighlightExclusivityCompatibility,
  type HighlightExclusivityCompatibility,
} from "./real-build-highlight-compatibility";
import type {
  RawJsonArtifact,
  RealBuildIdentificationSource,
} from "./real-build-identification-closure";
import type { TransitionClassificationEvidence } from "./real-build-ledger";
import type { CoverageCalloutClaim, StepFailure } from "./real-build-safety";
import {
  BUILDER_GEOMETRY_EXACT_BYTES,
  CALIBRATION_JSON_MAXIMUM_BYTES,
  CALLOUT_CROP_MAXIMUM_BYTES,
  HIGHLIGHT_COMPATIBILITY_INPUT_CLOSURE_SCHEMA,
  HIGHLIGHT_RENDER_CASES_MAXIMUM_BYTES,
  IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES,
  OFFICIAL_MODEL_MAXIMUM_BYTES,
  REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES,
} from "./real-build-input-limits";

export {
  BUILDER_GEOMETRY_EXACT_BYTES,
  CALIBRATION_JSON_MAXIMUM_BYTES,
  CALLOUT_CROP_MAXIMUM_BYTES,
  IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES,
  OFFICIAL_MODEL_MAXIMUM_BYTES,
} from "./real-build-input-limits";

export const COVERAGE_PATH =
  process.env.LEGO_REAL_BUILD_COVERAGE ?? "output/real-build/catalog-coverage.json";
export const MANIFEST_PATH =
  process.env.LEGO_REAL_BUILD_MANIFEST ?? "output/callout-thumbnails/manifest.json";
export const IDENTIFICATION_FEATURES_PATH =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_FEATURES ?? "output/part-identification/features.json";
export const IDENTIFICATION_MATCH_PATH =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_MATCH ?? "output/part-identification/match.json";
export const IDENTIFICATION_DISTANCES_PATH =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_DISTANCES ??
  "output/part-identification/distances.json";
export const IDENTIFICATION_CARDS_PATH =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARDS ??
  "output/part-identification/cards/manifest.json";
/**
 * The card-images bundle is named by the cards manifest, not by convention.
 *
 * `part-identification cards` writes each publication into its own immutable
 * `runs/<24-hex>/` directory and records the bundle it wrote as `imagesFile`.
 * A fixed sibling path is therefore a second copy of a fact the manifest
 * already carries, and a copy that no producer maintains: one left over from an
 * earlier generation reads as current and binds a superseded card set to a
 * fresh manifest. Only an explicit override may name the file directly.
 */
export const IDENTIFICATION_CARD_IMAGES_PATH_OVERRIDE =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES ?? null;

/** Run-relative bundle the cards manifest is allowed to name, and nothing else. */
const CARD_IMAGES_RUN_FILE = /^runs\/[0-9a-f]{24}\/images\.bin$/u;

export function resolveCardImagesPath(cards: unknown, failures: StepFailure[]): string | null {
  if (IDENTIFICATION_CARD_IMAGES_PATH_OVERRIDE !== null) {
    return IDENTIFICATION_CARD_IMAGES_PATH_OVERRIDE;
  }
  const named = (cards as { readonly imagesFile?: unknown } | null)?.imagesFile;
  if (typeof named !== "string" || !CARD_IMAGES_RUN_FILE.test(named)) {
    failures.push({
      code: "input-digest-mismatch",
      stage: "input",
      inputKey: "identificationCardImages",
      message:
        `The cards manifest at ${IDENTIFICATION_CARDS_PATH} names its image bundle as ` +
        `${JSON.stringify(named ?? "missing")}, which is not a run-relative ` +
        `"runs/<24 lowercase hex>/images.bin". The bundle is read from the manifest so a leftover ` +
        `sibling copy cannot bind a superseded card set; republish the cards run, or set ` +
        `LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES to name the exact bundle deliberately.`,
    });
    return null;
  }
  return `${IDENTIFICATION_CARDS_PATH.replace(/\/manifest\.json$/u, "")}/${named}`;
}
export const IDENTIFICATION_ANSWERS_PATH =
  process.env.LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS ??
  `output/part-identification/answers-${PART_IDENTIFICATION_MODEL_ID}.json`;
export const ELEMENT_RESOLUTION_PATH =
  process.env.LEGO_REAL_BUILD_ELEMENT_RESOLUTION ??
  "output/part-identification/element-resolution.json";
/**
 * The blind pair-judging verdicts, tracked in Git rather than under `output/`.
 *
 * Every other identification role is regenerable from the booklet; this one is
 * not. It is two full blind judging passes over pictures, and it is the evidence
 * behind every `pair-judged-same` identity the run places.
 */
export const PAIR_JUDGED_TRUTH_PATH =
  process.env.LEGO_REAL_BUILD_PAIR_JUDGED_TRUTH ?? PART_TRUTH_PATH;
export const SOURCE_ART_REBOUND_PATH =
  process.env.LEGO_REAL_BUILD_SOURCE_ART_REBOUND ??
  "output/part-identification/source-art-rebound.json";
export const HIGHLIGHT_RENDERER_COMPATIBILITY_PATH =
  process.env.LEGO_REAL_BUILD_HIGHLIGHT_RENDERER_COMPATIBILITY ??
  "output/real-build/highlight-renderer-compatibility.json";
export const HIGHLIGHT_RENDERER_CASES_PATH =
  process.env.LEGO_REAL_BUILD_HIGHLIGHT_RENDERER_COMPATIBILITY_CASES ??
  "output/real-build/highlight-renderer-compatibility-cases.json";
export const OFFICIAL_MODEL_PATH =
  process.env.LEGO_REAL_BUILD_OFFICIAL_MODEL ?? "output/official-model/vx1087034_21066_a.xml";
export const ACTION_LEDGER_PATH =
  process.env.LEGO_REAL_BUILD_ACTION_LEDGER ?? "output/real-build/action-ledger.json";
export const BUILDER_CALIBRATION_PATH =
  process.env.LEGO_REAL_BUILD_BUILDER_CALIBRATION ??
  "output/real-build/builder-canonical-calibration.json";
export const BUILDER_GEOMETRY_PATH =
  process.env.LEGO_REAL_BUILD_BUILDER_GEOMETRY ?? "output/real-build/builder-shell-geometry.bin";
export const TRANSITION_CLASSIFICATIONS_PATH =
  process.env.LEGO_REAL_BUILD_TRANSITIONS ?? "output/real-build/transition-classifications.json";

const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;

const sha256 = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

interface InputSizePolicy {
  readonly description: string;
  readonly exactBytes?: number;
  readonly maximumBytes?: number;
}

const jsonInputPolicies = (): readonly (InputSizePolicy & { readonly path: string })[] => [
  {
    path: HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
    description: "highlight renderer-compatibility JSON",
    maximumBytes: CALIBRATION_JSON_MAXIMUM_BYTES,
  },
  {
    path: HIGHLIGHT_RENDERER_CASES_PATH,
    description: "raw highlight renderer-compatibility case JSON",
    maximumBytes: HIGHLIGHT_RENDER_CASES_MAXIMUM_BYTES,
  },
  {
    path: BUILDER_CALIBRATION_PATH,
    description: "Builder canonical calibration JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["builder-calibration"].maximumBytes,
  },
  {
    path: IDENTIFICATION_ANSWERS_PATH,
    description: "bounded model-answer JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["identification-answers"].maximumBytes,
  },
  {
    path: IDENTIFICATION_CARDS_PATH,
    description: "identification-card manifest JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["identification-cards"].maximumBytes,
  },
  {
    path: ELEMENT_RESOLUTION_PATH,
    description: "element-resolution JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["element-resolution"].maximumBytes,
  },
  {
    path: PAIR_JUDGED_TRUTH_PATH,
    description: "blind pair-judging verdict JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["pair-judged-truth"].maximumBytes,
  },
  {
    path: SOURCE_ART_REBOUND_PATH,
    description: "source-art rebound JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["source-art-rebound"].maximumBytes,
  },
  {
    path: COVERAGE_PATH,
    description: "catalog-coverage JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES.coverage.maximumBytes,
  },
  {
    path: MANIFEST_PATH,
    description: "callout manifest JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["callout-manifest"].maximumBytes,
  },
  {
    path: IDENTIFICATION_MATCH_PATH,
    description: "identification-match JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["identification-match"].maximumBytes,
  },
  {
    path: TRANSITION_CLASSIFICATIONS_PATH,
    description: "transition-classification JSON",
    maximumBytes:
      REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["transition-classifications"].maximumBytes,
  },
  {
    path: IDENTIFICATION_DISTANCES_PATH,
    description: "identification-distance JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["identification-distances"].maximumBytes,
  },
  {
    path: ACTION_LEDGER_PATH,
    description: "359-step action-ledger JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["action-ledger"].maximumBytes,
  },
  {
    path: IDENTIFICATION_FEATURES_PATH,
    description: "booklet identification-feature JSON",
    maximumBytes: REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES["identification-features"].maximumBytes,
  },
];

function jsonInputPolicy(path: string): InputSizePolicy {
  const matches = jsonInputPolicies().filter((policy) => policy.path === path);
  if (matches.length === 0) {
    return {
      description: "unclassified real-build JSON",
      maximumBytes: 32 * MEBIBYTE,
    };
  }
  return matches.reduce((strictest, candidate) =>
    candidate.maximumBytes! < strictest.maximumBytes! ? candidate : strictest,
  );
}

function binaryInputPolicy(path: string): InputSizePolicy {
  if (path === IDENTIFICATION_CARD_IMAGES_PATH_OVERRIDE || /\/images\.bin$/u.test(path)) {
    return {
      description: "identification-card image replay bundle",
      maximumBytes: IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES,
    };
  }
  if (path === BUILDER_GEOMETRY_PATH) {
    return {
      description: "Builder shell-geometry bundle",
      exactBytes: BUILDER_GEOMETRY_EXACT_BYTES,
    };
  }
  if (path === OFFICIAL_MODEL_PATH) {
    return {
      description: "official Builder XML",
      maximumBytes: OFFICIAL_MODEL_MAXIMUM_BYTES,
    };
  }
  return {
    description: "unclassified real-build binary input",
    maximumBytes: 32 * MEBIBYTE,
  };
}

export interface CalloutManifest {
  readonly schemaVersion?: string;
  readonly sourceHash?: string;
  readonly calloutCount?: number;
  readonly callouts?: readonly unknown[];
}

export interface CalloutResolution extends CoverageCalloutClaim {
  readonly stepNumber: number | null;
  readonly elementId: string | null;
  readonly resolution: {
    readonly catalogPartId: string | null;
    readonly colorId: string;
    readonly partNum: string;
    readonly name: string;
  } | null;
}

export interface HighlightRendererCompatibilityInput {
  readonly schemaVersion?: string;
  readonly renderCasesDigest?: string;
  readonly policyMinimumExclusiveHighlightPixelsPerPiece?: number;
}

export interface TransitionClassificationBundle {
  readonly schemaVersion?: string;
  readonly pdfDigest?: string;
  readonly entries?: readonly TransitionClassificationEvidence[];
}

export const contractFailure = (inputKey: string, message: string): StepFailure => ({
  code: "input-digest-mismatch",
  stage: "input",
  inputKey,
  message,
});

function readSizedInput(
  root: string,
  path: string,
  failures: StepFailure[],
  policy: InputSizePolicy,
): Buffer {
  try {
    const maximumBytes = policy.exactBytes ?? policy.maximumBytes;
    if (maximumBytes === undefined) {
      throw new TypeError(`${policy.description} has no maximum or exact byte bound.`);
    }
    return readContainedBoundedRegularFile(root, path, {
      label: policy.description,
      minimumBytes: 0,
      maximumBytes,
      ...(policy.exactBytes === undefined ? {} : { exactBytes: policy.exactBytes }),
    });
  } catch (error) {
    if (error instanceof BoundedFileReadError && error.code === "PATH_POLICY_VIOLATION") {
      failures.push({
        code: "path-policy-violation",
        stage: "input",
        inputKey: path,
        message: `Required real-build input path is missing, escaped, linked, or changed during access: ${error.message}`,
      });
      return Buffer.alloc(0);
    }
    failures.push(
      contractFailure(
        path,
        `Required real-build input ${path} failed its bounded same-handle read: ` +
          `${error instanceof Error ? error.message : String(error)} Regenerate the declared input ` +
          `instead of raising or bypassing its byte policy.`,
      ),
    );
    return Buffer.alloc(0);
  }
}

export function readJsonInput<T>(
  path: string,
  failures: StepFailure[],
): { bytes: Buffer; value: T } {
  const failureCountBeforeRead = failures.length;
  const bytes = readSizedInput(process.cwd(), path, failures, jsonInputPolicy(path));
  if (failures.length > failureCountBeforeRead) return { bytes, value: {} as T };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { bytes, value: JSON.parse(text) as T };
  } catch (error) {
    failures.push(
      contractFailure(
        path,
        `Required real-build input ${path} is not valid JSON: ${String(error)}.`,
      ),
    );
    return { bytes, value: {} as T };
  }
}

/** Constructs every artifact field from the same bounded byte buffer. */
export function readJsonArtifact<T>(
  path: string,
  failures: StepFailure[],
): RawJsonArtifact & {
  readonly value: T;
} {
  const input = readJsonInput<T>(path, failures);
  return { bytes: input.bytes, digest: sha256(input.bytes), value: input.value };
}

/** Opens adjudication artifacts only when the bounded coverage mode requires them. */
export function readIdentificationAdjudicationInputs(
  source: RealBuildIdentificationSource | null,
  failures: StepFailure[],
): {
  readonly cards: RawJsonArtifact | null;
  readonly cardImages: { readonly bytes: Uint8Array; readonly digest: string } | null;
  readonly answers: RawJsonArtifact | null;
} {
  if (source !== "adjudicated") return { cards: null, cardImages: null, answers: null };
  const cards = readJsonArtifact<unknown>(IDENTIFICATION_CARDS_PATH, failures);
  const imagesPath = resolveCardImagesPath(cards.value, failures);
  const cardImageBytes =
    imagesPath === null ? Buffer.alloc(0) : readBinaryInput(imagesPath, failures);
  return {
    cards,
    cardImages: { bytes: cardImageBytes, digest: sha256(cardImageBytes) },
    answers: readJsonArtifact<unknown>(IDENTIFICATION_ANSWERS_PATH, failures),
  };
}

/**
 * Retains both exact compatibility roles behind the existing run-contract field name.
 * The field is renderer/source compatibility evidence, not a calibrated policy or PDF provenance claim.
 */
export function encodeHighlightRendererCompatibilityInputClosure(
  renderCasesBytes: Uint8Array,
  summaryBytes: Uint8Array,
): Buffer {
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: HIGHLIGHT_COMPATIBILITY_INPUT_CLOSURE_SCHEMA,
      renderCases: {
        digest: sha256(renderCasesBytes),
        byteLength: renderCasesBytes.length,
        base64: Buffer.from(renderCasesBytes).toString("base64"),
      },
      summary: {
        digest: sha256(summaryBytes),
        byteLength: summaryBytes.length,
        base64: Buffer.from(summaryBytes).toString("base64"),
      },
    })}\n`,
  );
}

export function verifyHighlightRendererCompatibilityInput(input: {
  readonly renderCasesBytes: Uint8Array;
  readonly summaryBytes: Uint8Array;
}): {
  readonly roleBytes: Buffer;
  readonly roleDigest: string;
  readonly summary: HighlightExclusivityCompatibility;
} {
  const summary = verifyHighlightExclusivityCompatibility({
    renderCasesBytes: input.renderCasesBytes,
    summaryBytes: input.summaryBytes,
    expectedRenderCasesDigest: sha256(input.renderCasesBytes),
    expectedCompatibilityDigest: sha256(input.summaryBytes),
  });
  const roleBytes = encodeHighlightRendererCompatibilityInputClosure(
    input.renderCasesBytes,
    input.summaryBytes,
  );
  return { roleBytes, roleDigest: sha256(roleBytes), summary };
}

/** Exact byte equality proves only that the materialized source renderer reproduced the retained cases. */
export function assertHighlightRendererCasesReproduced(
  retainedRenderCasesBytes: Uint8Array,
  reproducedRenderCasesBytes: Uint8Array,
): void {
  if (!Buffer.from(retainedRenderCasesBytes).equals(Buffer.from(reproducedRenderCasesBytes))) {
    throw new TypeError(
      `The materialized source-mirror renderer did not reproduce the retained highlight case bytes. ` +
        `This is a renderer/source compatibility failure; neither matching nor mismatching masks ` +
        `authenticate the instruction PDF, the original source checkout, or visual correctness.`,
    );
  }
}

export function readBinaryInput(path: string, failures: StepFailure[]): Buffer {
  return readSizedInput(process.cwd(), path, failures, binaryInputPolicy(path));
}

/** Reads one manifest-controlled crop with containment and open bound in the same operation. */
export function readCalloutCropInput(
  root: string,
  candidate: string,
  manifestPath = candidate,
): Buffer {
  return readContainedBoundedRegularFile(root, candidate, {
    label: `Manifest callout crop ${manifestPath}`,
    maximumBytes: CALLOUT_CROP_MAXIMUM_BYTES,
  });
}
