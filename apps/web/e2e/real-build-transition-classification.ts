import { createHash } from "node:crypto";

import type { TransitionClassificationBundle } from "./real-build-input-files";
import {
  isUnauthenticatedTransitionClassification,
  transitionClassificationEvidenceDigest,
  type TransitionClassificationEvidence,
} from "./real-build-ledger";

/**
 * The transition-classification input, and the one place its contract is decided.
 *
 * A printed step that calls out no new piece still means something — the model
 * is turned over, a subassembly built beside it is put on, or the build is
 * finished — and the rebuild has to record which. Nothing in the booklet states
 * it in words, so the record is explicitly a *claim*: `authenticated: false`,
 * a classifier kind, and a digest over the claim's own content. A hash proves
 * that the claim has not changed since it was made. It proves nothing about
 * whether the claim is true, and no field here may be read as saying otherwise.
 *
 * The rejection list is the contract itself rather than a boolean, because a
 * rejected bundle has to say which entry failed and what would satisfy it.
 */

export const TRANSITION_CLASSIFICATIONS_SCHEMA = "lego.transition-classifications/1" as const;
export const TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA =
  "lego.transition-unauthenticated-classification/1" as const;

export type TransitionDecision = "rotation" | "attachment" | "final-view";
export type TransitionClassifierKind = "human-claim" | "model-claim";
export type TransitionReasonCode =
  "rotation-cue" | "attachment-cue" | "final-model-cue" | "no-new-piece-callout";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TRANSITION_DECISIONS: readonly TransitionDecision[] = [
  "rotation",
  "attachment",
  "final-view",
];
const DECISION_CUE: Readonly<Record<TransitionDecision, TransitionReasonCode>> = {
  rotation: "rotation-cue",
  attachment: "attachment-cue",
  "final-view": "final-model-cue",
};
const MINIMUM_NOTE_CHARACTERS = 12;
const MAXIMUM_NOTE_CHARACTERS = 2_000;

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** What a classifier is shown, and what the deterministic disposer re-checks afterwards. */
export interface TransitionPanelEvidence {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelEvidenceDigest: string;
  /** `Nx` piece callouts printed inside this panel. A transition step has none. */
  readonly newPieceCalloutCount: number;
  readonly isTerminalPrintedStep: boolean;
}

/** A classifier proposes; it never writes the record. */
export interface TransitionClassifierProposal {
  readonly decision: TransitionDecision;
  readonly classifierKind: TransitionClassifierKind;
  readonly notes: string;
}

/**
 * The seam a vision model plugs into.
 *
 * Async because a model call is: the deterministic classifier just resolves.
 * Returning null means "I cannot decide this panel", which is a legitimate
 * answer and is recorded as an unclassified step rather than guessed at.
 */
export type TransitionClassifier<Panel extends TransitionPanelEvidence = TransitionPanelEvidence> =
  (panel: Panel) => Promise<TransitionClassifierProposal | null>;

export interface UnclassifiedTransitionStep {
  readonly stepNumber: number;
  readonly reason: string;
}

/**
 * Runs one classifier over every panel and disposes of what it proposes.
 *
 * A panel that still prints piece callouts is not offered to the classifier at
 * all. A panel the classifier declines, or whose proposal the disposer rejects,
 * is recorded as unclassified and named in the emitted bundle — one bad panel
 * never removes the rest, and it is never silently guessed at either.
 */
