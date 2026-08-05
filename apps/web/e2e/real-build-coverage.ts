import type { StepFailure } from "./real-build-safety";
import { evidenceContract, stableIdentity } from "./callout-analysis";
import {
  TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE,
  isTrustedIdentificationConfidence,
} from "./real-build-identification-trust";

export type CoverageContractFailureCode =
  | "coverage-key-missing"
  | "coverage-key-mismatch"
  | "coverage-page-mismatch"
  | "coverage-quantity-mismatch";

export class CoverageContractError extends Error {
  readonly code: CoverageContractFailureCode;
  readonly key: string;

  constructor(code: CoverageContractFailureCode, key: string, message: string) {
    super(message);
    this.name = "CoverageContractError";
    this.code = code;
    this.key = key;
  }
}

export interface CoverageInputBindings {
  readonly pdf: string | null;
  readonly calloutManifest: string | null;
}

export interface CoverageCalloutClaim {
  readonly identity?: string;
  readonly pageNumber: number;
  readonly quantity: number;
  readonly identificationConfidence?: string | null;
  readonly cropDigest?: string | null;
  readonly inputDigest?: string | null;
}

export function requireCoverageIndex<T extends CoverageCalloutClaim>(
  value: unknown,
): Readonly<Record<string, T>> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Readonly<Record<string, T>>;
  }
  throw new CoverageContractError(
    "coverage-key-missing",
    "byCallout",
    "Catalog coverage has no object-valued byCallout index. Regenerate it before rebuilding.",
  );
}

const STABLE_CALLOUT_IDENTITY = /^p(\d+)\|q(\d+)\|x-?\d+\.\d{3}\|y-?\d+\.\d{3}$/u;

/** Stable content identity emitted by the v4 callout producer and retained by coverage. */
export function coverageCalloutKey(identity: string): string {
  if (!STABLE_CALLOUT_IDENTITY.test(identity)) {
    throw new CoverageContractError(
      "coverage-key-mismatch",
      identity,
      `Callout identity ${JSON.stringify(identity)} is not the v4 p{page}|q{quantity}|x{x}|y{y} stable identity. ` +
        `Regenerate coverage from the exact current callout manifest; legacy page-index file names are not evidence.`,
    );
  }
  return identity;
}

export function requireCoverageCallout<T extends CoverageCalloutClaim>(
  byCallout: Readonly<Record<string, T>>,
  input: { readonly identity: string; readonly pageNumber: number; readonly quantity: number },
): T {
  const key = coverageCalloutKey(input.identity);
  const identityMatch = STABLE_CALLOUT_IDENTITY.exec(key)!;
  if (
    Number(identityMatch[1]) !== input.pageNumber ||
    Number(identityMatch[2]) !== input.quantity
  ) {
    throw new CoverageContractError(
      "coverage-key-mismatch",
      key,
      `Callout identity ${key} encodes page ${identityMatch[1]} and quantity ${identityMatch[2]}, but its ` +
        `manifest record declares page ${input.pageNumber} and quantity ${input.quantity}.`,
    );
  }
  const claim = byCallout[key];
  if (claim === undefined) {
    throw new CoverageContractError(
      "coverage-key-missing",
      key,
      `Coverage has no stable-identity claim for ${key}. Regenerate catalog coverage from the same v4 ` +
        `callout manifest before rebuilding; array order and legacy p{page}-c{index}.png names cannot be aliased.`,
    );
  }
  if (claim.identity !== undefined && claim.identity !== key) {
    throw new CoverageContractError(
      "coverage-key-mismatch",
      key,
      `Coverage key ${key} contains a claim for identity ${JSON.stringify(claim.identity)}. ` +
        `Regenerate the index instead of moving a claim between identities.`,
    );
  }
  if (claim.pageNumber !== input.pageNumber) {
    throw new CoverageContractError(
      "coverage-page-mismatch",
      key,
      `Coverage claim ${key} says page ${claim.pageNumber}, but its callout crop is on page ${input.pageNumber}.`,
    );
  }
  if (claim.quantity !== input.quantity) {
    throw new CoverageContractError(
      "coverage-quantity-mismatch",
      key,
      `Coverage claim ${key} says quantity ${claim.quantity}, but the freshly cut callout says ${input.quantity}.`,
    );
  }
  return claim;
}

