import { createHash } from "node:crypto";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindReferenceReceipt,
  type RealBuildPrefix50Step44BlindReviewPacket,
  type RealBuildPrefix50Step44Page45CriterionId,
  type RealBuildPrefix50Step44ReviewOutcome,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract";
import { realBuildPrefix50Step44BlindPacketCoreCommitment } from "../e2e/real-build-prefix50-subbuild-return-review-blind-packet";
import { realBuildPrefix50Step44BlindId } from "../e2e/real-build-prefix50-subbuild-return-review-blind";

export function blindReviewTestDigest(label: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function commit<T extends object>(body: T): T & { readonly commitment: `sha256:${string}` } {
  return { ...body, commitment: canonicalDigest(body) };
}

export type DeepMutable<T> = T extends object
  ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
  : T;

export function recommitBlindReviewTestValue(value: {
  commitment: `sha256:${string}`;
  [key: string]: unknown;
}): void {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  value.commitment = canonicalDigest(body);
}

export interface BlindReviewTestPngMeasurement {
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
}

export interface BlindReviewTestPacketAssets {
  readonly rendererVersion?: string;
  readonly reviewIsolationInstructionDigest?: `sha256:${string}`;
  readonly reference?: BlindReviewTestPngMeasurement;
  readonly baseline?: BlindReviewTestPngMeasurement & { readonly byteLength: number };
  readonly after?: BlindReviewTestPngMeasurement;
  readonly canonicalView?: BlindReviewTestPngMeasurement;
  readonly delta?: BlindReviewTestPngMeasurement & {
    readonly changedPixelCount: number;
    readonly changedPixelBounds: Readonly<{
      readonly minX: number;
      readonly minY: number;
      readonly maxX: number;
      readonly maxY: number;
      readonly width: number;
      readonly height: number;
    }> | null;
  };
  readonly fullContactSheet?: BlindReviewTestPngMeasurement;
  readonly finalContactSheet?: BlindReviewTestPngMeasurement;
  readonly withheldUnblindingMapCommitment?: `sha256:${string}`;
}

export function createBlindReviewTestPacket(
  assets: BlindReviewTestPacketAssets = {},
): RealBuildPrefix50Step44BlindReviewPacket {
  const blindIds = Array.from({ length: 211 }, (_, index) => realBuildPrefix50Step44BlindId(index));
  const reference: RealBuildPrefix50Step44BlindReferenceReceipt = commit({
    schemaVersion: "lego.real-build-prefix50-step44-blind-reference/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    pageNumber: 45 as const,
    renderer: "poppler-pdftoppm" as const,
    rendererVersion: assets.rendererVersion ?? "24.08.0",
    densityDpi: 180 as const,
    sourcePagePngDigest: assets.reference?.pngDigest ?? blindReviewTestDigest("page-png"),
    sourcePagePixelDigest: assets.reference?.pixelDigest ?? blindReviewTestDigest("page-pixels"),
    x: 850 as const,
    y: 350 as const,
    width: 720 as const,
    height: 470 as const,
    artifactFile: "real-build-prefix50-step44-reference-page45-crop.png" as const,
    pngDigest: assets.reference?.pngDigest ?? blindReviewTestDigest("crop-png"),
    pixelDigest: assets.reference?.pixelDigest ?? blindReviewTestDigest("crop-pixels"),
  });
  const fixedCameraBaseline = commit({
    schemaVersion: "lego.real-build-prefix50-step43-blind-fixed-camera-baseline/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    scene: "model-only" as const,
    completedPrintedStep: 43 as const,
    artifactPath: "real-build-prefix50-step43-page45-fixed-camera-baseline.png" as const,
    page45CameraReceiptCommitment: blindReviewTestDigest("shared-page45-camera-receipt"),
    cameraCommitment: blindReviewTestDigest("shared-page45-camera"),
    fixedCameraBaselineCommitment: blindReviewTestDigest("shared-baseline-frame"),
    fixedCameraBaselineArtifactCommitment: blindReviewTestDigest("shared-baseline-artifact"),
    width: 720 as const,
    height: 470 as const,
    pngByteLength: assets.baseline?.byteLength ?? 1234,
    pngDigest: assets.baseline?.pngDigest ?? blindReviewTestDigest("shared-baseline-png"),
    pixelDigest: assets.baseline?.pixelDigest ?? blindReviewTestDigest("shared-baseline-pixels"),
  });
  const pages = Array.from({ length: 14 }, (_, pageIndex) => {
    const first = pageIndex * 16;
    const rowCount = Math.min(16, 211 - first);
    const rows = Array.from({ length: rowCount }, (_, localIndex) => {
      const blindId = blindIds[first + localIndex]!;
      const cells = REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS.map((cell, cellIndex) =>
        commit({
          blindId,
          fixtureKey: cell.fixtureKey,
          canonicalViewName: cell.canonicalViewName,
          artifactPath: `${blindId}/${cell.canonicalViewName}.png`,
          sourcePngDigest:
            (cellIndex === 0 ? assets.after : assets.canonicalView)?.pngDigest ??
            blindReviewTestDigest(`${blindId}-${cellIndex}-png`),
          sourcePixelDigest:
            (cellIndex === 0 ? assets.after : assets.canonicalView)?.pixelDigest ??
            blindReviewTestDigest(`${blindId}-${cellIndex}-pixels`),
          sourceWidth: cell.width,
          sourceHeight: cell.height,
          cameraCommitment:
            cellIndex === 0
              ? fixedCameraBaseline.cameraCommitment
              : blindReviewTestDigest(`${blindId}-${cellIndex}-camera`),
          sourceBindingCommitment: blindReviewTestDigest(`${blindId}-${cellIndex}-binding`),
        }),
      );
      const fixedCameraEvidence = commit({
        page45CameraReceiptCommitment: fixedCameraBaseline.page45CameraReceiptCommitment,
        fixedCameraBaselineCommitment: fixedCameraBaseline.fixedCameraBaselineCommitment,
        baselinePngDigest: fixedCameraBaseline.pngDigest,
        baselinePixelDigest: fixedCameraBaseline.pixelDigest,
        fixedCameraAfterCommitment: blindReviewTestDigest(`${blindId}-after`),
        afterPngDigest: assets.after?.pngDigest ?? blindReviewTestDigest(`${blindId}-after-png`),
        afterPixelDigest:
          assets.after?.pixelDigest ?? blindReviewTestDigest(`${blindId}-after-pixels`),
        fixedCameraDeltaCommitment: blindReviewTestDigest(`${blindId}-delta`),
        fixedCameraDeltaArtifactCommitment: blindReviewTestDigest(`${blindId}-delta-artifact`),
        deltaArtifactPath: `${blindId}/page45-fixed-camera-delta.png`,
        deltaPngDigest: assets.delta?.pngDigest ?? blindReviewTestDigest(`${blindId}-delta-png`),
        deltaPixelDigest:
          assets.delta?.pixelDigest ?? blindReviewTestDigest(`${blindId}-delta-pixels`),
        deltaWidth: 720 as const,
        deltaHeight: 470 as const,
        changedPixelCount: assets.delta?.changedPixelCount ?? 1,
        changedPixelBounds:
          assets.delta === undefined
            ? { minX: 3, minY: 4, maxX: 3, maxY: 4, width: 1, height: 1 }
            : assets.delta.changedPixelBounds,
      });
      return commit({ blindId, cells, fixedCameraEvidence });
    });
    return commit({
      schemaVersion: "lego.real-build-prefix50-step44-blind-contact-sheet-page/1" as const,
      authority: "none" as const,
      selectionAuthority: false as const,
      sourceSetId: "6651557" as const,
      pageNumber: pageIndex + 1,
      pageCount: 14,
      firstBlindId: blindIds[first]!,
      rowCount,
      cellRoster: REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS,
      width: 1_472,
      height: 230 + 120 * rowCount,
      artifactFile: `real-build-prefix50-step44-blind-contact-sheet-${String(pageIndex + 1).padStart(3, "0")}.png`,
      pngDigest:
        (pageIndex === 13 ? assets.finalContactSheet : assets.fullContactSheet)?.pngDigest ??
        blindReviewTestDigest(`page-${pageIndex}-png`),
      pixelDigest:
        (pageIndex === 13 ? assets.finalContactSheet : assets.fullContactSheet)?.pixelDigest ??
        blindReviewTestDigest(`page-${pageIndex}-pixels`),
      rows,
      referenceCommitment: reference.commitment,
    });
  });
  const finishedSheetVerifications = pages.map((page) =>
    commit({
      artifactFile: page.artifactFile,
      pageCommitment: page.commitment,
      pngDigest: page.pngDigest,
      pixelDigest: page.pixelDigest,
      width: page.width,
      height: page.height,
    }),
  );
  const core = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-review-packet/1" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    reviewIsolationInstructionFile: "REVIEW-INSTRUCTIONS.txt" as const,
    reviewIsolationInstructionDigest:
      assets.reviewIsolationInstructionDigest ?? blindReviewTestDigest("review-instructions"),
    candidateCount: 211 as const,
    blindIds,
    page45SourcePolicy: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    reference,
    fixedCameraBaseline,
    rowsPerPage: 16,
    pageCount: 14,
    pages,
    finishedSheetVerifications,
  };
  return commit({
    ...core,
    publicPacketCoreCommitment: canonicalDigest(core),
    withheldUnblindingMapCommitment:
      assets.withheldUnblindingMapCommitment ?? blindReviewTestDigest("withheld-map"),
  });
}

