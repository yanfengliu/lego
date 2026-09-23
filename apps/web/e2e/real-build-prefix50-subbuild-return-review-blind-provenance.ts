import { createHash } from "node:crypto";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  decodeCanonicalRealBuildPrefix50Step44ReviewPng,
  requireExactRealBuildPrefix50Step44ReviewCrop,
} from "./real-build-prefix50-subbuild-return-review-png.ts";
import { rerenderRealBuildPrefix50Step44PdfPage } from "./real-build-prefix50-subbuild-return-review-pdf.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import { requireRealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";

const verifiedPhysicalSources = new WeakSet<object>();
const qualifiedPage45Renders = new WeakMap<object, Uint8Array>();

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export interface RealBuildPrefix50Step44PhysicalPage45Verification {
  readonly schemaVersion: "lego.real-build-prefix50-step44-physical-page45-verification/1";
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly physicalPageNumber: 45;
  readonly rendererVersion: string;
  readonly sourcePagePngDigest: `sha256:${string}`;
  readonly sourcePagePixelDigest: `sha256:${string}`;
  readonly referencePngDigest: `sha256:${string}`;
  readonly referencePixelDigest: `sha256:${string}`;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44QualifiedPhysicalPage45Render {
  readonly schemaVersion: "lego.real-build-prefix50-step44-qualified-page45-render/1";
  readonly qualificationCommitment: `sha256:${string}`;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly physicalPageNumber: 45;
  readonly rendererVersion: string;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly commitment: `sha256:${string}`;
}

export async function rerenderRealBuildPrefix50Step44QualifiedPhysicalPage45(input: {
  readonly repositoryRoot: string;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}): Promise<RealBuildPrefix50Step44QualifiedPhysicalPage45Render> {
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.realDomainQualification,
  );
  if (qualification.reviewBatchEnvelopeCommitment !== input.reviewBatchEnvelopeCommitment)
    throw new TypeError(
      "Step-44 physical page-45 access requires the qualification for this exact review batch.",
    );
  const rendered = await rerenderRealBuildPrefix50Step44PdfPage({
    capability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot: input.repositoryRoot,
      qualification,
      purpose: "page45-promotion-raster",
      physicalPageNumber: 45,
    }),
    purpose: "page45-promotion-raster",
    densityDpi: 180,
    retainDecodedBytes: true,
  });
  if (rendered.rgba === undefined)
    throw new TypeError("Step-44 page-45 rerender did not retain its decoded pixels.");
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-qualified-page45-render/1" as const,
    qualificationCommitment: qualification.commitment,
    reviewBatchEnvelopeCommitment: qualification.reviewBatchEnvelopeCommitment,
    physicalPageNumber: 45 as const,
    rendererVersion: rendered.rendererVersion,
    pngDigest: rendered.pngDigest,
    pixelDigest: rendered.pixelDigest,
    width: rendered.width,
    height: rendered.height,
  };
  const receipt = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  qualifiedPage45Renders.set(receipt, new Uint8Array(rendered.rgba));
  return receipt;
}

export function verifyRealBuildPrefix50Step44PhysicalPage45Provenance(input: {
  readonly publicRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly qualifiedRender: RealBuildPrefix50Step44QualifiedPhysicalPage45Render;
}): RealBuildPrefix50Step44PhysicalPage45Verification {
  const renderedRgba = qualifiedPage45Renders.get(input.qualifiedRender);
  const { commitment: renderCommitment, ...renderBody } = input.qualifiedRender;
  if (
    renderedRgba === undefined ||
    renderCommitment !== canonicalDigest(renderBody) ||
    input.qualifiedRender.schemaVersion !==
      "lego.real-build-prefix50-step44-qualified-page45-render/1"
  )
    throw new TypeError(
      "Step-44 page-45 provenance requires its runtime-branded qualified physical-page render.",
    );
  const reference = input.packet.reference;
  if (
    canonicalDigest(input.packet.page45SourcePolicy) !==
      canonicalDigest(REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY) ||
    input.packet.page45SourcePolicyCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT ||
    reference.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
    reference.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST
  )
    throw new TypeError(
      "Step-44 promotion requires the exact pinned recipes/6651557.pdf page-45 source policy.",
    );
  const referenceBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.publicRoot,
    reference.artifactFile,
    16 * 1024 * 1024,
    "Step-44 persisted physical page-45 reference",
  );
  const decodedReference = decodeCanonicalRealBuildPrefix50Step44ReviewPng(
    referenceBytes,
    reference.width * reference.height,
    "Step-44 persisted physical page-45 reference",
  );
  if (
    input.qualifiedRender.width !== 1_914 ||
    input.qualifiedRender.height !== 1_361 ||
    input.qualifiedRender.rendererVersion !== reference.rendererVersion ||
    input.qualifiedRender.pngDigest !== reference.sourcePagePngDigest ||
    input.qualifiedRender.pixelDigest !== reference.sourcePagePixelDigest ||
    decodedReference.width !== reference.width ||
    decodedReference.height !== reference.height ||
    sha256(referenceBytes) !== reference.pngDigest ||
    sha256(decodedReference.rgba) !== reference.pixelDigest
  )
    throw new TypeError(
      "Step-44 persisted reference does not match the freshly rerendered pinned physical PDF page 45.",
    );
  requireExactRealBuildPrefix50Step44ReviewCrop(
    {
      width: input.qualifiedRender.width,
      height: input.qualifiedRender.height,
      rgba: renderedRgba,
    },
    decodedReference,
    reference.x,
    reference.y,
  );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-physical-page45-verification/1" as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    physicalPageNumber: 45 as const,
    rendererVersion: input.qualifiedRender.rendererVersion,
    sourcePagePngDigest: input.qualifiedRender.pngDigest,
    sourcePagePixelDigest: input.qualifiedRender.pixelDigest,
    referencePngDigest: reference.pngDigest,
    referencePixelDigest: reference.pixelDigest,
    blindReviewPacketCommitment: input.packet.commitment,
  };
  const verification = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  verifiedPhysicalSources.add(verification);
  return verification;
}

export function requireRealBuildPrefix50Step44PhysicalPage45Verification(
  value: RealBuildPrefix50Step44PhysicalPage45Verification,
): void {
  if (!verifiedPhysicalSources.has(value))
    throw new TypeError(
      "Step-44 promotion requires a runtime-branded fresh physical page-45 rerender.",
    );
}
