import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  requireRealBuildPrefix50ExactCompilation,
  type RealBuildPrefix50ExactCompilation,
} from "./real-build-prefix50-exact-compiler";
import { requireRealBuildPrefix50TerminalDetachedState } from "./real-build-prefix50-suffix-state";

const INCOMPLETE_VALIDATION_CODES = new Set([
  "COLLISION_COMPARISON_BUDGET_EXCEEDED",
  "COLLISION_FINDING_BUDGET_EXCEEDED",
  "VALIDATION_ISSUE_BUDGET_EXCEEDED",
]);

export const REAL_BUILD_PREFIX50_INCOMPLETE_RUN_MANIFEST = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-incomplete-run-manifest/2",
  sourceSetId: "6651557",
  exactBoundary: "printed-steps-1-through-50-only",
  terminalPolicy: "intentional-detached-step50-subassembly/1",
  validationPolicy: "sole-disconnected-assembly-blocker-plus-two-hard-valid-components/1",
  authorityPolicy: "replay-evidence-only-no-patch-completion-or-acceptance/1",
  step45PlacementPolicy: "single-relational-enumeration-no-generic-transform-search/1",
  step51Inspected: false,
} as const);

export interface RealBuildPrefix50IncompleteRunBoundary {
  readonly schemaVersion: "lego.real-build-prefix50-incomplete-run-boundary/2";
  readonly authority: "none";
  readonly completionAuthority: false;
  readonly patchAuthority: false;
  readonly userAcceptanceAuthority: false;
  readonly sourceSetId: "6651557";
  readonly exactBoundary: "printed-steps-1-through-50-only";
  readonly printedStepRange: readonly [1, 50];
  readonly step51Inspected: false;
  readonly projectionCommitment: `sha256:${string}`;
  readonly gaugeCommitment: `sha256:${string}`;
  readonly exactCompilationCommitment: `sha256:${string}`;
  readonly terminalDetachedStateCommitment: `sha256:${string}`;
  readonly step44SelectionEvidenceCommitment: `sha256:${string}`;
  readonly step45RelationalEvidenceCommitment: `sha256:${string}`;
  readonly step45ReceiverPairs: readonly [
    readonly [281, 265],
    readonly [282, 261],
    readonly [283, 264],
  ];
  readonly combinedDocumentHash: `sha256:${string}`;
  readonly parentDocumentHash: `sha256:${string}`;
  readonly childDocumentHash: `sha256:${string}`;
  readonly compiledPartCount: 320;
  readonly compiledStepCount: 50;
  readonly zeroPieceStepNumber: 44;
  readonly parentPartCount: 311;
  readonly childPartCount: 9;
  readonly childOccurrenceOrdinals: readonly [312, 313, 314, 315, 316, 317, 318, 319, 320];
  readonly combinedBlockingCodes: readonly ["DISCONNECTED_ASSEMBLY"];
  readonly crossComponentConnectionCount: 0;
  readonly document: BrickDocumentV1;
  readonly exactCompilation: RealBuildPrefix50ExactCompilation;
  readonly commitment: `sha256:${string}`;
}

const boundaries = new WeakSet<object>();
const SAFE_ADD = WeakSet.prototype.add;
const SAFE_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

export function realBuildPrefix50ExactCompilationCommitment(
  compilation: RealBuildPrefix50ExactCompilation,
): `sha256:${string}` {
  return canonicalDigest(compilation);
}