export function resolveCoverageCallout<T extends CoverageCalloutClaim>(
  byCallout: Readonly<Record<string, T>>,
  input: {
    readonly identity: string;
    readonly pageNumber: number;
    readonly stepNumber?: number;
    readonly quantity: number;
    readonly cropDigest?: string | null;
    readonly identificationInputDigest?: string | null;
  },
): { readonly claim: T | null; readonly failure: StepFailure | null } {
  const key = input.identity;
  let claim: T;
  try {
    claim = requireCoverageCallout(byCallout, input);
  } catch (error) {
    return {
      claim: null,
      failure: {
        code: "coverage-key-mismatch",
        stage: "coverage",
        inputKey: key,
        message:
          error instanceof CoverageContractError
            ? error.message
            : `Coverage lookup for ${key} failed with an unexpected contract error: ${String(error)}.`,
      },
    };
  }
  if (
    input.stepNumber !== undefined &&
    "stepNumber" in claim &&
    claim.stepNumber !== input.stepNumber
  ) {
    return {
      claim: null,
      failure: {
        code: "coverage-key-mismatch",
        stage: "coverage",
        inputKey: key,
        message:
          `Callout ${key} is assigned by retained coverage to printed step ` +
          `${JSON.stringify(claim.stepNumber)}, but the manifest maps it to step ${input.stepNumber}. ` +
          `Regenerate or reconcile the content-bound panel assignment before reconstruction.`,
      },
    };
  }
  if (!isTrustedIdentificationConfidence(claim.identificationConfidence)) {
    return {
      claim: null,
      failure: {
        code: "untrusted-identification",
        stage: "callout-resolution",
        inputKey: key,
        message:
          `Callout ${key} has identification confidence ` +
          `${JSON.stringify(claim.identificationConfidence ?? "missing")}; only ` +
          `${TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE} claims are trusted. Self-contradicted, refused, ` +
          `unanswered, unlabelled, and pair-judged-different assignments remain retained failures — a callout ` +
          `nobody judged stays untrusted, and one judged to be a different part stays refused.`,
      },
    };
  }
  const digestPairs = [
    ["crop", input.cropDigest, claim.cropDigest],
    ["identification input", input.identificationInputDigest, claim.inputDigest],
  ] as const;
  for (const [label, expected, actual] of digestPairs) {
    if (expected !== undefined && expected !== null && actual !== expected) {
      return {
        claim: null,
        failure: {
          code: "input-digest-mismatch",
          stage: "coverage",
          inputKey: key,
          message:
            `Callout ${key} ${label} digest is ${JSON.stringify(actual ?? "missing")}, but this run reads ` +
            `${expected}. Regenerate identification and coverage from the exact retained crop/input.`,
        },
      };
    }
  }
  return { claim, failure: null };
}

export interface StepCoverageCalloutClaim extends CoverageCalloutClaim {
  readonly stepNumber: number | null;
}

export interface V4ManifestCallout {
  readonly identity: string;
  readonly file: string;
  readonly pageNumber: number;
  readonly stepNumber: number | null;
  readonly quantity: number;
  readonly evidenceKind: string;
  readonly sha256: string;
  readonly cropDigest?: string;
  readonly physicalQuantity?: number;
  readonly semanticMultiplierQuantity?: number;
  readonly omittedPhysicalPieces?: number;
}

export function isV4ManifestCallout(value: unknown): value is V4ManifestCallout {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<V4ManifestCallout>;
  return (
    typeof entry.identity === "string" &&
    typeof entry.file === "string" &&
    Number.isInteger(entry.pageNumber) &&
    (entry.stepNumber === null || Number.isInteger(entry.stepNumber)) &&
    Number.isInteger(entry.quantity) &&
    typeof entry.evidenceKind === "string" &&
    typeof entry.sha256 === "string"
  );
}

interface BookletPanelBindingInput {
  readonly lastStep: number;
  readonly manifestCallouts: readonly V4ManifestCallout[];
  readonly panels: readonly {
    readonly stepNumber: number;
    readonly pageNumber: number;
    readonly bounds: {
      readonly minXPt: number;
      readonly maxXPt: number;
      readonly minYPt: number;
      readonly maxYPt: number;
    };
  }[];
  readonly sourcePages: readonly {
    readonly pageNumber: number;
    readonly textElements: readonly {
      readonly text: string;
      readonly xPt: number;
      readonly yPt: number;
    }[];
  }[];
}

/**
 * Re-derives each callout's printed step from the exact current PDF text
 * coordinates and current panel bounds. Manifest and coverage step numbers are
 * deliberately not inputs to this mapping.
 */
