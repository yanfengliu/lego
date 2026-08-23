import { describe, expect, it } from "vitest";

import { analyzeDepthCompositionEstimate } from "../e2e/real-build-step7-gate3-diagnostic-analysis";
import type { Step7Gate3BrowserResult } from "../e2e/real-build-step7-gate3-diagnostic-browser";

type RenderRow = Step7Gate3BrowserResult["renders"][number];

const scoreComponents: RenderRow["scoreComponents"] = {
  schemaVersion: "lego.step-delta-score/1",
  regionIou: null,
  strokeRecall: 1,
  boundaryPrecision: 1,
  strokeF1: 1,
  score: 1,
  basis: "stroke",
  candidateAreaPx: 1,
  candidateBoundaryPx: 1,
  strokePx: 1,
};

const row = (
  parentCandidateId: string,
  batchIndex: number,
  prefixDocumentHash: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId: string,
  probeMaskDigest: string,
): RenderRow => ({
  parentCandidateId,
  batchIndex,
  rowIndex: 0,
  prefixDocumentHash,
  catalogPartId,
  transform: { positionLdu, orientationId },
  score: 1,
  scoreComponents,
  probeMaskDigest,
});

describe("step-7 Gate-3 depth-composition analysis", () => {
  it("binds the sorted parent-ordinal candidate coordinates whose masks depend on context", () => {
    const result = {
      orderedParentIds: ["parent-a", "parent-b"],
      batches: [
        {
          parentCandidateId: "parent-a",
          batchIndex: 0,
          prefixDocumentHash: "prefix-a0",
          catalogPartId: "part-x",
          colorId: "red",
          offeredCount: 1,
        },
        {
          parentCandidateId: "parent-a",
          batchIndex: 1,
          prefixDocumentHash: "prefix-a1",
          catalogPartId: "part-x",
          colorId: "red",
          offeredCount: 1,
        },
        {
          parentCandidateId: "parent-a",
          batchIndex: 2,
          prefixDocumentHash: "prefix-a2",
          catalogPartId: "part-y",
          colorId: "red",
          offeredCount: 1,
        },
        {
          parentCandidateId: "parent-b",
          batchIndex: 0,
          prefixDocumentHash: "prefix-b0",
          catalogPartId: "part-z",
          colorId: "blue",
          offeredCount: 1,
        },
        {
          parentCandidateId: "parent-b",
          batchIndex: 1,
          prefixDocumentHash: "prefix-b1",
          catalogPartId: "part-z",
          colorId: "blue",
          offeredCount: 1,
        },
      ],
      renders: [
        row("parent-b", 1, "prefix-b1", "part-z", [4, 5, 6], "yaw90", "mask-e"),
        row("parent-b", 0, "prefix-b0", "part-z", [4, 5, 6], "yaw90", "mask-d"),
        row("parent-a", 2, "prefix-a2", "part-y", [9, 9, 9], "yaw0", "mask-c"),
        row("parent-a", 1, "prefix-a1", "part-x", [1, 2, 3], "yaw0", "mask-b"),
        row("parent-a", 0, "prefix-a0", "part-x", [1, 2, 3], "yaw0", "mask-a"),
      ],
    } as unknown as Step7Gate3BrowserResult;

    const estimate = analyzeDepthCompositionEstimate(result);
    expect(estimate).toMatchObject({
      candidateKeysWithContextDependentMasks: 2,
      contextDependentCandidateKeysDigest:
        "sha256:249269660d5b81e1a8a8e9bea463c89e9eeafaae0fd25f56542d12ca173cc29d",
    });
    expect(
      estimate.perParent.map(
        ({ contextDependentCandidateLayers }) => contextDependentCandidateLayers,
      ),
    ).toEqual([1, 1]);
  });
});