export function createRealBuildPrefix50IncompleteRunBoundary(
  compilationValue: unknown,
): RealBuildPrefix50IncompleteRunBoundary {
  if (arguments.length !== 1) {
    throw new TypeError(
      "Prefix-50 incomplete-run boundary accepts only one runtime-branded exact compilation.",
    );
  }
  const compilation = requireRealBuildPrefix50ExactCompilation(compilationValue);
  const terminal = requireRealBuildPrefix50TerminalDetachedState(compilation.terminalDetachedState);
  const documentHash = documentStructuralHash(compilation.document);
  const report = validateBrickDocument(compilation.document);
  const blockingCodes = [
    ...new Set(
      report.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code),
    ),
  ].sort();
  const hasIncompleteValidation = report.issues.some(({ code }) =>
    INCOMPLETE_VALIDATION_CODES.has(code),
  );
  const sortedPlacementOrdinals = [...compilation.placementOrdinals].sort(
    (left, right) => left - right,
  );
  const step45ReceiverPairs = compilation.step45RelationalEvidence.receiverPairs.map(
    ({ occurrenceOrdinal, receiverOrdinal }) => [occurrenceOrdinal, receiverOrdinal] as const,
  );
  if (
    compilation.document.parts.length !== 320 ||
    compilation.document.steps.length !== 50 ||
    compilation.document.steps.some(({ index }, position) => index !== position) ||
    compilation.document.steps[43]?.partIds.length !== 0 ||
    compilation.document.steps.some(({ index }) => index >= 50) ||
    compilation.placementOrdinals.length !== 320 ||
    new Set(compilation.placementOrdinals).size !== 320 ||
    sortedPlacementOrdinals.some((ordinal, index) => ordinal !== index + 1) ||
    compilation.stateCommitments.length !== 51 ||
    compilation.stateCommitments.at(-1)?.completedPrintedStep !== 50 ||
    compilation.stateCommitments.at(-1)?.partCount !== 320 ||
    compilation.stateCommitments.at(-1)?.documentHash !== documentHash ||
    compilation.stateCommitments[45]?.documentHash !==
      compilation.step45RelationalEvidence.resultDocumentHash ||
    compilation.candidateStepCommitments.find(({ printedStepNumber }) => printedStepNumber === 45)
      ?.commitment !== compilation.step45RelationalEvidence.candidateStepCommitment ||
    compilation.step45RelationalEvidence.accounting.relationalResolverCallCount !== 1 ||
    compilation.step45RelationalEvidence.accounting.genericSearchCallCount !== 0 ||
    canonicalDigest(step45ReceiverPairs) !==
      canonicalDigest([
        [281, 265],
        [282, 261],
        [283, 264],
      ]) ||
    terminal.combinedDocumentHash !== documentHash ||
    terminal.step51Inspected !== false ||
    terminal.completionAuthority !== false ||
    blockingCodes.length !== 1 ||
    blockingCodes[0] !== "DISCONNECTED_ASSEMBLY" ||
    report.documentGloballyValid ||
    hasIncompleteValidation ||
    report.targetDocumentHash !== documentHash
  ) {
    throw new TypeError(
      "Prefix-50 incomplete-run boundary requires exact steps 1 through 50, 320 occurrences, zero-piece Step 44, no Step 51, and DISCONNECTED_ASSEMBLY as the sole complete terminal blocker.",
    );
  }
  const compilationCommitment = realBuildPrefix50ExactCompilationCommitment(compilation);
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-incomplete-run-boundary/2" as const,
    authority: "none" as const,
    completionAuthority: false as const,
    patchAuthority: false as const,
    userAcceptanceAuthority: false as const,
    sourceSetId: "6651557" as const,
    exactBoundary: "printed-steps-1-through-50-only" as const,
    printedStepRange: [1, 50] as const,
    step51Inspected: false as const,
    projectionCommitment: compilation.projectionCommitment,
    gaugeCommitment: compilation.gaugeCommitment,
    exactCompilationCommitment: compilationCommitment,
    terminalDetachedStateCommitment: terminal.commitment,
    step44SelectionEvidenceCommitment: compilation.step44SelectionEvidence.commitment,
    step45RelationalEvidenceCommitment: compilation.step45RelationalEvidence.commitment,
    step45ReceiverPairs: step45ReceiverPairs as unknown as readonly [
      readonly [281, 265],
      readonly [282, 261],
      readonly [283, 264],
    ],
    combinedDocumentHash: terminal.combinedDocumentHash,
    parentDocumentHash: terminal.parentDocumentHash,
    childDocumentHash: terminal.childDocumentHash,
    compiledPartCount: 320 as const,
    compiledStepCount: 50 as const,
    zeroPieceStepNumber: 44 as const,
    parentPartCount: 311 as const,
    childPartCount: 9 as const,
    childOccurrenceOrdinals: terminal.childOccurrenceOrdinals,
    combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"] as const,
    crossComponentConnectionCount: 0 as const,
    document: compilation.document,
    exactCompilation: compilation,
  });
  const { document: _document, exactCompilation: _exactCompilation, ...commitmentBody } = body;
  void _document;
  void _exactCompilation;
  const result = deepFreeze({
    ...body,
    commitment: canonicalDigest(commitmentBody),
  });
  SAFE_APPLY(SAFE_ADD, boundaries, [result]);
  return result;
}

export function requireRealBuildPrefix50IncompleteRunBoundary(
  value: unknown,
): RealBuildPrefix50IncompleteRunBoundary {
  if (value === null || typeof value !== "object" || !SAFE_APPLY(SAFE_HAS, boundaries, [value])) {
    throw new TypeError(
      "Prefix-50 replay requires the exact runtime-branded incomplete-run boundary; clones and final-candidate lookalikes are forbidden.",
    );
  }
  return value as RealBuildPrefix50IncompleteRunBoundary;
}