export function bindCalloutsToBookletPanels(input: BookletPanelBindingInput): {
  readonly failures: readonly StepFailure[];
  readonly stepByIdentity: ReadonlyMap<string, number>;
} {
  const liveLabels = new Map<
    string,
    {
      readonly pageNumber: number;
      readonly quantity: number;
      readonly xPt: number;
      readonly yPt: number;
    }
  >();
  for (const page of input.sourcePages) {
    for (const element of page.textElements) {
      const match = /^(\d{1,3})x$/u.exec(element.text);
      if (match === null) continue;
      const quantity = Number(match[1]);
      const identity = stableIdentity(page.pageNumber, quantity, element.xPt, element.yPt);
      if (!liveLabels.has(identity)) {
        liveLabels.set(identity, {
          pageNumber: page.pageNumber,
          quantity,
          xPt: element.xPt,
          yPt: element.yPt,
        });
      }
    }
  }

  const failures: StepFailure[] = [];
  const stepByIdentity = new Map<string, number>();
  const ambiguous = new Map<string, number>();
  for (const [identity, label] of liveLabels) {
    const matches = input.panels.filter(
      ({ pageNumber, bounds }) =>
        pageNumber === label.pageNumber &&
        label.xPt >= bounds.minXPt &&
        label.xPt < bounds.maxXPt &&
        label.yPt >= bounds.minYPt &&
        label.yPt < bounds.maxYPt,
    );
    if (matches.length === 1) stepByIdentity.set(identity, matches[0]!.stepNumber);
    else ambiguous.set(identity, matches.length);
  }

  const manifestByIdentity = new Map(
    input.manifestCallouts.map((entry) => [entry.identity, entry]),
  );
  const requestedIdentities = new Set<string>();
  for (const [identity, stepNumber] of stepByIdentity) {
    if (stepNumber <= input.lastStep) requestedIdentities.add(identity);
  }
  for (const entry of input.manifestCallouts) {
    if (entry.stepNumber !== null && entry.stepNumber <= input.lastStep) {
      requestedIdentities.add(entry.identity);
    }
  }

  for (const identity of [...requestedIdentities].sort()) {
    const manifest = manifestByIdentity.get(identity);
    const live = liveLabels.get(identity);
    const liveStep = stepByIdentity.get(identity);
    if (manifest === undefined) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: identity,
        ...(liveStep === undefined ? {} : { stepNumber: liveStep }),
        message:
          `Current booklet callout ${identity} belongs to requested printed step ${liveStep}, but the v4 ` +
          `manifest has no record for it. Republish the full callout manifest from this exact PDF.`,
      });
      continue;
    }
    if (live === undefined) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: identity,
        ...(manifest.stepNumber === null ? {} : { stepNumber: manifest.stepNumber }),
        message:
          `Manifest callout ${identity} claims requested printed step ${manifest.stepNumber}, but no exact ` +
          `quantity label at those stable page/x/y coordinates exists in the current PDF. Republish it instead ` +
          `of moving a retained crop between panels.`,
      });
      continue;
    }
    if (liveStep === undefined) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: identity,
        ...(manifest.stepNumber === null ? {} : { stepNumber: manifest.stepNumber }),
        message:
          `Current PDF callout ${identity} lies in ${ambiguous.get(identity) ?? 0} printed panel bounds; exactly ` +
          `one is required before its crop can define a requested build action. Regenerate the panel mapping ` +
          `from the exact booklet.`,
      });
      continue;
    }
    if (
      manifest.pageNumber !== live.pageNumber ||
      manifest.quantity !== live.quantity ||
      manifest.stepNumber !== liveStep
    ) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: identity,
        stepNumber: liveStep,
        message:
          `Callout ${identity} is independently located by the current PDF at page ${live.pageNumber}, printed ` +
          `step ${liveStep}, quantity ${live.quantity}, but the manifest declares page ${manifest.pageNumber}, ` +
          `step ${JSON.stringify(manifest.stepNumber)}, quantity ${manifest.quantity}. Republish the manifest; ` +
          `its copied step field cannot override the booklet panel containing the stable coordinates.`,
      });
      continue;
    }
    const expectedEvidenceKind = evidenceContract(identity, "vector-smallest")!.evidenceKind;
    if (manifest.evidenceKind !== expectedEvidenceKind) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: identity,
        stepNumber: liveStep,
        message:
          `Callout ${identity} has fixed evidence contract ${JSON.stringify(expectedEvidenceKind)}, but the ` +
          `manifest labels it ${JSON.stringify(manifest.evidenceKind)}. Republish the evidence-aware crop; whether ` +
          `the label sits inside a vector box cannot add or remove a physical piece from the requested step.`,
      });
    }
  }
  return { failures, stepByIdentity };
}

export function reconcileStepCoverage<T extends StepCoverageCalloutClaim>(
  byCallout: Readonly<Record<string, T>>,
  input: {
    readonly pageNumber: number;
    readonly stepNumber: number;
    readonly mappedKeys: readonly string[];
  },
): {
  readonly expectedKeys: readonly string[];
  readonly expectedPieces: number;
  readonly failure: StepFailure | null;
} {
  const expected = Object.entries(byCallout)
    .filter(
      ([, claim]) => claim.pageNumber === input.pageNumber && claim.stepNumber === input.stepNumber,
    )
    .sort(([left], [right]) => left.localeCompare(right));
  const expectedKeys = expected.map(([key]) => key);
  const mappedKeys = [...input.mappedKeys].sort((left, right) => left.localeCompare(right));
  const matches =
    expectedKeys.length === mappedKeys.length &&
    expectedKeys.every((key, index) => key === mappedKeys[index]);
  return {
    expectedKeys,
    expectedPieces: expected.reduce((total, [, claim]) => total + claim.quantity, 0),
    failure: matches
      ? null
      : {
          code: "coverage-key-mismatch",
          stage: "coverage",
          message:
            `Step ${input.stepNumber} on page ${input.pageNumber} maps panel callouts ` +
            `[${mappedKeys.join(", ") || "none"}], but retained coverage assigns ` +
            `[${expectedKeys.join(", ") || "none"}]. Resolve the panel-to-callout mapping; neither key set may ` +
            `silently define a complete printed step.`,
        },
  };
}