export function recommitBlindReviewTestPacket(
  packet: DeepMutable<RealBuildPrefix50Step44BlindReviewPacket>,
): void {
  recommitBlindReviewTestValue(packet.reference);
  recommitBlindReviewTestValue(packet.fixedCameraBaseline);
  for (const [pageIndex, page] of packet.pages.entries()) {
    for (const row of page.rows) {
      for (const cell of row.cells) recommitBlindReviewTestValue(cell);
      recommitBlindReviewTestValue(row.fixedCameraEvidence);
      recommitBlindReviewTestValue(row);
    }
    page.referenceCommitment = packet.reference.commitment;
    recommitBlindReviewTestValue(page);
    const finished = packet.finishedSheetVerifications[pageIndex]!;
    finished.pageCommitment = page.commitment;
    recommitBlindReviewTestValue(finished);
  }
  packet.publicPacketCoreCommitment = realBuildPrefix50Step44BlindPacketCoreCommitment(packet);
  recommitBlindReviewTestValue(packet);
}

export function blindReviewTestCriteria(
  outcome: RealBuildPrefix50Step44ReviewOutcome,
  note = "Visible page-45 comparison recorded.",
) {
  return REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA.map(({ id }) => ({
    criterionId: id as RealBuildPrefix50Step44Page45CriterionId,
    outcome,
    note,
  }));
}

