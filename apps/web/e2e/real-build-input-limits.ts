import { INSTRUCTION_PDF_LIMITS } from "../src/instructions/instruction-source";
import {
  MAX_CARD_IMAGE_BUNDLE_BYTES,
  PART_CARD_IMAGES_SCHEMA,
} from "../../../scripts/part-identification-card-images.mjs";

const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;

export const HIGHLIGHT_COMPATIBILITY_INPUT_CLOSURE_SCHEMA =
  "lego.highlight-exclusivity-input-closure/1" as const;
export const BUILDER_GEOMETRY_EXACT_BYTES = 1_091_772;
export const CALIBRATION_JSON_MAXIMUM_BYTES = 64 * KIBIBYTE;
export const HIGHLIGHT_RENDER_CASES_MAXIMUM_BYTES = 2 * MEBIBYTE;
export const OFFICIAL_MODEL_MAXIMUM_BYTES = 8 * MEBIBYTE;
export const CALLOUT_CROP_MAXIMUM_BYTES = 8 * MEBIBYTE;
export const IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES = MAX_CARD_IMAGE_BUNDLE_BYTES;

function base64Length(bytes: number): number {
  return 4 * Math.ceil(bytes / 3);
}

function highlightClosureScaffoldLength(renderCasesBytes: number, summaryBytes: number): number {
  return Buffer.byteLength(
    `${JSON.stringify({
      schemaVersion: HIGHLIGHT_COMPATIBILITY_INPUT_CLOSURE_SCHEMA,
      renderCases: {
        digest: `sha256:${"0".repeat(64)}`,
        byteLength: renderCasesBytes,
        base64: "",
      },
      summary: {
        digest: `sha256:${"0".repeat(64)}`,
        byteLength: summaryBytes,
        base64: "",
      },
    })}\n`,
  );
}

export const HIGHLIGHT_COMPATIBILITY_ROLE_MINIMUM_BYTES = highlightClosureScaffoldLength(0, 0);
export const HIGHLIGHT_COMPATIBILITY_ROLE_MAXIMUM_BYTES =
  highlightClosureScaffoldLength(
    HIGHLIGHT_RENDER_CASES_MAXIMUM_BYTES,
    CALIBRATION_JSON_MAXIMUM_BYTES,
  ) +
  base64Length(HIGHLIGHT_RENDER_CASES_MAXIMUM_BYTES) +
  base64Length(CALIBRATION_JSON_MAXIMUM_BYTES);
export const IDENTIFICATION_CARD_IMAGES_MINIMUM_BYTES =
  Buffer.byteLength(`${PART_CARD_IMAGES_SCHEMA}\n`) + 4;

export interface RawReplayRoleBytePolicy {
  readonly minimumNonEmptyBytes: number;
  readonly maximumBytes: number;
  readonly exactBytes?: number;
  readonly allowEmpty?: boolean;
}

/** The retained raw roles use the same byte policy as their live input boundary. */
export const REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES = {
  pdf: { minimumNonEmptyBytes: 1, maximumBytes: INSTRUCTION_PDF_LIMITS.maxBytes, allowEmpty: true },
  "callout-manifest": { minimumNonEmptyBytes: 1, maximumBytes: 8 * MEBIBYTE, allowEmpty: true },
  coverage: { minimumNonEmptyBytes: 1, maximumBytes: 8 * MEBIBYTE, allowEmpty: true },
  "official-model": {
    minimumNonEmptyBytes: 1,
    maximumBytes: OFFICIAL_MODEL_MAXIMUM_BYTES,
    allowEmpty: true,
  },
  "action-ledger": { minimumNonEmptyBytes: 1, maximumBytes: 16 * MEBIBYTE, allowEmpty: true },
  "highlight-calibration": {
    minimumNonEmptyBytes: HIGHLIGHT_COMPATIBILITY_ROLE_MINIMUM_BYTES,
    maximumBytes: HIGHLIGHT_COMPATIBILITY_ROLE_MAXIMUM_BYTES,
  },
  "builder-calibration": {
    minimumNonEmptyBytes: 1,
    maximumBytes: CALIBRATION_JSON_MAXIMUM_BYTES,
    allowEmpty: true,
  },
  "builder-geometry": {
    minimumNonEmptyBytes: BUILDER_GEOMETRY_EXACT_BYTES,
    maximumBytes: BUILDER_GEOMETRY_EXACT_BYTES,
    exactBytes: BUILDER_GEOMETRY_EXACT_BYTES,
    allowEmpty: true,
  },
  "transition-classifications": {
    minimumNonEmptyBytes: 1,
    maximumBytes: 8 * MEBIBYTE,
    allowEmpty: true,
  },
  "identification-features": {
    minimumNonEmptyBytes: 1,
    maximumBytes: 32 * MEBIBYTE,
    allowEmpty: true,
  },
  "identification-match": { minimumNonEmptyBytes: 1, maximumBytes: 8 * MEBIBYTE, allowEmpty: true },
  "identification-distances": {
    minimumNonEmptyBytes: 1,
    maximumBytes: 16 * MEBIBYTE,
    allowEmpty: true,
  },
  "element-resolution": { minimumNonEmptyBytes: 1, maximumBytes: 4 * MEBIBYTE, allowEmpty: true },
  // Tracked in Git, so its ceiling is the repository blob-review threshold
  // rather than a generous output-artifact bound: a verdict file that grew past
  // 256 KiB would need the review AGENTS.md requires before it could be a
  // repository input at all.
  "pair-judged-truth": {
    minimumNonEmptyBytes: 1,
    maximumBytes: 256 * KIBIBYTE,
    allowEmpty: true,
  },
  "identification-cards": { minimumNonEmptyBytes: 1, maximumBytes: 2 * MEBIBYTE, allowEmpty: true },
  "identification-card-images": {
    minimumNonEmptyBytes: IDENTIFICATION_CARD_IMAGES_MINIMUM_BYTES,
    maximumBytes: IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES,
    allowEmpty: true,
  },
  "identification-answers": {
    minimumNonEmptyBytes: 1,
    maximumBytes: 256 * KIBIBYTE,
    allowEmpty: true,
  },
} as const satisfies Readonly<Record<string, RawReplayRoleBytePolicy>>;
