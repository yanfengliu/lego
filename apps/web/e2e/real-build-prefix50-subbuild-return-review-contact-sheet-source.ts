import { basename } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";
import { CANONICAL_CAPTURE_POLICY, CANONICAL_CAPTURE_POLICY_HASH } from "@lego-studio/rendering";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type {
  RealBuildPrefix50Step44CaptureManifest,
  RealBuildPrefix50Step44CaptureManifestV3,
} from "./real-build-prefix50-subbuild-return-review-artifact-contract.ts";
import {
  sha256RealBuildPrefix50Step44BlindBytes,
  type RealBuildPrefix50Step44BlindDispatchPlan,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import type { RealBuildPrefix50Step44BlindSourceCell } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-replay.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { verifyRealBuildPrefix50Step44ContactSheetCameraBindings } from "./real-build-prefix50-subbuild-return-review-contact-sheet-camera.ts";
import { verifyRealBuildPrefix50Step44SharedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-contact-sheet-camera-attempt.ts";
import type { RealBuildPrefix50Step44VerifiedPersistedCameraAttempt } from "./real-build-prefix50-subbuild-return-review-camera-attempt.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { requireRealBuildPrefix50Step44ProductionCaptureContract } from "./real-build-prefix50-subbuild-return-review-contact-sheet-capture-contract.ts";
import type {
  RealBuildPrefix50Step44BatchCaptureRow,
  RealBuildPrefix50Step44VerifiedCaptureRow,
} from "./real-build-prefix50-subbuild-return-review-contact-sheet-source-contract.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";
import { requireRealBuildPrefix50ExactKeys as exactKeys } from "./real-build-prefix50-subbuild-return-validation-primitives.ts";

export type {
  RealBuildPrefix50Step44BatchCaptureRow,
  RealBuildPrefix50Step44VerifiedCaptureRow,
} from "./real-build-prefix50-subbuild-return-review-contact-sheet-source-contract.ts";

export interface RealBuildPrefix50Step44VerifiedContactSheetSources {
  readonly rows: readonly RealBuildPrefix50Step44VerifiedCaptureRow[];
  readonly verifiedCameraAttempt: RealBuildPrefix50Step44VerifiedPersistedCameraAttempt;
}

const MAXIMUM_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_PNG_BYTES = CANONICAL_CAPTURE_POLICY.maxArtifactBytes;
function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}
function exactViewKeys(value: object, label: string): void {
  const actual = Object.keys(value).sort();
  const expected = REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(
    ({ fixtureKey }) => fixtureKey,
  ).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new TypeError(`${label} must contain the exact seven-view roster.`);
}

function parseCanonicalCaptureManifest(
  bytes: Uint8Array,
): RealBuildPrefix50Step44CaptureManifest | RealBuildPrefix50Step44CaptureManifestV3 {
  const text = Buffer.from(bytes).toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    canonicalStringify(value) !== text
  )
    throw new TypeError(
      "Step-44 contact-sheet capture manifest must use exact canonical JSON bytes.",
    );
  return value as RealBuildPrefix50Step44CaptureManifest | RealBuildPrefix50Step44CaptureManifestV3;
}

function exactBlindId(index: number): `B${string}` {
  return `B${String(index + 1).padStart(3, "0")}`;
}

