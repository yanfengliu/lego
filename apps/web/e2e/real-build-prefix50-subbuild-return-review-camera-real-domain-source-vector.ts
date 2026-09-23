import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { derivePanelFaces } from "../src/assembly/panel-face.ts";
import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf.ts";
import type { InstructionSourceV1 } from "../src/instructions/instruction-source.ts";
import { sampleBookletPageShapes, sampleBookletPanels } from "./booklet-fixture.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  deriveRealBuildPrefix50Step42SourceAxisDiagnostic,
  requireRealBuildPrefix50Step42SignedSourceAxis,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-axis.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainBranchKey,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import type { RealBuildPrefix50Step42SourceGeometryAdmission } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import { rerenderRealBuildPrefix50Step42SourceCrop } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-raster.ts";
import { panelContainsRotationIcon } from "./real-build-transition-features.ts";

interface VectorInput {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly rotationIconPresent: boolean;
}

async function ingestPhysicalPage43Prefix(bytes: Buffer): Promise<InstructionSourceV1> {
  return ingestInstructionPdf(
    {
      name: "6651557.pdf",
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    },
    {
      loadPdf: async (pdfBytes) => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const document = await getDocument({ data: pdfBytes, isEvalSupported: false }).promise;
        if (document.numPages < 43) {
          await document.destroy();
          throw new TypeError("Pinned real-domain source ends before physical page 43.");
        }
        return {
          numPages: 43,
          getPage: (pageNumber: number) => {
            if (pageNumber > 43)
              throw new RangeError(
                "Step-through-40 vector prefix is capped before physical page 44.",
              );
            return document.getPage(pageNumber) as unknown as ReturnType<PdfDocument["getPage"]>;
          },
          destroy: () => document.destroy(),
        } as PdfDocument;
      },
    },
  );
}

export function deriveRealBuildPrefix50Step42VectorProjection(rows: readonly VectorInput[]) {
  const earlierPageVectorInputs = rows
    .filter(({ stepNumber }) => stepNumber <= 40)
    .map(({ stepNumber, pageNumber, rotationIconPresent }) => ({
      stepNumber,
      pageNumber,
      rotationIconPresent,
    }))
    .sort((left, right) => left.stepNumber - right.stepNumber);
  if (
    earlierPageVectorInputs.length !== 40 ||
    earlierPageVectorInputs.some(({ stepNumber }, index) => stepNumber !== index + 1) ||
    earlierPageVectorInputs.some(({ pageNumber }) => pageNumber > 43)
  )
    throw new TypeError(
      "Step-42 vector projection requires exactly ordered Steps 1..40 from pages no later than physical page 43.",
    );
  const boundedReceipt =
    REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.faceEvidence.boundedCalibrationPanelReceipt;
  const boundedVectorInputs = boundedReceipt.panelSteps.map(
    ({ stepNumber, pageNumber, rotationIconPresent }) => ({
      stepNumber,
      pageNumber,
      rotationIconPresent,
    }),
  );
  const vectorInputs = [...earlierPageVectorInputs, ...boundedVectorInputs];
  const faces = derivePanelFaces(vectorInputs);
  const faceRows = vectorInputs.map((row, index) => ({
    ...row,
    panelFace: faces[index]!.panelFace,
  }));
  const boundedFaceRows = boundedReceipt.panelSteps.map(
    ({ stepNumber, pageNumber, rotationIconPresent, panelFace }) => ({
      stepNumber,
      pageNumber,
      rotationIconPresent,
      panelFace,
    }),
  );
  if (canonicalDigest(faceRows.slice(-2)) !== canonicalDigest(boundedFaceRows))
    throw new TypeError(
      "Bounded Steps-41/42 panel-face receipt disagrees with the page-43-capped face sequence.",
    );
  return deepFreeze({
    earlierPageVectorInputsCommitment: canonicalDigest(earlierPageVectorInputs),
    earlierPageRowsCommitment: canonicalDigest(faceRows.slice(0, 40)),
    boundedCalibrationPanelReceiptCommitment: boundedReceipt.commitment,
    vectorInputsCommitment: canonicalDigest(vectorInputs),
    faceRowsCommitment: canonicalDigest(faceRows),
    terminalFace: faceRows.at(-1)!.panelFace,
  });
}

