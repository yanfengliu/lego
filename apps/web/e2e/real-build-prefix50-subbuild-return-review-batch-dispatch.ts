import { deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  type RealBuildPrefix50Step44BlindDispatchPlan,
  realBuildPrefix50Step44BlindId,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-replay.ts";
import type { RealBuildPrefix50Step44CandidateCaptureSummary } from "./real-build-prefix50-subbuild-return-review-capture.ts";
import type { RealBuildPrefix50Step44BatchCaptureRow } from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";

export interface RealBuildPrefix50Step44BlindBatchDispatchInput<T> {
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly capture: (input: {
    readonly blindId: `B${string}`;
    readonly batchIndex: number;
    readonly artifactDirectory: string;
    readonly envelope: ReturnType<typeof hydrateRealBuildPrefix50Step44ReviewEnvelope>;
  }) => Promise<RealBuildPrefix50Step44CandidateCaptureSummary>;
  readonly compose: (input: {
    readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
    readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  }) => Promise<T>;
}

export type RealBuildPrefix50Step44BlindBatchDispatchResult<T> = Readonly<{
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly composed: T;
}>;

async function dispatchRealBuildPrefix50Step44BlindBatchCore<T>(
  input: RealBuildPrefix50Step44BlindBatchDispatchInput<T>,
  captureCount: 3 | 211,
): Promise<
  Readonly<{
    readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
    readonly composed: T;
  }>
> {
  const { batch, plan } = input;
  if (
    batch.candidateCount !== 211 ||
    batch.candidates.length !== 211 ||
    plan.candidateCount !== 211 ||
    plan.assignments.length !== 211 ||
    plan.reviewBatchEnvelopeCommitment !== batch.commitment
  )
    throw new TypeError("Step-44 blind dispatch requires its exact committed 211-candidate batch.");
  const captures: RealBuildPrefix50Step44BatchCaptureRow[] = [];
  const seenBatchIndexes = new Set<number>();
  for (const [blindIndex, assignment] of plan.assignments.slice(0, captureCount).entries()) {
    const expectedBlindId = realBuildPrefix50Step44BlindId(blindIndex);
    const compact = batch.candidates[assignment.batchIndex];
    if (
      assignment.blindId !== expectedBlindId ||
      compact === undefined ||
      seenBatchIndexes.has(assignment.batchIndex)
    )
      throw new TypeError(
        `Step-44 blind dispatch assignment ${expectedBlindId} is missing, duplicated, or reordered.`,
      );
    seenBatchIndexes.add(assignment.batchIndex);
    const envelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
    const capture = await input.capture({
      blindId: expectedBlindId,
      batchIndex: assignment.batchIndex,
      artifactDirectory: expectedBlindId,
      envelope,
    });
    const roster = batch.rosterSummary.candidates[compact.rosterIndex]!;
    const driftedBindings = [
      [
        "schemaVersion",
        capture.schemaVersion === "lego.real-build-prefix50-step44-candidate-capture-summary/3",
      ],
      ["scene", capture.scene === "model-only"],
      ["candidateKey", capture.candidateKey === compact.candidateKey],
      ["selectedDocumentHash", capture.selectedDocumentHash === roster.selectedDocumentHash],
      [
        "selectedDocumentCommitment",
        capture.selectedDocumentCommitment === roster.selectedDocumentCommitment,
      ],
      [
        "reviewHarnessEnvelopeCommitment",
        capture.reviewHarnessEnvelopeCommitment === roster.reviewHarnessEnvelopeCommitment,
      ],
    ].flatMap(([label, matches]) => (matches ? [] : [label]));
    if (driftedBindings.length > 0)
      throw new TypeError(
        `Step-44 blind dispatch capture ${expectedBlindId} drifted from its hydrated envelope fields: ${driftedBindings.join(", ")}.`,
      );
    captures.push({
      blindId: expectedBlindId,
      batchIndex: assignment.batchIndex,
      artifactDirectory: expectedBlindId,
      rosterIndex: compact.rosterIndex,
      operationsCommitment: compact.operationsCommitment,
      compactCandidateCommitment: compact.commitment,
      ...capture,
    });
  }
  if (seenBatchIndexes.size !== captureCount)
    throw new TypeError(
      `Step-44 blind dispatch did not invoke its exact ${captureCount}-capture bound once per candidate.`,
    );
  const frozenCaptures = deepFreeze(captures);
  const composed = await input.compose({ plan, captures: frozenCaptures });
  return deepFreeze({ captures: frozenCaptures, composed });
}

export async function dispatchRealBuildPrefix50Step44BlindBatch<T>(
  input: RealBuildPrefix50Step44BlindBatchDispatchInput<T>,
): Promise<RealBuildPrefix50Step44BlindBatchDispatchResult<T>> {
  return dispatchRealBuildPrefix50Step44BlindBatchCore(input, 211);
}

async function dispatchFirstThreeForTest<T>(
  input: RealBuildPrefix50Step44BlindBatchDispatchInput<T>,
): Promise<RealBuildPrefix50Step44BlindBatchDispatchResult<T>> {
  if (process.env.NODE_ENV !== "test")
    throw new TypeError("Step-44 bounded blind dispatch is available only to the test runtime.");
  return dispatchRealBuildPrefix50Step44BlindBatchCore(input, 3);
}

export const realBuildPrefix50Step44BatchDispatchTestOnly = Object.freeze({
  dispatchFirstThree: dispatchFirstThreeForTest,
});