export async function classifyTransitionPanels<Panel extends TransitionPanelEvidence>(input: {
  readonly panels: readonly Panel[];
  readonly classifier: TransitionClassifier<Panel>;
  readonly classifierId: string;
}): Promise<{
  readonly entries: readonly TransitionClassificationEvidence[];
  readonly unclassified: readonly UnclassifiedTransitionStep[];
}> {
  const entries: TransitionClassificationEvidence[] = [];
  const unclassified: UnclassifiedTransitionStep[] = [];
  for (const panel of input.panels) {
    if (panel.newPieceCalloutCount !== 0) continue;
    let proposal: TransitionClassifierProposal | null;
    try {
      proposal = await input.classifier(panel);
    } catch (error) {
      unclassified.push({
        stepNumber: panel.stepNumber,
        reason:
          `Classifier ${input.classifierId} threw on printed step ${panel.stepNumber}: ` +
          `${error instanceof Error ? error.message : String(error)}. Fix the classifier or classify this ` +
          `panel by hand; the step stays unclassified until one of those happens.`,
      });
      continue;
    }
    if (proposal === null) {
      unclassified.push({
        stepNumber: panel.stepNumber,
        reason:
          `Classifier ${input.classifierId} declined printed step ${panel.stepNumber}. A declined panel is ` +
          `left out of the bundle rather than guessed at; classify it by hand or with a classifier that can ` +
          `read this panel.`,
      });
      continue;
    }
    try {
      entries.push(
        buildTransitionClassificationEntry({ panel, proposal, classifierId: input.classifierId }),
      );
    } catch (error) {
      unclassified.push({
        stepNumber: panel.stepNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { entries, unclassified };
}

export interface TransitionClassificationBundleProvenance {
  readonly generator: string;
  readonly classifierId: string;
  /** Repeated inside the file so a reader of the JSON alone cannot mistake it for authority. */
  readonly authenticated: false;
  readonly printedStepCount: number;
  readonly transitionStepCount: number;
  readonly unclassifiedSteps: readonly number[];
}

export interface EmittedTransitionClassificationBundle {
  readonly schemaVersion: typeof TRANSITION_CLASSIFICATIONS_SCHEMA;
  readonly pdfDigest: string;
  readonly provenance: TransitionClassificationBundleProvenance;
  readonly entries: readonly TransitionClassificationEvidence[];
}

function requireDigest(value: string, field: string, stepNumber: number): void {
  if (!DIGEST_PATTERN.test(value)) {
    throw new TypeError(
      `Transition classification for printed step ${stepNumber} has ${field} ` +
        `${JSON.stringify(value)}, which is not a sha256:<64 lowercase hex> digest. Bind the panel ` +
        `digest the real-build panel derivation produced for this exact step.`,
    );
  }
}

/**
 * Turns one accepted proposal into one entry — and rejects it first.
 *
 * This is the deterministic half of the seam. A proposal cannot declare a step
 * a transition when the panel prints piece callouts, cannot claim the final
 * view on a step that is not the last printed one, and cannot supply its own
 * reason codes or claim id: both are derived here from the decision, so the
 * record cannot disagree with itself.
 */
export function buildTransitionClassificationEntry(input: {
  readonly panel: TransitionPanelEvidence;
  readonly proposal: TransitionClassifierProposal;
  readonly classifierId: string;
}): TransitionClassificationEvidence {
  const { panel, proposal, classifierId } = input;
  if (!Number.isInteger(panel.stepNumber) || panel.stepNumber < 1) {
    throw new TypeError(
      `Transition classification needs a printed step number of 1 or more; received ` +
        `${JSON.stringify(panel.stepNumber)}. Classify a panel derived from the booklet, not a synthetic index.`,
    );
  }
  if (!Number.isInteger(panel.pageNumber) || panel.pageNumber < 1) {
    throw new TypeError(
      `Transition classification for printed step ${panel.stepNumber} needs the 1-based booklet page it is ` +
        `printed on; received ${JSON.stringify(panel.pageNumber)}.`,
    );
  }
  requireDigest(panel.panelEvidenceDigest, "panelEvidenceDigest", panel.stepNumber);
  if (!Number.isInteger(panel.newPieceCalloutCount) || panel.newPieceCalloutCount < 0) {
    throw new TypeError(
      `Transition classification for printed step ${panel.stepNumber} needs a non-negative callout count; ` +
        `received ${JSON.stringify(panel.newPieceCalloutCount)}.`,
    );
  }
  if (panel.newPieceCalloutCount > 0) {
    throw new TypeError(
      `Printed step ${panel.stepNumber} prints ${panel.newPieceCalloutCount} piece callout(s) inside its ` +
        `panel, so it places pieces and is not a transition. Record it as a place-callouts action in the ` +
        `action ledger instead; only a panel with zero piece callouts may carry a transition claim.`,
    );
  }
  if (!TRANSITION_DECISIONS.includes(proposal.decision)) {
    throw new TypeError(
      `Transition classifier proposed ${JSON.stringify(proposal.decision)} for printed step ` +
        `${panel.stepNumber}; the only decisions this contract accepts are ` +
        `${TRANSITION_DECISIONS.join(", ")}.`,
    );
  }
  if (proposal.decision === "final-view" && !panel.isTerminalPrintedStep) {
    throw new TypeError(
      `Transition classifier proposed final-view for printed step ${panel.stepNumber}, which is not the last ` +
        `printed step of this booklet. Only the terminal printed step may claim the completed model; propose ` +
        `rotation or attachment instead.`,
    );
  }
  if (proposal.classifierKind !== "human-claim" && proposal.classifierKind !== "model-claim") {
    throw new TypeError(
      `Transition classifier for printed step ${panel.stepNumber} declared kind ` +
        `${JSON.stringify(proposal.classifierKind)}; a claim is either human-claim or model-claim, and no ` +
        `other kind is retained.`,
    );
  }
  const notes = proposal.notes;
  if (
    typeof notes !== "string" ||
    notes.trim().length < MINIMUM_NOTE_CHARACTERS ||
    notes.length > MAXIMUM_NOTE_CHARACTERS
  ) {
    throw new TypeError(
      `Transition classification for printed step ${panel.stepNumber} needs notes of ` +
        `${MINIMUM_NOTE_CHARACTERS}..${MAXIMUM_NOTE_CHARACTERS} characters saying what was read off the ` +
        `panel; received ${typeof notes === "string" ? `${notes.trim().length} trimmed characters` : typeof notes}.`,
    );
  }
  const reasonCodes: readonly TransitionReasonCode[] = [
    DECISION_CUE[proposal.decision],
    "no-new-piece-callout",
  ];
  const claimBody = JSON.stringify({
    schemaVersion: TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA,
    classifierId,
    classifierKind: proposal.classifierKind,
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    reviewedPanelDigest: panel.panelEvidenceDigest,
    decision: proposal.decision,
    reasonCodes,
    notes,
  });
  // Key order is load-bearing: the run contract re-hashes this object exactly as
  // it is parsed back out of the emitted file.
  const localClassification: TransitionClassificationEvidence["localClassification"] = {
    schemaVersion: TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA,
    authenticated: false,
    classifierKind: proposal.classifierKind,
    classifierClaimId: sha256(claimBody),
    reviewedPanelDigest: panel.panelEvidenceDigest,
    decision: proposal.decision,
    reasonCodes,
    notes,
  };
  if (!isUnauthenticatedTransitionClassification(localClassification)) {
    throw new TypeError(
      `Transition classification for printed step ${panel.stepNumber} did not satisfy the retained ` +
        `unauthenticated-claim guard after assembly. Its decision, reason codes and notes must reproduce ` +
        `the guard exactly; nothing here may relax it.`,
    );
  }
  return {
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelEvidenceDigest: panel.panelEvidenceDigest,
    transition: proposal.decision,
    evidenceDigest: transitionClassificationEvidenceDigest({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      panelEvidenceDigest: panel.panelEvidenceDigest,
      transition: proposal.decision,
      localClassification,
    }),
    localClassification,
  };
}

export function assembleTransitionClassificationBundle(input: {
  readonly pdfDigest: string;
  readonly classifierId: string;
  readonly printedStepCount: number;
  readonly unclassifiedSteps: readonly number[];
  readonly entries: readonly TransitionClassificationEvidence[];
}): EmittedTransitionClassificationBundle {
  if (!DIGEST_PATTERN.test(input.pdfDigest)) {
    throw new TypeError(
      `A transition-classification bundle must bind one exact booklet digest of the form sha256:<64 hex>; ` +
        `received ${JSON.stringify(input.pdfDigest)}.`,
    );
  }
  if (input.entries.length === 0) {
    throw new TypeError(
      `A transition-classification bundle must contain at least one entry; this booklet produced none. ` +
        `Either no printed step lacks piece callouts, or panel derivation failed — check the panel dump ` +
        `before emitting an empty bundle.`,
    );
  }
  const entries = [...input.entries].sort((left, right) => left.stepNumber - right.stepNumber);
  const stepNumbers = entries.map(({ stepNumber }) => stepNumber);
  if (new Set(stepNumbers).size !== stepNumbers.length) {
    throw new TypeError(
      `A transition-classification bundle must carry each printed step at most once; steps ` +
        `[${stepNumbers.filter((step, index) => stepNumbers.indexOf(step) !== index).join(", ")}] repeat.`,
    );
  }
  return {
    schemaVersion: TRANSITION_CLASSIFICATIONS_SCHEMA,
    pdfDigest: input.pdfDigest,
    provenance: {
      generator: "apps/web/e2e/real-build-transitions.spec.ts",
      classifierId: input.classifierId,
      authenticated: false,
      printedStepCount: input.printedStepCount,
      transitionStepCount: entries.length,
      unclassifiedSteps: [...input.unclassifiedSteps].sort((left, right) => left - right),
    },
    entries,
  };
}

/** Canonical bytes: sorted entries, stable key order, no clock, so the file's digest is reproducible. */
export function encodeTransitionClassificationBundle(
  bundle: EmittedTransitionClassificationBundle,
): Buffer {
  return Buffer.from(`${JSON.stringify(bundle, null, 1)}\n`, "utf8");
}

function entryRejections(index: number, value: unknown): readonly string[] {
  const at = `entries[${index}]`;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [
      `${at} is ${value === null ? "null" : typeof value}; every entry must be a JSON object.`,
    ];
  }
  const entry = value as Partial<TransitionClassificationEvidence>;
  const label =
    typeof entry.stepNumber === "number" ? `${at} (printed step ${entry.stepNumber})` : at;
  const rejections: string[] = [];
  if (!Number.isInteger(entry.stepNumber)) {
    rejections.push(
      `${at} has stepNumber ${JSON.stringify(entry.stepNumber ?? null)}; it must be an integer printed step.`,
    );
  }
  if (!Number.isInteger(entry.pageNumber)) {
    rejections.push(
      `${label} has pageNumber ${JSON.stringify(entry.pageNumber ?? null)}; it must be the integer booklet page the panel is printed on.`,
    );
  }
  if (
    typeof entry.panelEvidenceDigest !== "string" ||
    !DIGEST_PATTERN.test(entry.panelEvidenceDigest)
  ) {
    rejections.push(
      `${label} has panelEvidenceDigest ${JSON.stringify(entry.panelEvidenceDigest ?? null)}; it must be the sha256:<64 hex> panel digest this step's bounds and callout boxes produce.`,
    );
  }
  if (typeof entry.evidenceDigest !== "string" || !DIGEST_PATTERN.test(entry.evidenceDigest)) {
    rejections.push(
      `${label} has evidenceDigest ${JSON.stringify(entry.evidenceDigest ?? null)}; it must be a sha256:<64 hex> digest of the claim.`,
    );
  } else if (entry.evidenceDigest === entry.panelEvidenceDigest) {
    rejections.push(
      `${label} reuses its panel digest as its claim digest; the classification claim must hash to something other than the panel it reviewed, or panel pixels would be certifying themselves.`,
    );
  }
  if (
    typeof entry.transition !== "string" ||
    !TRANSITION_DECISIONS.includes(entry.transition as TransitionDecision)
  ) {
    rejections.push(
      `${label} has transition ${JSON.stringify(entry.transition ?? null)}; it must be one of ${TRANSITION_DECISIONS.join(", ")}.`,
    );
  }
  if (!isUnauthenticatedTransitionClassification(entry.localClassification)) {
    rejections.push(
      `${label} has no valid localClassification: it must use ${TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA}, set authenticated to false, carry a sha256 classifierClaimId and reviewedPanelDigest, a human-claim or model-claim kind, exactly the decision cue plus no-new-piece-callout, and notes of ${MINIMUM_NOTE_CHARACTERS}..${MAXIMUM_NOTE_CHARACTERS} characters.`,
    );
    return rejections;
  }
  const classification = entry.localClassification;
  if (classification.decision !== entry.transition) {
    rejections.push(
      `${label} declares transition ${JSON.stringify(entry.transition ?? null)} but its local claim decided ${JSON.stringify(classification.decision)}; the entry and the claim it retains must agree.`,
    );
  }
  if (classification.reviewedPanelDigest !== entry.panelEvidenceDigest) {
    rejections.push(
      `${label} reviewed panel ${classification.reviewedPanelDigest} but binds panel ${JSON.stringify(entry.panelEvidenceDigest ?? null)}; a claim about one panel cannot classify another.`,
    );
  }
  if (rejections.length > 0) return rejections;
  const reproduced = transitionClassificationEvidenceDigest({
    stepNumber: entry.stepNumber!,
    pageNumber: entry.pageNumber!,
    panelEvidenceDigest: entry.panelEvidenceDigest!,
    transition: entry.transition!,
    localClassification: classification,
  });
  if (reproduced !== entry.evidenceDigest) {
    rejections.push(
      `${label} carries evidenceDigest ${entry.evidenceDigest} but its own step, page, panel, transition and local claim hash to ${reproduced}; re-emit the entry from its content instead of editing the digest.`,
    );
  }
  return rejections;
}

export interface ReadTransitionClassificationBundle {
  readonly entries: readonly TransitionClassificationEvidence[];
  readonly byStep: Readonly<Record<number, TransitionClassificationEvidence>>;
  readonly rejections: readonly string[];
}

/**
 * The live contract the real-build probe applies to this input.
 *
 * Callers treat a non-empty rejection list as a rejected bundle. `byStep` is
 * only populated from entries that survived, so a malformed row cannot reach
 * the action-ledger comparison as if it were a classification.
 */
export function readTransitionClassificationBundle(
  bundle: TransitionClassificationBundle,
  expectedPdfDigest: string,
): ReadTransitionClassificationBundle {
  const rejections: string[] = [];
  if (bundle.schemaVersion !== TRANSITION_CLASSIFICATIONS_SCHEMA) {
    rejections.push(
      `schemaVersion is ${JSON.stringify(bundle.schemaVersion ?? null)}; this input must declare ${TRANSITION_CLASSIFICATIONS_SCHEMA}.`,
    );
  }
  if (bundle.pdfDigest !== expectedPdfDigest) {
    rejections.push(
      `pdfDigest is ${JSON.stringify(bundle.pdfDigest ?? null)} but the booklet this run ingested hashes to ${expectedPdfDigest}; regenerate the bundle against the exact PDF being built.`,
    );
  }
  const raw = Array.isArray(bundle.entries) ? bundle.entries : [];
  if (!Array.isArray(bundle.entries)) {
    rejections.push(
      `entries is ${bundle.entries === undefined ? "missing" : typeof bundle.entries}; it must be an array of classification entries.`,
    );
  } else if (raw.length === 0) {
    rejections.push(
      `entries is empty; a bundle with no entry classifies nothing and cannot answer a transition step.`,
    );
  }
  const byStep: Record<number, TransitionClassificationEvidence> = {};
  const seen = new Set<number>();
  raw.forEach((value, index) => {
    const entryFailures = entryRejections(index, value);
    rejections.push(...entryFailures);
    if (entryFailures.length > 0) return;
    const entry = value as TransitionClassificationEvidence;
    if (seen.has(entry.stepNumber)) {
      rejections.push(
        `printed step ${entry.stepNumber} appears more than once; each printed step may carry at most one transition classification.`,
      );
      return;
    }
    seen.add(entry.stepNumber);
    byStep[entry.stepNumber] = entry;
  });
  return { entries: raw as readonly TransitionClassificationEvidence[], byStep, rejections };
}