export async function deriveRealBuildPrefix50OfflineStep42VectorAdmission(bytes: Buffer) {
  const spec = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC;
  if (sha256RealBuildPrefix50Step44ReviewBytes(bytes) !== spec.sourcePdfDigest)
    throw new TypeError("Step-42 source-vector input is not the exact pinned booklet PDF.");
  const source = await ingestPhysicalPage43Prefix(bytes);
  const prefixPanels = sampleBookletPanels(source)
    .filter(({ stepNumber }) => stepNumber <= 40)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  if (
    prefixPanels.length !== 40 ||
    prefixPanels.some(({ stepNumber }, index) => stepNumber !== index + 1) ||
    prefixPanels.some(({ pageNumber }) => pageNumber > 43)
  )
    throw new TypeError(
      "Page-43-capped vector fold did not contain exactly ordered printed Steps 1..40.",
    );
  const shapesByPage = await sampleBookletPageShapes(bytes, [
    ...new Set(prefixPanels.map(({ pageNumber }) => pageNumber)),
  ]);
  const earlierPageVectorInputs = prefixPanels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    rotationIconPresent: panelContainsRotationIcon(panel, shapesByPage.get(panel.pageNumber) ?? []),
  }));
  const projection = deriveRealBuildPrefix50Step42VectorProjection(earlierPageVectorInputs);
  if (
    projection.earlierPageVectorInputsCommitment !==
      spec.faceEvidence.earlierPageVectorInputsCommitment ||
    projection.earlierPageRowsCommitment !== spec.faceEvidence.earlierPageRowsCommitment ||
    projection.boundedCalibrationPanelReceiptCommitment !==
      spec.faceEvidence.boundedCalibrationPanelReceipt.commitment ||
    projection.vectorInputsCommitment !== spec.faceEvidence.vectorInputsCommitment ||
    projection.faceRowsCommitment !== spec.faceEvidence.rowsCommitment
  )
    throw new TypeError(
      `Step-42 exact page-43-capped vector commitments drifted: earlierInputs=${projection.earlierPageVectorInputsCommitment}, earlierFaces=${projection.earlierPageRowsCommitment}, inputs=${projection.vectorInputsCommitment}, faces=${projection.faceRowsCommitment}.`,
    );

  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-offline-step42-vector-admission/2" as const,
    authority: "page43-capped-vector-prefix-plus-bounded-step41-step42-review" as const,
    selectionAuthority: false as const,
    ...projection,
  });
}

export async function deriveRealBuildPrefix50Step42VectorSourceEvidence(
  repositoryRoot: string,
  bytes: Buffer,
  sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission,
) {
  const spec = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC;
  const vector = await deriveRealBuildPrefix50OfflineStep42VectorAdmission(bytes);

  const crop = rerenderRealBuildPrefix50Step42SourceCrop({
    repositoryRoot,
    sourcePdfArtifactPath: spec.sourcePdfArtifactPath,
  });
  if (crop.pixelDigest !== spec.signedAxisReceipt.sourceCropPixelDigest)
    throw new TypeError(
      `Step-42 source-only Poppler crop pixel digest drifted: ${crop.pixelDigest}.`,
    );
  const sourceAxisDiagnostic = deriveRealBuildPrefix50Step42SourceAxisDiagnostic({
    panelStep: 42,
    rgba: crop.rgba,
    sourceGeometryAdmission,
  });
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-vector-source-evidence/2" as const,
    authority: "repository-pdf-vector-and-native-source-pixels" as const,
    selectionAuthority: false as const,
    earlierPageVectorInputsCommitment: vector.earlierPageVectorInputsCommitment,
    earlierPageRowsCommitment: vector.earlierPageRowsCommitment,
    boundedCalibrationPanelReceiptCommitment: vector.boundedCalibrationPanelReceiptCommitment,
    vectorInputsCommitment: vector.vectorInputsCommitment,
    faceRowsCommitment: vector.faceRowsCommitment,
    terminalFace: vector.terminalFace,
    sourceAxisDiagnostic,
  });
}

export async function verifyRealBuildPrefix50Step44Page44VectorSource(
  repositoryRoot: string,
  bytes: Buffer,
  sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission,
): Promise<RealBuildPrefix50Step44RealDomainBranchKey> {
  const evidence = await deriveRealBuildPrefix50Step42VectorSourceEvidence(
    repositoryRoot,
    bytes,
    sourceGeometryAdmission,
  );
  requireRealBuildPrefix50Step42SignedSourceAxis(evidence.sourceAxisDiagnostic);
}
