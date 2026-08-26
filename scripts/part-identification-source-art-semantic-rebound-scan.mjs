import {
  PDF_SOURCE_ART_PDFJS_VERSION,
  containingPdfSourceArtImageOperators,
  enumeratePdfSourceArtImageOperators,
  resolveDecodedPdfSourceArtImage,
} from "./part-identification-source-art-images.mjs";
import {
  broadClassDigest,
  classImage,
  compactManifestRow,
  exactClassDigest,
} from "./part-identification-source-art-semantic-rebound-classification.mjs";
import { renderPdfSourceArtImageProofPage } from "./part-identification-source-art-semantic-rebound-source.mjs";

export function exactSourceArtLabelCount(textContent, row) {
  const expected = `${row.quantity}x`;
  return textContent.items.filter(
    (item) =>
      item?.str === expected &&
      Array.isArray(item.transform) &&
      Math.abs(Number(item.transform[4]) - row.xPt) < 0.001 &&
      Math.abs(Number(item.transform[5]) - row.yPt) < 0.001,
  ).length;
}

export async function scanSourceArtSemanticPrefix(pdfBytes, prefix, semanticByIdentity, ledger) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjs.version !== PDF_SOURCE_ART_PDFJS_VERSION) {
    throw new Error(
      `Source-art semantic rebound loaded pdfjs ${JSON.stringify(pdfjs.version)}, not pinned ${PDF_SOURCE_ART_PDFJS_VERSION}.`,
    );
  }
  const documentHandle = await pdfjs.getDocument({
    data: Uint8Array.from(pdfBytes),
    isEvalSupported: false,
  }).promise;
  const scans = [];
  const measured = [];
  const pageState = new Map();
  try {
    const byPage = new Map();
    for (const row of prefix) {
      const pageRows = byPage.get(row.pageNumber) ?? [];
      pageRows.push(row);
      byPage.set(row.pageNumber, pageRows);
    }
    for (const pageNumber of [...byPage.keys()].sort((left, right) => left - right)) {
      const page = await documentHandle.getPage(pageNumber);
      const operatorList = await page.getOperatorList();
      const images = enumeratePdfSourceArtImageOperators(
        pdfjs,
        operatorList,
        page.getViewport({ scale: 1 }).height,
        `Source-art semantic rebound page ${pageNumber}`,
      );
      const textContent = await page.getTextContent();
      const decodedByOperator = new Map();
      const pageMeasured = [];
      for (const row of byPage.get(pageNumber)) {
        const candidates = containingPdfSourceArtImageOperators(
          images,
          row.sourceComponent.boundsPx,
        );
        const labelCount = exactSourceArtLabelCount(textContent, row);
        let measurement = null;
        if (candidates.length === 1 && labelCount === 1) {
          const operator = candidates[0];
          let decoded = decodedByOperator.get(operator.operatorIndex);
          if (decoded === undefined) {
            decoded = await resolveDecodedPdfSourceArtImage(page, operator, row.identity);
            ledger.chargeDecoded(
              decoded.width,
              decoded.height,
              decoded.data.byteLength,
              row.identity,
            );
            decodedByOperator.set(operator.operatorIndex, decoded);
          }
          const image = classImage(decoded, operator);
          measurement = {
            broadClassDigest: broadClassDigest(image),
            decodedImage: image,
            operator,
            row,
          };
          measured.push(measurement);
          pageMeasured.push(measurement);
        }
        scans.push({
          ...compactManifestRow(row),
          broadClassDigest: measurement?.broadClassDigest ?? null,
          containmentCandidateCount: candidates.length,
          labelCount,
          measured: measurement !== null,
          operatorIndex: measurement?.operator.operatorIndex ?? null,
          semanticAnchor: semanticByIdentity.has(row.identity),
        });
      }
      pageState.set(pageNumber, { operatorList, page, pageMeasured });
    }

    const anchorBroadClasses = new Set(
      measured
        .filter(({ row }) => semanticByIdentity.has(row.identity))
        .map(({ broadClassDigest: digest }) => digest),
    );
    const proofTargets = measured.filter(({ broadClassDigest: digest }) =>
      anchorBroadClasses.has(digest),
    );
    const proofByIdentity = new Map();
    for (const [, state] of [...pageState.entries()].sort(([left], [right]) => left - right)) {
      const targets = state.pageMeasured.filter(({ broadClassDigest: digest }) =>
        anchorBroadClasses.has(digest),
      );
      if (targets.length === 0) continue;
      const rendered = await renderPdfSourceArtImageProofPage({
        ledger,
        operatorList: state.operatorList,
        page: state.page,
        pdfjs,
        targets: targets.map(({ operator, row }) => ({
          identity: row.identity,
          operatorIndex: operator.operatorIndex,
          sourceComponent: row.sourceComponent,
        })),
      });
      for (const result of rendered) proofByIdentity.set(result.identity, result);
    }
    if (proofByIdentity.size !== proofTargets.length) {
      throw new Error(
        `Source-art semantic rebound rendered ${proofByIdentity.size} proofs for ${proofTargets.length} exact broad-class members.`,
      );
    }
    const proofs = proofTargets.map((measurement) => {
      const rendered = proofByIdentity.get(measurement.row.identity);
      const normalizedProgramSha256 = rendered.contribution.normalizedProgramSha256;
      return {
        ...measurement,
        exactClassDigest: exactClassDigest(measurement.decodedImage, normalizedProgramSha256),
        normalizedProgram: rendered.contribution.normalizedProgram,
        normalizedProgramSha256,
        proof: rendered.proof,
      };
    });
    return { proofs, scans };
  } finally {
    for (const { page } of pageState.values()) page.cleanup();
    await documentHandle.destroy();
  }
}
