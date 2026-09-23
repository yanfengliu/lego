import { describe, expect, it } from "vitest";

import {
  __testOnly,
  requireRealBuildPrefix50SelectedSubBuildReturn,
  selectPersistedBlindReviewedRealBuildPrefix50SubBuildReturn,
  selectRepositoryReviewedRealBuildPrefix50SubBuildReturn,
} from "../e2e/real-build-prefix50-subbuild-return";
import { REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE } from "../e2e/real-build-prefix50-subbuild-return-review-fixture";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;

describe("prefix-50 Step 44 return selection authority", () => {
  it("pins the exact source boundary while honestly retaining no reviewed visual mint", () => {
    expect(REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE).toEqual(
      expect.objectContaining({
        schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1",
        reviewStatus: "unreviewed",
        authority: "none",
        sourceSetId: "6651557",
        source: {
          logicalPath: "recipes/6651557.pdf",
          digest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
          pageNumber: 45,
          structuralEventSequence: 8,
          structuralEventDigest:
            "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad",
          precedingPhaseSequence: 71,
          followingPhaseSequence: 72,
          firstChildOccurrenceOrdinal: 258,
          lastChildOccurrenceOrdinal: 280,
        },
        missingEvidence: [
          "exact-return-envelope-and-receipt-commitments",
          "exact-selected-candidate-and-document-hash",
          "verified-pdf-page-raster-and-panel-crop-bytes",
          "reviewed-seven-canonical-render-commitments",
        ],
      }),
    );
    expect(Object.isFrozen(REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE)).toBe(true);
    expect(Object.isFrozen(REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE.source)).toBe(true);
    expect(__testOnly).not.toHaveProperty("mintReviewedVisualBindingForTest");
    expect(__testOnly).toHaveProperty("selectWithReviewedFixtureForTest");
  });

  it("rejects raw digest-shaped results and caller-provided visual evidence", () => {
    const rawResult = {
      schemaVersion: "lego.real-build-prefix50-subbuild-return/1",
      authority: "none",
      candidateRoster: [{ candidateKey: "a".repeat(64) }],
      enumeration: { counts: { accepted: 1 }, candidates: [{}] },
      commitment: digest("1"),
    };
    expect(() => selectRepositoryReviewedRealBuildPrefix50SubBuildReturn(rawResult)).toThrow(
      /runtime-branded enumeration receipt/u,
    );
    expect(() =>
      selectPersistedBlindReviewedRealBuildPrefix50SubBuildReturn({
        result: structuredClone(rawResult),
        layout: {
          reviewRoot: "review",
          publicRoot: "review/public",
          laneARoot: "review/lane-a",
          laneBRoot: "review/lane-b",
          fullResolutionRoot: "review/full-resolution",
          closureRoot: "review/closure",
          promotionRoot: "review/promotion",
        },
        withheldRoot: "review/withheld",
        repositoryRoot: ".",
        batch: {} as never,
        realDomainQualification: {} as never,
      }),
    ).toThrow(/runtime-branded enumeration receipt/u);

    const callWithEvidence = selectRepositoryReviewedRealBuildPrefix50SubBuildReturn as unknown as (
      result: unknown,
      evidence: unknown,
    ) => unknown;
    expect(() =>
      callWithEvidence(rawResult, {
        sourcePdfDigest: digest("2"),
        panelPageNumber: 45,
        panelCropDigest: digest("3"),
        renderCommitments: {
          canonicalIsometric: digest("4"),
          frontOrthographic: digest("5"),
          sideOrthographic: digest("6"),
        },
      }),
    ).toThrow(/does not accept caller-provided visual evidence/u);
  });

  it("rejects a selected-return lookalike carrying a mutated document", () => {
    expect(() =>
      requireRealBuildPrefix50SelectedSubBuildReturn({
        schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1",
        authority: "none",
        sourceSetId: "6651557",
        selectedDocumentHash: digest("7"),
        selectedDocument: { name: "caller-mutated" },
      }),
    ).toThrow(/runtime-branded selected receipt/u);
  });
});
