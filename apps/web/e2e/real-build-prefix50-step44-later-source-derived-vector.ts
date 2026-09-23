import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import { derivePanelFaces } from "../src/assembly/panel-face.ts";
import type { InstructionSourceV1 } from "../src/instructions/instruction-source.ts";
import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf.ts";

import { sampleBookletPageShapes, sampleBookletPanels } from "./booklet-fixture.ts";
import type {
  RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
  RealBuildPrefix50Step44LaterSourcePanelResult,
} from "./real-build-prefix50-step44-later-source-derived-contract.ts";
import { panelContainsRotationIcon } from "./real-build-transition-features.ts";

async function ingestPdfPrefix(bytes: Buffer, pageCeiling: 44 | 45): Promise<InstructionSourceV1> {
  return ingestInstructionPdf(
    {
      name: "bounded-later-source.pdf",
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    },
    {
      loadPdf: async (pdfBytes) => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const document = await getDocument({ data: pdfBytes, isEvalSupported: false }).promise;
        if (document.numPages < pageCeiling) {
          await document.destroy();
          throw new TypeError(`Later-source PDF ends before bounded booklet page ${pageCeiling}.`);
        }
        return {
          numPages: pageCeiling,
          getPage: (pageNumber: number) => {
            if (pageNumber > pageCeiling)
              throw new RangeError(
                `Later-source vector derivation may not read page ${pageCeiling + 1} or later.`,
              );
            return document.getPage(pageNumber) as unknown as ReturnType<PdfDocument["getPage"]>;
          },
          destroy: () => document.destroy(),
        } as PdfDocument;
      },
    },
  );
}

export async function deriveRealBuildPrefix50Step44LaterSourcePanelPrefix(
  sourceBytes: Buffer,
  request: Extract<
    RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
    { readonly kind: "panel-prefix" }
  >,
): Promise<RealBuildPrefix50Step44LaterSourcePanelResult> {
  const pageCeiling: 44 | 45 = request.purpose === "page44-step43-vector" ? 44 : 45;
  const lastPrintedStep: 43 | 44 = request.purpose === "page44-step43-vector" ? 43 : 44;
  const source = await ingestPdfPrefix(sourceBytes, pageCeiling);
  const panels = sampleBookletPanels(source)
    .filter(({ stepNumber }) => stepNumber <= lastPrintedStep)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  if (
    panels.length !== lastPrintedStep ||
    panels.some(({ stepNumber }, index) => stepNumber !== index + 1) ||
    panels.at(-1)?.pageNumber !== pageCeiling
  )
    throw new TypeError(
      `Later-source vector prefix must derive printed steps 1..${lastPrintedStep} ending on page ${pageCeiling}.`,
    );
  const pageNumbers = [...new Set(panels.map(({ pageNumber }) => pageNumber))];
  if (pageNumbers.some((pageNumber) => pageNumber > pageCeiling))
    throw new TypeError(`Later-source vector prefix crossed its page-${pageCeiling} ceiling.`);
  const shapesByPage = await sampleBookletPageShapes(sourceBytes, pageNumbers);
  const inputs = panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    rotationIconPresent: panelContainsRotationIcon(panel, shapesByPage.get(panel.pageNumber) ?? []),
  }));
  let previousPage = 0;
  for (const [index, row] of inputs.entries()) {
    if (
      row.stepNumber !== index + 1 ||
      row.pageNumber < previousPage ||
      row.pageNumber > pageCeiling
    )
      throw new TypeError(`Later-source vector prefix row ${index + 1} is malformed.`);
    previousPage = row.pageNumber;
  }
  const faces = derivePanelFaces(inputs);
  const rows = deepFreeze(
    inputs.map((row, index) => ({ ...row, panelFace: faces[index]!.panelFace })),
  );
  const rowsCommitment = canonicalDigest(rows);
  const body = {
    kind: "panel-prefix" as const,
    purpose: request.purpose,
    physicalPageNumber: pageCeiling,
    firstPrintedStep: 1 as const,
    lastPrintedStep,
    pageCeiling,
    rows,
    rowsCommitment,
  };
  return deepFreeze({ ...body, derivedCommitment: canonicalDigest(body) });
}