export function createBlindReviewTestLaneRows(shortlist: readonly string[]) {
  return Array.from({ length: 211 }, (_, index) => {
    const blindId = realBuildPrefix50Step44BlindId(index);
    const outcome = shortlist.includes(blindId) ? "not-observable" : "different";
    return {
      blindId,
      criteria: blindReviewTestCriteria(outcome),
      shortlisted: outcome !== "different",
      shortlistNote:
        outcome === "different"
          ? "One or more page-45 observations differ."
          : "No page-45 criterion is observably different.",
    } as const;
  });
}

function sourceMap(blindPacket: RealBuildPrefix50Step44BlindReviewPacket) {
  return new Map(
    blindPacket.pages.flatMap((page) =>
      page.rows.map((row) => [
        row.blindId,
        {
          cells: row.cells.map(({ commitment }) => commitment),
          fixedCameraEvidenceCommitment: row.fixedCameraEvidence.commitment,
        },
      ]),
    ),
  );
}

export function createBlindReviewTestFullResolutionRows(
  blindPacket: RealBuildPrefix50Step44BlindReviewPacket,
  blindIds: readonly `B${string}`[],
  survivingBlindIds: readonly string[],
) {
  const sources = sourceMap(blindPacket);
  return blindIds.map((blindId) => ({
    blindId,
    reviewedCellCommitments: sources.get(blindId)!.cells as `sha256:${string}`[],
    reviewedFixedCameraEvidenceCommitment: sources.get(blindId)!
      .fixedCameraEvidenceCommitment as `sha256:${string}`,
    criteria: blindReviewTestCriteria(
      survivingBlindIds.includes(blindId) ? "same" : "not-observable",
    ),
    survives: survivingBlindIds.includes(blindId),
    note: survivingBlindIds.includes(blindId)
      ? "Every page-45 criterion is visibly the same."
      : "At least one page-45 criterion remains unreadable.",
  }));
}
