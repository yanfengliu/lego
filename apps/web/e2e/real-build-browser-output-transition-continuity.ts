import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
  isBoundedDataOnlyJson,
  ROOT_SUBMODEL_ID,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import type { RealBuildPanelCameraEvidence } from "./real-build-panel-camera-evidence";
import type { RealBuildPanelSpec } from "./real-build-options-types";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const MAXIMUM_REAL_BUILD_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_DOCUMENT_DEPTH = 64;
const MAXIMUM_REAL_BUILD_DOCUMENT_NODES = 1_000_000;
const MAXIMUM_REAL_BUILD_PRINTED_STEPS = 359;

export interface PanelCameraCanonicalTransitionWitness {
  readonly sourceDocumentHash: string;
  readonly targetDocumentHash: string;
  readonly sourceDocumentParts: number;
  readonly targetDocumentParts: number;
  readonly step: BrickDocumentV1["steps"][number];
  readonly validation: {
    readonly targetDocumentHash: string;
    readonly truthSnapshotHash: string;
    readonly validatorSetHash: string;
    readonly documentGloballyValid: boolean;
    readonly blockingIssues: readonly {
      readonly code: string;
      readonly message: string;
      readonly path: string;
      readonly partIds: readonly string[];
    }[];
  };
}

export interface BrowserOutputCanonicalDocumentBoundary {
  readonly present: boolean;
  readonly defect: string | null;
  readonly transitionWitnesses: ReadonlyMap<number, PanelCameraCanonicalTransitionWitness>;
  readonly finalDocument: {
    readonly structuralHash: string;
    readonly partCount: number;
    readonly documentGloballyValid: boolean;
    readonly blockingIssueCount: number;
    readonly exactEmptyRoot: boolean;
    readonly metadataDefect: string | null;
    readonly steps: readonly {
      readonly id: string;
      readonly index: number;
      readonly name: string;
      readonly partCount: number;
    }[];
  } | null;
}

export interface AcceptedCanonicalStepSemantics {
  readonly stepNumber: number;
  readonly id: string;
  readonly name: string;
  readonly partCount: number;
}

const absentBoundary = (defect: string | null): BrowserOutputCanonicalDocumentBoundary => ({
  present: false,
  defect,
  transitionWitnesses: new Map(),
  finalDocument: null,
});

function utf8ByteLengthAtMost(value: string, maximum: number): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > maximum) return bytes;
  }
  return bytes;
}

/** Checks both the in-memory UTF-16 representation and the eventual UTF-8 artifact. */
export function serializedRealBuildDocumentDefect(
  value: string,
  maximumBytes = MAXIMUM_REAL_BUILD_DOCUMENT_BYTES,
): string | null {
  if (value.length * 2 > maximumBytes) {
    return `document exceeds the ${maximumBytes}-byte UTF-16 boundary`;
  }
  if (utf8ByteLengthAtMost(value, maximumBytes) > maximumBytes) {
    return `document exceeds the ${maximumBytes}-byte UTF-8 boundary`;
  }
  let depth = 0;
  let containers = 0;
  let structuralTokens = 0;
  let inString = false;
  let escaped = false;
  let firstToken = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (/\s/u.test(character)) continue;
    firstToken ||= character;
    if (character === "{" || character === "[") {
      depth += 1;
      containers += 1;
      structuralTokens += 1;
      if (depth > MAXIMUM_REAL_BUILD_DOCUMENT_DEPTH) {
        return `document exceeds nesting depth ${MAXIMUM_REAL_BUILD_DOCUMENT_DEPTH}`;
      }
      if (containers > MAXIMUM_REAL_BUILD_DOCUMENT_NODES) {
        return `document exceeds ${MAXIMUM_REAL_BUILD_DOCUMENT_NODES} structural containers`;
      }
    } else if (character === "}" || character === "]") {
      depth -= 1;
      if (depth < 0) return "document closes a container before opening it";
    } else if (character === "," || character === ":") {
      structuralTokens += 1;
    }
    if (structuralTokens > MAXIMUM_REAL_BUILD_DOCUMENT_NODES) {
      return `document exceeds ${MAXIMUM_REAL_BUILD_DOCUMENT_NODES} pre-parse structural nodes`;
    }
  }
  if (firstToken !== "{") return "document root is not a JSON object";
  return null;
}