export async function verifyRealBuildPrefix50Step44ContactSheetSources(input: {
  readonly outputPath: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly expectedInputBytesHash?: `sha256:${string}`;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly page45Reference: Readonly<{
    readonly rendererVersion: string;
    readonly sourcePdfDigest: `sha256:${string}`;
    readonly sourcePagePngDigest: `sha256:${string}`;
    readonly sourcePagePixelDigest: `sha256:${string}`;
    readonly pixelDigest: `sha256:${string}`;
  }>;
}): Promise<RealBuildPrefix50Step44VerifiedContactSheetSources> {
  const { outputPath, batch, plan, captures } = input;
  if (
    plan.reviewBatchEnvelopeCommitment !== batch.commitment ||
    plan.assignments.length !== captures.length ||
    captures.length !== 211 ||
    captures.some((capture, index) => capture.blindId !== exactBlindId(index))
  )
    throw new TypeError("Step-44 contact sheets require the exact committed B001..B211 dispatch.");
  const verified = [];
  let verifiedSharedCameraAttempt:
    RealBuildPrefix50Step44VerifiedPersistedCameraAttempt | undefined;
  for (const [blindIndex, capture] of captures.entries()) {
    const assignment = plan.assignments[blindIndex]!;
    const compact = batch.candidates[capture.batchIndex];
    if (compact === undefined)
      throw new TypeError(
        `Step-44 ${capture.blindId} batch index is outside the candidate roster.`,
      );
    const roster = batch.rosterSummary.candidates[compact.rosterIndex]!;
    const envelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
    if (
      assignment.blindId !== capture.blindId ||
      assignment.batchIndex !== capture.batchIndex ||
      capture.artifactDirectory !== capture.blindId ||
      basename(capture.captureManifestFile) !== capture.captureManifestFile ||
      capture.rosterIndex !== compact.rosterIndex ||
      capture.operationsCommitment !== compact.operationsCommitment ||
      capture.compactCandidateCommitment !== compact.commitment ||
      capture.candidateKey !== compact.candidateKey ||
      capture.selectedDocumentHash !== roster.selectedDocumentHash ||
      capture.selectedDocumentCommitment !== roster.selectedDocumentCommitment ||
      capture.reviewHarnessEnvelopeCommitment !== envelope.commitment
    )
      throw new TypeError(
        `Step-44 ${capture.blindId} summary drifted from its exact batch envelope.`,
      );
    const manifestBytes = readRealBuildPrefix50Step44ReviewArtifact(
      outputPath,
      `${capture.artifactDirectory}/${capture.captureManifestFile}`,
      MAXIMUM_MANIFEST_BYTES,
      `Step-44 ${capture.blindId} capture manifest`,
    );
    const manifest = parseCanonicalCaptureManifest(manifestBytes);
    const manifestVersion = manifest.schemaVersion;
    exactKeys(
      manifest,
      [
        "authority",
        "browserVersion",
        "buildStepCount",
        "candidateKey",
        "candidateRosterCommitment",
        "canonicalCapturePolicy",
        "canonicalCapturePolicyHash",
        "captureScene",
        "captureSceneCommitment",
        "captures",
        "childSubBuildWindowCommitment",
        "commitment",
        "detachedStateCommitment",
        "fixedCameraAfter",
        "fixedCameraBaselineArtifact",
        "fixedCameraBaselineCommitment",
        "fixedCameraDelta",
        "fixedCameraDeltaArtifact",
        "fixturePromotionAuthority",
        "inputBytesHash",
        "page45CameraReceipt",
        "page45CameraReceiptCommitment",
        "partCount",
        "projectionCommitment",
        "renderPacket",
        "renderPacketCommitment",
        "returnResultCommitment",
        "reviewHarnessEnvelopeCommitment",
        "reviewStatus",
        "schemaVersion",
        "selectedDocumentCommitment",
        "selectedDocumentHash",
        "selectionAuthority",
        "sourceDocumentHash",
        "sourceMemberRowsCommitment",
        "sourceSetId",
        "step42_43RepairCommitment",
        "step43PredecessorCommitment",
        "userAgent",
        "viewPacket",
        "viewPacketCommitment",
      ],
      `Step-44 ${capture.blindId} capture manifest`,
    );
    exactKeys(
      manifest.renderPacket,
      [
        "authority",
        "capturePolicyHash",
        "capturesCommitment",
        "commitment",
        "documentHash",
        "rendererSnapshot",
        "rendererSnapshotCommitment",
        "schemaVersion",
        "validationReport",
        "validationReportCommitment",
        "viewPacketCommitment",
      ],
      `Step-44 ${capture.blindId} render packet`,
    );
    if (
      manifestVersion !== "lego.real-build-prefix50-subbuild-return-review-capture/3" ||
      capture.captureManifestByteDigest !==
        sha256RealBuildPrefix50Step44BlindBytes(manifestBytes) ||
      capture.captureManifestCommitment !== manifest.commitment ||
      manifest.commitment !== canonicalDigest(withoutCommitment(manifest)) ||
      manifest.authority !== "none" ||
      manifest.selectionAuthority !== false ||
      manifest.fixturePromotionAuthority !== false ||
      manifest.reviewStatus !== "unreviewed" ||
      manifest.reviewHarnessEnvelopeCommitment !== envelope.commitment ||
      manifest.returnResultCommitment !== batch.returnResultCommitment ||
      manifest.candidateRosterCommitment !== batch.candidateRosterCommitment ||
      manifest.projectionCommitment !== batch.projectionCommitment ||
      manifest.childSubBuildWindowCommitment !== batch.childSubBuildWindowCommitment ||
      manifest.sourceMemberRowsCommitment !== batch.sourceMemberRowsCommitment ||
      manifest.detachedStateCommitment !== batch.detachedStateCommitment ||
      manifest.step42_43RepairCommitment !== batch.step42_43RepairCommitment ||
      manifest.step43PredecessorCommitment !== batch.step43PredecessorCommitment ||
      manifest.sourceDocumentHash !== batch.sourceDocumentHash ||
      manifest.candidateKey !== compact.candidateKey ||
      manifest.selectedDocumentHash !== roster.selectedDocumentHash ||
      manifest.selectedDocumentCommitment !== roster.selectedDocumentCommitment ||
      manifest.viewPacketCommitment !== canonicalDigest(manifest.viewPacket) ||
      manifest.viewPacket.documentHash !== roster.selectedDocumentHash ||
      manifest.renderPacketCommitment !== manifest.renderPacket.commitment ||
      manifest.renderPacket.commitment !==
        canonicalDigest(withoutCommitment(manifest.renderPacket)) ||
      manifest.renderPacket.documentHash !== roster.selectedDocumentHash ||
      manifest.renderPacket.viewPacketCommitment !== manifest.viewPacketCommitment ||
      manifest.renderPacket.capturesCommitment !== canonicalDigest(manifest.captures) ||
      capture.viewPacketCommitment !== manifest.viewPacketCommitment ||
      capture.renderPacketCommitment !== manifest.renderPacketCommitment
    )
      throw new TypeError(
        `Step-44 ${capture.blindId} manifest bytes, self commitment, candidate, envelope, or render binding drifted.`,
      );
    const v3 = manifest as RealBuildPrefix50Step44CaptureManifestV3;
    if (input.expectedInputBytesHash !== undefined)
      requireRealBuildPrefix50Step44ProductionCaptureContract({
        manifest: v3,
        expectedInputBytesHash: input.expectedInputBytesHash,
        selectedDocumentHash: roster.selectedDocumentHash,
      });
    verifiedSharedCameraAttempt ??= verifyRealBuildPrefix50Step44SharedPersistedCameraAttempt({
      outputPath,
      blindId: capture.blindId,
      batch,
      receipt: v3.page45CameraReceipt,
      realDomainQualification: input.realDomainQualification,
    });
    exactKeys(
      v3.fixedCameraBaselineArtifact,
      [
        "artifactFile",
        "authority",
        "baselineFrameCommitment",
        "cameraCommitment",
        "commitment",
        "height",
        "page45CameraReceiptCommitment",
        "pixelDigest",
        "pngByteLength",
        "pngDigest",
        "scene",
        "schemaVersion",
        "width",
      ],
      `Step-44 ${capture.blindId} fixed-camera baseline artifact`,
    );
    if (
      v3.fixedCameraBaselineArtifact.schemaVersion !==
        "lego.real-build-prefix50-step43-fixed-camera-baseline-artifact/1" ||
      v3.fixedCameraBaselineArtifact.authority !== "none" ||
      v3.fixedCameraBaselineArtifact.scene !== "model-only" ||
      v3.fixedCameraBaselineArtifact.artifactFile !==
        "real-build-prefix50-step44-page45-camera-selected-parent.png" ||
      v3.fixedCameraBaselineArtifact.page45CameraReceiptCommitment !==
        v3.page45CameraReceiptCommitment ||
      v3.fixedCameraBaselineArtifact.cameraCommitment !==
        v3.page45CameraReceipt.selectedCameraCommitment ||
      v3.fixedCameraBaselineArtifact.baselineFrameCommitment !== v3.fixedCameraBaselineCommitment ||
      v3.fixedCameraBaselineArtifact.width !== 720 ||
      v3.fixedCameraBaselineArtifact.height !== 470 ||
      v3.fixedCameraBaselineArtifact.pngDigest !== v3.page45CameraReceipt.selectedParentPngDigest ||
      v3.fixedCameraBaselineArtifact.pixelDigest !==
        v3.page45CameraReceipt.selectedParentPixelDigest ||
      v3.fixedCameraBaselineArtifact.commitment !==
        canonicalDigest(withoutCommitment(v3.fixedCameraBaselineArtifact)) ||
      capture.fixedCameraBaselineArtifactCommitment !== v3.fixedCameraBaselineArtifact.commitment
    )
      throw new TypeError(
        `Step-44 ${capture.blindId} fixed-camera baseline artifact binding drifted.`,
      );
    verifyRealBuildPrefix50Step44ContactSheetCameraBindings({
      outputPath,
      blindId: capture.blindId,
      artifactDirectory: capture.artifactDirectory,
      batch,
      capture,
      manifest: v3,
      candidateKey: compact.candidateKey,
      selectedDocumentHash: roster.selectedDocumentHash,
      selectedDocumentCommitment: roster.selectedDocumentCommitment,
      reviewHarnessEnvelopeCommitment: envelope.commitment,
      verifiedSharedCameraAttempt,
      page45Reference: input.page45Reference,
    });
    exactViewKeys(manifest.captures, `Step-44 ${capture.blindId} capture manifest`);
    exactViewKeys(capture.cameraCommitments, `Step-44 ${capture.blindId} camera summary`);
    const cells: RealBuildPrefix50Step44BlindSourceCell[] = [];
    for (const {
      fixtureKey,
      reviewedView,
      canonicalViewName,
    } of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS) {
      const row = manifest.captures[fixtureKey];
      const view = manifest.viewPacket.views.find(({ name }) => name === canonicalViewName);
      if (row === undefined || view === undefined)
        throw new TypeError(`Step-44 ${capture.blindId} omitted ${canonicalViewName}.`);
      exactKeys(
        row,
        [
          "artifactFile",
          "cameraCommitment",
          "candidateKey",
          "canonicalViewName",
          "height",
          "pixelDigest",
          "pngDigest",
          "reviewNote",
          "reviewOutcome",
          "scene",
          "selectedDocumentHash",
          "view",
          "width",
        ],
        `Step-44 ${capture.blindId} ${canonicalViewName} capture row`,
      );
      const expectedFile = `real-build-prefix50-step44-${reviewedView}.png`;
      const expectedCameraCommitment = canonicalDigest({
        capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
        viewPacketCommitment: manifest.viewPacketCommitment,
        view,
      });
      const bytes = readRealBuildPrefix50Step44ReviewArtifact(
        outputPath,
        `${capture.artifactDirectory}/${row.artifactFile}`,
        MAXIMUM_PNG_BYTES,
        `Step-44 ${capture.blindId} ${reviewedView}`,
      );
      const decoded = decodeRealBuildPrefix50Step44ReviewPng(
        bytes,
        CANONICAL_CAPTURE_POLICY.width * CANONICAL_CAPTURE_POLICY.height,
        `Step-44 ${capture.blindId} ${reviewedView}`,
      );
      if (
        row.artifactFile !== expectedFile ||
        row.scene !== "model-only" ||
        basename(row.artifactFile) !== row.artifactFile ||
        row.view !== reviewedView ||
        row.canonicalViewName !== canonicalViewName ||
        row.candidateKey !== compact.candidateKey ||
        row.selectedDocumentHash !== roster.selectedDocumentHash ||
        row.cameraCommitment !== expectedCameraCommitment ||
        capture.cameraCommitments[fixtureKey] !== expectedCameraCommitment ||
        row.pngDigest !== sha256RealBuildPrefix50Step44BlindBytes(bytes) ||
        row.pixelDigest !== sha256RealBuildPrefix50Step44BlindBytes(decoded.rgba) ||
        row.width !== decoded.width ||
        row.height !== decoded.height ||
        decoded.width !== CANONICAL_CAPTURE_POLICY.width ||
        decoded.height !== CANONICAL_CAPTURE_POLICY.height ||
        row.reviewOutcome !== null ||
        row.reviewNote !== null
      )
        throw new TypeError(
          `Step-44 ${capture.blindId} ${reviewedView} bytes, pixels, dimensions, candidate, envelope, or camera drifted before downsampling.`,
        );
      const sourceBindingCommitment = canonicalDigest({
        captureManifestByteDigest: capture.captureManifestByteDigest,
        captureManifestCommitment: manifest.commitment,
        reviewHarnessEnvelopeCommitment: envelope.commitment,
        candidateKey: compact.candidateKey,
        selectedDocumentHash: roster.selectedDocumentHash,
        selectedDocumentCommitment: roster.selectedDocumentCommitment,
        fixtureKey,
        canonicalViewName,
        artifactPath: `${capture.blindId}/${canonicalViewName}.png`,
        pngDigest: row.pngDigest,
        pixelDigest: row.pixelDigest,
        width: row.width,
        height: row.height,
        cameraCommitment: row.cameraCommitment,
      });
      const cellBody = {
        blindId: capture.blindId,
        fixtureKey,
        canonicalViewName,
        artifactPath: `${capture.blindId}/${canonicalViewName}.png`,
        sourcePngDigest: row.pngDigest,
        sourcePixelDigest: row.pixelDigest,
        sourceWidth: row.width,
        sourceHeight: row.height,
        cameraCommitment: row.cameraCommitment,
        sourceBindingCommitment,
      };
      cells.push(deepFreeze({ ...cellBody, commitment: canonicalDigest(cellBody) }));
    }
    const fixedCameraBytes = readRealBuildPrefix50Step44ReviewArtifact(
      outputPath,
      `${capture.artifactDirectory}/real-build-prefix50-step44-page45-fixed-camera.png`,
      MAXIMUM_PNG_BYTES,
      `Step-44 ${capture.blindId} page45-matched after`,
    );
    const fixedCamera = decodeRealBuildPrefix50Step44ReviewPng(
      fixedCameraBytes,
      720 * 470,
      `Step-44 ${capture.blindId} page45-matched after`,
    );
    if (
      fixedCamera.width !== 720 ||
      fixedCamera.height !== 470 ||
      v3.fixedCameraAfter.pngByteLength !== fixedCameraBytes.length ||
      v3.fixedCameraAfter.pngDigest !== sha256RealBuildPrefix50Step44BlindBytes(fixedCameraBytes) ||
      v3.fixedCameraAfter.pixelDigest !== sha256RealBuildPrefix50Step44BlindBytes(fixedCamera.rgba)
    )
      throw new TypeError(
        `Step-44 ${capture.blindId} page45-matched after PNG bytes, pixels, or dimensions drifted.`,
      );
    const fixedCameraBindingCommitment = canonicalDigest({
      captureManifestCommitment: v3.commitment,
      reviewHarnessEnvelopeCommitment: envelope.commitment,
      candidateKey: compact.candidateKey,
      selectedDocumentHash: roster.selectedDocumentHash,
      page45CameraReceiptCommitment: v3.page45CameraReceiptCommitment,
      fixedCameraBaselineCommitment: v3.fixedCameraBaselineCommitment,
      fixedCameraAfterCommitment: v3.fixedCameraAfter.commitment,
      fixedCameraDeltaCommitment: v3.fixedCameraDelta.commitment,
      pngDigest: v3.fixedCameraAfter.pngDigest,
      pixelDigest: v3.fixedCameraAfter.pixelDigest,
    });
    const fixedCellBody = {
      blindId: capture.blindId,
      fixtureKey: "page45MatchedAfter",
      canonicalViewName: "page45-matched-after",
      artifactPath: `${capture.blindId}/page45-matched-after.png`,
      sourcePngDigest: v3.fixedCameraAfter.pngDigest,
      sourcePixelDigest: v3.fixedCameraAfter.pixelDigest,
      sourceWidth: fixedCamera.width,
      sourceHeight: fixedCamera.height,
      cameraCommitment: v3.fixedCameraAfter.cameraCommitment,
      sourceBindingCommitment: fixedCameraBindingCommitment,
    };
    cells.unshift(deepFreeze({ ...fixedCellBody, commitment: canonicalDigest(fixedCellBody) }));
    const fixedCameraEvidenceBody = {
      page45CameraReceiptCommitment: v3.page45CameraReceiptCommitment,
      fixedCameraBaselineCommitment: v3.fixedCameraBaselineCommitment,
      baselinePngDigest: v3.fixedCameraDelta.baselinePngDigest,
      baselinePixelDigest: v3.fixedCameraDelta.baselinePixelDigest,
      fixedCameraAfterCommitment: v3.fixedCameraAfter.commitment,
      afterPngDigest: v3.fixedCameraAfter.pngDigest,
      afterPixelDigest: v3.fixedCameraAfter.pixelDigest,
      fixedCameraDeltaCommitment: v3.fixedCameraDelta.commitment,
      fixedCameraDeltaArtifactCommitment: v3.fixedCameraDeltaArtifact.commitment,
      deltaArtifactPath: `${capture.blindId}/page45-fixed-camera-delta.png`,
      deltaPngDigest: v3.fixedCameraDeltaArtifact.pngDigest,
      deltaPixelDigest: v3.fixedCameraDeltaArtifact.pixelDigest,
      deltaWidth: 720 as const,
      deltaHeight: 470 as const,
      changedPixelCount: v3.fixedCameraDelta.changedPixelCount,
      changedPixelBounds: v3.fixedCameraDelta.changedPixelBounds,
    };
    const fixedCameraEvidence = deepFreeze({
      ...fixedCameraEvidenceBody,
      commitment: canonicalDigest(fixedCameraEvidenceBody),
    });
    const sourceRowCommitment = canonicalDigest({
      blindId: capture.blindId,
      batchIndex: capture.batchIndex,
      captureManifestByteDigest: capture.captureManifestByteDigest,
      captureManifestCommitment: capture.captureManifestCommitment,
      reviewHarnessEnvelopeCommitment: capture.reviewHarnessEnvelopeCommitment,
      candidateKey: capture.candidateKey,
      selectedDocumentHash: capture.selectedDocumentHash,
      cells: cells.map(({ commitment }) => commitment),
      fixedCameraEvidenceCommitment: fixedCameraEvidence.commitment,
    });
    verified.push(
      deepFreeze({
        binding: { ...capture, sourceRowCommitment },
        cells,
        fixedCameraEvidence,
        fixedCameraBaselineArtifact: v3.fixedCameraBaselineArtifact,
      }),
    );
  }
  if (verifiedSharedCameraAttempt === undefined)
    throw new TypeError(
      "Step-44 contact sheets did not produce the required shared persisted-camera verification proof.",
    );
  return deepFreeze({
    rows: verified,
    verifiedCameraAttempt: verifiedSharedCameraAttempt,
  });
}
