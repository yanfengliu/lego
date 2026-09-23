import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
  REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const POPPLER_RENDERER_VERSION = /^[0-9]+(?:\.[0-9]+)+$/u;
const ROWS_PER_PAGE = 16;
const EXPECTED_PAGE_COUNT = 14;
const EXPECTED_PAGE_WIDTH = 1_472;
const HEADER_HEIGHT = 230;
const ROW_HEIGHT = 120;

function realBuildPrefix50Step44BlindId(index: number): `B${string}` {
  return `B${String(index + 1).padStart(3, "0")}`;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function realBuildPrefix50Step44BlindPacketCoreCommitment(
  value: object,
): `sha256:${string}` {
  const core = withoutCommitment(value);
  Reflect.deleteProperty(core, "publicPacketCoreCommitment");
  Reflect.deleteProperty(core, "withheldUnblindingMapCommitment");
  return canonicalDigest(core);
}

function requireSha(value: string, label: string): void {
  if (!SHA256.test(value)) throw new TypeError(`${label} must be one lowercase SHA-256 digest.`);
}

export function requireRealBuildPrefix50Step44BlindReviewPacket(
  packet: RealBuildPrefix50Step44BlindReviewPacket,
): void {
  exactKeys(
    packet,
    [
      "authority",
      "blindIds",
      "candidateCount",
      "commitment",
      "finishedSheetVerifications",
      "fixedCameraBaseline",
      "fixturePromotionAuthority",
      "page45SourcePolicy",
      "page45SourcePolicyCommitment",
      "publicPacketCoreCommitment",
      "pageCount",
      "pages",
      "reference",
      "reviewIsolationInstructionDigest",
      "reviewIsolationInstructionFile",
      "rowsPerPage",
      "schemaVersion",
      "selectionAuthority",
      "sourceSetId",
      "withheldUnblindingMapCommitment",
    ],
    "Step-44 blind packet",
  );
  if (
    packet.schemaVersion !== "lego.real-build-prefix50-step44-blind-review-packet/1" ||
    packet.authority !== "none" ||
    packet.selectionAuthority !== false ||
    packet.fixturePromotionAuthority !== false ||
    packet.sourceSetId !== "6651557" ||
    packet.reviewIsolationInstructionFile !== "REVIEW-INSTRUCTIONS.txt" ||
    packet.candidateCount !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT ||
    packet.rowsPerPage !== ROWS_PER_PAGE ||
    packet.pageCount !== EXPECTED_PAGE_COUNT ||
    packet.pages.length !== EXPECTED_PAGE_COUNT ||
    packet.finishedSheetVerifications.length !== EXPECTED_PAGE_COUNT ||
    packet.blindIds.length !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT ||
    packet.blindIds.some((id, index) => id !== realBuildPrefix50Step44BlindId(index)) ||
    canonicalStringify(packet.page45SourcePolicy) !==
      canonicalStringify(REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY) ||
    packet.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    packet.publicPacketCoreCommitment !==
      realBuildPrefix50Step44BlindPacketCoreCommitment(packet) ||
    packet.commitment !== canonicalDigest(withoutCommitment(packet))
  )
    throw new TypeError(
      "Step-44 blind packet header, exact 211 roster, page-45 policy, or self commitment drifted.",
    );
  requireSha(packet.withheldUnblindingMapCommitment, "Step-44 withheld map commitment");
  requireSha(
    packet.reviewIsolationInstructionDigest,
    "Step-44 review-isolation instruction digest",
  );
  const reference = packet.reference;
  exactKeys(
    reference,
    [
      "artifactFile",
      "authority",
      "commitment",
      "densityDpi",
      "height",
      "pageNumber",
      "pixelDigest",
      "pngDigest",
      "renderer",
      "rendererVersion",
      "schemaVersion",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "sourcePagePixelDigest",
      "sourcePagePngDigest",
      "sourceSetId",
      "width",
      "x",
      "y",
    ],
    "Step-44 blind packet reference",
  );
  for (const field of [
    "sourcePagePngDigest",
    "sourcePagePixelDigest",
    "sourcePdfDigest",
    "pngDigest",
    "pixelDigest",
    "commitment",
  ] as const)
    requireSha(String(reference[field]), `Step-44 reference ${field}`);
  if (
    reference.schemaVersion !== "lego.real-build-prefix50-step44-blind-reference/1" ||
    reference.authority !== "none" ||
    reference.sourceSetId !== "6651557" ||
    reference.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    reference.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
    reference.pageNumber !== 45 ||
    reference.renderer !== "poppler-pdftoppm" ||
    reference.densityDpi !== 180 ||
    reference.width !== 720 ||
    reference.height !== 470 ||
    reference.x !== 850 ||
    reference.y !== 350 ||
    reference.artifactFile !== "real-build-prefix50-step44-reference-page45-crop.png" ||
    !POPPLER_RENDERER_VERSION.test(reference.rendererVersion) ||
    reference.commitment !== canonicalDigest(withoutCommitment(reference))
  )
    throw new TypeError("Step-44 blind packet reference is not the exact page-45 crop contract.");
  const baseline = packet.fixedCameraBaseline;
  exactKeys(
    baseline,
    [
      "artifactPath",
      "authority",
      "cameraCommitment",
      "commitment",
      "completedPrintedStep",
      "fixedCameraBaselineCommitment",
      "fixedCameraBaselineArtifactCommitment",
      "height",
      "page45CameraReceiptCommitment",
      "pixelDigest",
      "pngByteLength",
      "pngDigest",
      "scene",
      "schemaVersion",
      "sourceSetId",
      "width",
    ],
    "Step-44 blind fixed-camera baseline",
  );
  for (const digest of [
    baseline.page45CameraReceiptCommitment,
    baseline.cameraCommitment,
    baseline.fixedCameraBaselineCommitment,
    baseline.fixedCameraBaselineArtifactCommitment,
    baseline.pngDigest,
    baseline.pixelDigest,
    baseline.commitment,
  ])
    requireSha(digest, "Step-44 blind fixed-camera baseline digest");
  if (
    baseline.schemaVersion !== "lego.real-build-prefix50-step43-blind-fixed-camera-baseline/1" ||
    baseline.authority !== "none" ||
    baseline.sourceSetId !== "6651557" ||
    baseline.scene !== "model-only" ||
    baseline.completedPrintedStep !== 43 ||
    baseline.artifactPath !== "real-build-prefix50-step43-page45-fixed-camera-baseline.png" ||
    baseline.width !== 720 ||
    baseline.height !== 470 ||
    !Number.isSafeInteger(baseline.pngByteLength) ||
    baseline.pngByteLength < 1 ||
    baseline.pngByteLength > 16 * 1024 * 1024 ||
    baseline.commitment !== canonicalDigest(withoutCommitment(baseline))
  )
    throw new TypeError("Step-44 blind fixed-camera baseline contract drifted.");
  let expectedBlindIndex = 0;
  for (const [pageIndex, page] of packet.pages.entries()) {
    exactKeys(
      page,
      [
        "artifactFile",
        "authority",
        "commitment",
        "firstBlindId",
        "height",
        "pageCount",
        "pageNumber",
        "pixelDigest",
        "pngDigest",
        "referenceCommitment",
        "rowCount",
        "rows",
        "schemaVersion",
        "selectionAuthority",
        "sourceSetId",
        "cellRoster",
        "width",
      ],
      `Step-44 blind packet page ${pageIndex + 1}`,
    );
    const expectedRows = Math.min(
      ROWS_PER_PAGE,
      REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT - pageIndex * ROWS_PER_PAGE,
    );
    if (
      page.schemaVersion !== "lego.real-build-prefix50-step44-blind-contact-sheet-page/1" ||
      page.authority !== "none" ||
      page.selectionAuthority !== false ||
      page.sourceSetId !== "6651557" ||
      page.pageNumber !== pageIndex + 1 ||
      page.pageCount !== EXPECTED_PAGE_COUNT ||
      page.firstBlindId !== realBuildPrefix50Step44BlindId(expectedBlindIndex) ||
      page.rowCount !== expectedRows ||
      page.rows.length !== expectedRows ||
      page.width !== EXPECTED_PAGE_WIDTH ||
      page.height !== HEADER_HEIGHT + ROW_HEIGHT * expectedRows ||
      page.artifactFile !==
        `real-build-prefix50-step44-blind-contact-sheet-${String(pageIndex + 1).padStart(3, "0")}.png` ||
      page.referenceCommitment !== reference.commitment ||
      canonicalStringify(page.cellRoster) !==
        canonicalStringify(REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS) ||
      page.commitment !== canonicalDigest(withoutCommitment(page))
    )
      throw new TypeError(`Step-44 blind packet page ${pageIndex + 1} contract drifted.`);
    requireSha(page.pngDigest, `Step-44 blind page ${pageIndex + 1} PNG digest`);
    requireSha(page.pixelDigest, `Step-44 blind page ${pageIndex + 1} pixel digest`);
    for (const row of page.rows) {
      exactKeys(
        row,
        ["blindId", "cells", "commitment", "fixedCameraEvidence"],
        `Step-44 ${row.blindId} row`,
      );
      const expectedBlindId = realBuildPrefix50Step44BlindId(expectedBlindIndex);
      if (
        row.blindId !== expectedBlindId ||
        row.cells.length !== REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS.length ||
        row.commitment !== canonicalDigest(withoutCommitment(row))
      )
        throw new TypeError(`Step-44 blind packet row ${expectedBlindId} contract drifted.`);
      for (const [cellIndex, cell] of row.cells.entries()) {
        exactKeys(
          cell,
          [
            "blindId",
            "artifactPath",
            "cameraCommitment",
            "canonicalViewName",
            "commitment",
            "fixtureKey",
            "sourceBindingCommitment",
            "sourceHeight",
            "sourcePixelDigest",
            "sourcePngDigest",
            "sourceWidth",
          ],
          `Step-44 ${expectedBlindId} source cell ${cellIndex + 1}`,
        );
        const expectedView = REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS[cellIndex]!;
        if (
          cell.blindId !== expectedBlindId ||
          cell.artifactPath !== `${expectedBlindId}/${expectedView.canonicalViewName}.png` ||
          cell.fixtureKey !== expectedView.fixtureKey ||
          cell.canonicalViewName !== expectedView.canonicalViewName ||
          cell.sourceWidth !== expectedView.width ||
          cell.sourceHeight !== expectedView.height ||
          cell.commitment !== canonicalDigest(withoutCommitment(cell))
        )
          throw new TypeError(`Step-44 ${expectedBlindId} source cell ${cellIndex + 1} drifted.`);
        for (const digest of [
          cell.sourcePngDigest,
          cell.sourcePixelDigest,
          cell.cameraCommitment,
          cell.sourceBindingCommitment,
          cell.commitment,
        ])
          requireSha(digest, `Step-44 ${expectedBlindId} source cell digest`);
      }
      const fixed = row.fixedCameraEvidence;
      exactKeys(
        fixed,
        [
          "afterPixelDigest",
          "afterPngDigest",
          "baselinePixelDigest",
          "baselinePngDigest",
          "changedPixelBounds",
          "changedPixelCount",
          "commitment",
          "deltaArtifactPath",
          "deltaHeight",
          "deltaPixelDigest",
          "deltaPngDigest",
          "deltaWidth",
          "fixedCameraAfterCommitment",
          "fixedCameraBaselineCommitment",
          "fixedCameraDeltaArtifactCommitment",
          "fixedCameraDeltaCommitment",
          "page45CameraReceiptCommitment",
        ],
        `Step-44 ${expectedBlindId} fixed-camera evidence`,
      );
      for (const digest of [
        fixed.page45CameraReceiptCommitment,
        fixed.fixedCameraBaselineCommitment,
        fixed.baselinePngDigest,
        fixed.baselinePixelDigest,
        fixed.fixedCameraAfterCommitment,
        fixed.afterPngDigest,
        fixed.afterPixelDigest,
        fixed.fixedCameraDeltaCommitment,
        fixed.fixedCameraDeltaArtifactCommitment,
        fixed.deltaPngDigest,
        fixed.deltaPixelDigest,
        fixed.commitment,
      ])
        requireSha(digest, `Step-44 ${expectedBlindId} fixed-camera digest`);
      const bounds = fixed.changedPixelBounds;
      if (
        !Number.isSafeInteger(fixed.changedPixelCount) ||
        fixed.changedPixelCount < 0 ||
        fixed.deltaArtifactPath !== `${expectedBlindId}/page45-fixed-camera-delta.png` ||
        fixed.deltaWidth !== 720 ||
        fixed.deltaHeight !== 470 ||
        fixed.page45CameraReceiptCommitment !== baseline.page45CameraReceiptCommitment ||
        fixed.fixedCameraBaselineCommitment !== baseline.fixedCameraBaselineCommitment ||
        fixed.baselinePngDigest !== baseline.pngDigest ||
        fixed.baselinePixelDigest !== baseline.pixelDigest ||
        row.cells[0]?.cameraCommitment !== baseline.cameraCommitment ||
        (fixed.changedPixelCount === 0) !== (bounds === null) ||
        (bounds !== null &&
          (!Number.isSafeInteger(bounds.minX) ||
            !Number.isSafeInteger(bounds.minY) ||
            !Number.isSafeInteger(bounds.maxX) ||
            !Number.isSafeInteger(bounds.maxY) ||
            bounds.minX < 0 ||
            bounds.minY < 0 ||
            bounds.maxX >= 720 ||
            bounds.maxY >= 470 ||
            bounds.minX > bounds.maxX ||
            bounds.minY > bounds.maxY ||
            bounds.width !== bounds.maxX - bounds.minX + 1 ||
            bounds.height !== bounds.maxY - bounds.minY + 1)) ||
        fixed.commitment !== canonicalDigest(withoutCommitment(fixed))
      )
        throw new TypeError(`Step-44 ${expectedBlindId} fixed-camera evidence drifted.`);
      expectedBlindIndex += 1;
    }
    const verification = packet.finishedSheetVerifications[pageIndex]!;
    exactKeys(
      verification,
      [
        "artifactFile",
        "commitment",
        "height",
        "pageCommitment",
        "pixelDigest",
        "pngDigest",
        "width",
      ],
      `Step-44 finished sheet verification ${pageIndex + 1}`,
    );
    if (
      verification.artifactFile !== page.artifactFile ||
      verification.pageCommitment !== page.commitment ||
      verification.pngDigest !== page.pngDigest ||
      verification.pixelDigest !== page.pixelDigest ||
      verification.width !== page.width ||
      verification.height !== page.height ||
      verification.commitment !== canonicalDigest(withoutCommitment(verification))
    )
      throw new TypeError(`Step-44 finished sheet verification ${pageIndex + 1} drifted.`);
  }
  if (expectedBlindIndex !== REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT)
    throw new TypeError("Step-44 blind packet pages do not cover exact B001..B211 once.");
}