function canonicalPrefixDocument(
  document: BrickDocumentV1,
  lastStepNumber: number,
): BrickDocumentV1 {
  const steps = document.steps.filter(({ index }) => index < lastStepNumber);
  const stepIds = new Set(steps.map(({ id }) => id));
  const parts = document.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => partIds.has(partId)),
  });
  return {
    ...document,
    parts,
    steps,
    connections: document.connections.filter(
      ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
}

const blockingIssues = (issues: ReturnType<typeof validateBrickDocument>["issues"]) =>
  issues
    .filter(({ severity }) => severity === "blocking")
    .map(({ code, message, path, partIds }) => ({ code, message, path, partIds }));

function exactManualProvenance(value: { readonly [key: string]: unknown }): boolean {
  return Object.keys(value).length === 1 && value.source === "manual";
}

function canonicalMetadataDefect(document: BrickDocumentV1): string | null {
  if (
    document.id !== "real-build" ||
    document.name !== "Real booklet rebuild" ||
    document.revision !== "revision-0" ||
    Object.keys(document.provenance).length !== 1 ||
    document.provenance.origin !== "manual"
  ) {
    return "document identity, revision, name, or provenance differs from the canonical real-build root";
  }
  if (
    document.submodels.length !== 1 ||
    document.submodels[0]?.id !== ROOT_SUBMODEL_ID ||
    document.submodels[0].name !== "Root" ||
    document.submodels[0].partIds.length !== document.parts.length ||
    document.parts.some(({ id }) => !document.submodels[0]!.partIds.includes(id))
  ) {
    return "document leaks a non-root submodel, a renamed root, or inconsistent root ownership";
  }
  if (document.semanticRegions.length !== 0) {
    return "document leaks semantic-region metadata that no accepted printed step authored";
  }
  if (
    document.parts.some(
      ({ submodelId, provenance }) =>
        submodelId !== ROOT_SUBMODEL_ID || !exactManualProvenance(provenance),
    ) ||
    document.connections.some(({ provenance }) => !exactManualProvenance(provenance))
  ) {
    return "document part, connection, or submodel provenance differs from manual canonical execution";
  }
  return null;
}

function canonicalTransitionStepDefect(
  stepNumbers: readonly number[],
  maximumStep: number,
): string | null {
  if (!Array.isArray(stepNumbers) || stepNumbers.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS) {
    return `transition step list is not a bounded dense array of at most ${MAXIMUM_REAL_BUILD_PRINTED_STEPS}`;
  }
  let previous = 0;
  for (let index = 0; index < stepNumbers.length; index += 1) {
    if (!Object.hasOwn(stepNumbers, index)) return "transition step list is sparse";
    const stepNumber = stepNumbers[index];
    if (!Number.isSafeInteger(stepNumber) || stepNumber! <= previous || stepNumber! > maximumStep) {
      return `transition step list is not strictly increasing within 1..${maximumStep}`;
    }
    previous = stepNumber!;
  }
  return null;
}

/** Parses final bytes once and reconstructs only the requested transition prefixes. */
export function inspectBrowserOutputCanonicalDocument(
  documentJson: unknown,
  transitionStepNumbers: readonly number[],
  maximumStep = MAXIMUM_REAL_BUILD_PRINTED_STEPS,
  maxParts = 10_000,
): BrowserOutputCanonicalDocumentBoundary {
  if (
    !Number.isSafeInteger(maximumStep) ||
    maximumStep < 1 ||
    maximumStep > MAXIMUM_REAL_BUILD_PRINTED_STEPS
  ) {
    return absentBoundary(`maximum printed step is outside 1..${MAXIMUM_REAL_BUILD_PRINTED_STEPS}`);
  }
  const transitionDefect = canonicalTransitionStepDefect(transitionStepNumbers, maximumStep);
  if (transitionDefect !== null) return absentBoundary(transitionDefect);
  if (documentJson === null) return absentBoundary(null);
  if (typeof documentJson !== "string") {
    return absentBoundary("document is neither null nor a string");
  }
  const serializedDefect = serializedRealBuildDocumentDefect(documentJson);
  if (serializedDefect !== null) return { ...absentBoundary(serializedDefect), present: true };
  try {
    const value: unknown = JSON.parse(documentJson);
    if (
      !isBoundedDataOnlyJson(value, {
        maxDepth: MAXIMUM_REAL_BUILD_DOCUMENT_DEPTH,
        maxNodes: MAXIMUM_REAL_BUILD_DOCUMENT_NODES,
      })
    ) {
      return {
        ...absentBoundary("document exceeds the inert JSON depth or node boundary"),
        present: true,
      };
    }
    if (!validateBrickDocumentV1(value) || value.parts.length > maxParts) {
      return {
        ...absentBoundary("document is not a bounded valid BrickDocumentV1"),
        present: true,
      };
    }
    const document = value;
    const witnesses = new Map<number, PanelCameraCanonicalTransitionWitness>();
    for (const stepNumber of new Set(transitionStepNumbers)) {
      const matches = document.steps.filter(({ index }) => index === stepNumber - 1);
      if (matches.length !== 1) continue;
      const source = canonicalPrefixDocument(document, stepNumber - 1);
      const target = canonicalPrefixDocument(document, stepNumber);
      const validation = validateBrickDocument(target);
      witnesses.set(stepNumber, {
        sourceDocumentHash: documentStructuralHash(source),
        targetDocumentHash: documentStructuralHash(target),
        sourceDocumentParts: source.parts.length,
        targetDocumentParts: target.parts.length,
        step: matches[0]!,
        validation: {
          targetDocumentHash: validation.targetDocumentHash,
          truthSnapshotHash: validation.truthSnapshotHash,
          validatorSetHash: validation.validatorSetHash,
          documentGloballyValid: validation.documentGloballyValid,
          blockingIssues: blockingIssues(validation.issues),
        },
      });
    }
    const emptyRoot = createEmptyBrickDocument({
      id: "real-build",
      name: "Real booklet rebuild",
      maxParts,
    });
    const finalValidation = validateBrickDocument(document);
    return {
      present: true,
      defect: null,
      transitionWitnesses: witnesses,
      finalDocument: {
        structuralHash: documentStructuralHash(document),
        partCount: document.parts.length,
        documentGloballyValid: finalValidation.documentGloballyValid,
        blockingIssueCount: finalValidation.issues.filter(({ severity }) => severity === "blocking")
          .length,
        exactEmptyRoot: canonicalBrickDocument(document) === canonicalBrickDocument(emptyRoot),
        metadataDefect: canonicalMetadataDefect(document),
        steps: document.steps.map(({ id, index, name, partIds }) => ({
          id,
          index,
          name,
          partCount: partIds.length,
        })),
      },
    };
  } catch (error) {
    return { ...absentBoundary(describeBrowserThrown(error)), present: true };
  }
}

export function inspectBrowserOutputCanonicalTransitions(
  documentJson: unknown,
  panels: readonly RealBuildPanelSpec[],
  lastStep: number,
  maxParts: number,
): BrowserOutputCanonicalDocumentBoundary {
  try {
    if (
      !Number.isSafeInteger(lastStep) ||
      lastStep < 1 ||
      lastStep > MAXIMUM_REAL_BUILD_PRINTED_STEPS
    ) {
      return absentBoundary(`lastStep is outside 1..${MAXIMUM_REAL_BUILD_PRINTED_STEPS}`);
    }
    const stepNumbers = panels
      .filter(({ stepNumber, action }) => stepNumber <= lastStep && action.kind === "transition")
      .map(({ stepNumber }) => stepNumber)
      .sort((left, right) => left - right);
    return inspectBrowserOutputCanonicalDocument(documentJson, stepNumbers, lastStep, maxParts);
  } catch (error) {
    return absentBoundary(`transition panel boundary is hostile: ${describeBrowserThrown(error)}`);
  }
}

export function terminalCanonicalDocumentDefect(input: {
  readonly boundary: BrowserOutputCanonicalDocumentBoundary;
  readonly expectedRootDocumentHash: string;
  readonly acceptedDocumentHash: string;
  readonly acceptedDocumentParts: number;
  readonly acceptedSteps: readonly AcceptedCanonicalStepSemantics[];
}): string | null {
  if (!input.boundary.present) return input.boundary.defect;
  if (input.boundary.defect !== null || input.boundary.finalDocument === null) {
    return `terminal canonical document is unreadable: ${input.boundary.defect ?? "missing facts"}`;
  }
  const final = input.boundary.finalDocument;
  if (input.acceptedSteps.length === 0) {
    if (input.acceptedDocumentHash !== input.expectedRootDocumentHash) {
      return "terminal root-refusal continuity no longer names the canonical empty hash";
    }
    if (input.acceptedDocumentParts !== 0 || !final.exactEmptyRoot) {
      return "terminal document after a root refusal is not the exact canonical empty real-build document";
    }
    return null;
  }
  if (
    final.structuralHash !== input.acceptedDocumentHash ||
    final.partCount !== input.acceptedDocumentParts ||
    !final.documentGloballyValid ||
    final.blockingIssueCount !== 0
  ) {
    return (
      `terminal document hash/part count ${final.structuralHash}/${final.partCount} does not match ` +
      `accepted report continuity ${input.acceptedDocumentHash}/${input.acceptedDocumentParts}, ` +
      `with global validity ${String(final.documentGloballyValid)} and ${final.blockingIssueCount} blocking issue(s)`
    );
  }
  if (final.metadataDefect !== null) return `terminal ${final.metadataDefect}`;
  if (final.steps.length !== input.acceptedSteps.length) {
    return `terminal document retains ${final.steps.length} steps after ${input.acceptedSteps.length} accepted report steps`;
  }
  for (let index = 0; index < input.acceptedSteps.length; index += 1) {
    const expected = input.acceptedSteps[index]!;
    const actual = final.steps[index];
    if (
      expected.stepNumber !== index + 1 ||
      actual === undefined ||
      actual.id !== expected.id ||
      actual.index !== index ||
      actual.name !== expected.name ||
      actual.partCount !== expected.partCount
    ) {
      return `terminal canonical step ${index + 1} does not match its accepted report ID, index, semantic name, or owned part count`;
    }
  }
  return null;
}

type TransitionAdvance =
  | { readonly kind: "not-transition" }
  | { readonly kind: "rejected"; readonly defect: string }
  | { readonly kind: "accepted"; readonly targetDocumentHash: string };

function isExactDenseEmptyArray(value: unknown): value is readonly never[] {
  return Array.isArray(value) && value.length === 0;
}

/** Advances only from a canonical, independently validated empty BuildStep. */
export function canonicalTransitionAdvance(input: {
  readonly report: Record<string, unknown>;
  readonly evidence: RealBuildPanelCameraEvidence;
  readonly reportIndex: number;
  readonly acceptedDocumentHash: string;
  readonly acceptedDocumentParts: number;
  readonly witnesses: ReadonlyMap<number, PanelCameraCanonicalTransitionWitness>;
}): TransitionAdvance {
  const outcome = input.report.outcome as Record<string, unknown> | null;
  const action = input.report.action as Record<string, unknown> | null;
  if (outcome?.status !== "complete" || action?.kind !== "transition") {
    return { kind: "not-transition" };
  }
  const stepNumber = input.reportIndex + 1;
  const witness = input.witnesses.get(stepNumber);
  if (witness === undefined) {
    return {
      kind: "rejected",
      defect:
        `Replay browser-output report[${input.reportIndex}] claims a completed metadata-only transition, ` +
        `but its canonical BuildStep is absent or non-unique in the retained document.`,
    };
  }
  const validation = input.report.validation as Record<string, unknown> | null;
  const expectedName =
    `Step ${stepNumber} [transition:${String(action.transition)};` +
    `panel=${String(action.panelEvidenceDigest)}]`;
  const hasSelection = input.evidence.candidates.some(
    ({ selectedObservationId, selectedLineageIds }) =>
      selectedObservationId !== null || selectedLineageIds.length > 0,
  );
  if (
    action.assembledPieces !== 0 ||
    !["rotation", "attachment", "final-view"].includes(String(action.transition)) ||
    typeof action.panelEvidenceDigest !== "string" ||
    !DIGEST_PATTERN.test(action.panelEvidenceDigest) ||
    input.report.expectedAssembledPieces !== 0 ||
    input.report.attemptedPieces !== 0 ||
    input.report.placedPieces !== 0 ||
    input.report.actionEvidenceDigest !== action.evidenceDigest ||
    outcome.mechanism !== "instruction-transition" ||
    outcome.failure !== null ||
    input.evidence.throughStepNumber !== stepNumber - 1 ||
    input.evidence.registrationPanelStepNumber !== stepNumber ||
    !["seeded", "unresolved"].includes(input.evidence.status) ||
    input.evidence.observations.length === 0 ||
    hasSelection ||
    witness.sourceDocumentHash !== input.acceptedDocumentHash ||
    witness.sourceDocumentParts !== input.acceptedDocumentParts ||
    witness.targetDocumentHash === witness.sourceDocumentHash ||
    witness.sourceDocumentParts !== witness.targetDocumentParts ||
    input.report.documentParts !== witness.targetDocumentParts ||
    input.report.canonicalStepId !== witness.step.id ||
    witness.step.index !== stepNumber - 1 ||
    witness.step.name !== expectedName ||
    witness.step.partIds.length !== 0 ||
    validation?.attempted !== true ||
    validation.targetDocumentHash !== witness.targetDocumentHash ||
    validation.targetDocumentHash !== witness.validation.targetDocumentHash ||
    validation.truthSnapshotHash !== witness.validation.truthSnapshotHash ||
    validation.validatorSetHash !== witness.validation.validatorSetHash ||
    validation.documentGloballyValid !== true ||
    validation.documentGloballyValid !== witness.validation.documentGloballyValid ||
    validation.failure !== null ||
    !isExactDenseEmptyArray(validation.blockingIssues) ||
    witness.validation.blockingIssues.length !== 0
  ) {
    return {
      kind: "rejected",
      defect:
        `Replay browser-output report[${input.reportIndex}] completed metadata-only transition does not ` +
        `reproduce its prior accepted hash, unique empty canonical BuildStep, independently validated target ` +
        `prefix, unchanged part count, or unselected camera frontier.`,
    };
  }
  return { kind: "accepted", targetDocumentHash: witness.targetDocumentHash };
}
