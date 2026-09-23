import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { runRealBuildPrefix50Step44Poppler } from "../e2e/real-build-prefix50-subbuild-return-review-poppler.ts";

export function createStep44SourceFreeTestPdfBytes(
  fill: readonly [number, number, number],
): Buffer {
  const pageCount = 45;
  const contentObject = pageCount + 3;
  const pageObjects = Array.from({ length: pageCount }, (_, index) => index + 3);
  const content = `q ${fill.join(" ")} rg 0 0 4 4 re f Q\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pageCount} /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] >>`,
    ...pageObjects.map(
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 4 4] /Resources << >> /Contents ${contentObject} 0 R >>`,
    ),
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

export async function createStep44HermeticPdfArtifacts(directory: string): Promise<{
  pdfBytes: Buffer;
  alternatePdfBytes: Buffer;
  pageBytes: Buffer;
  rendererVersion: string;
}> {
  const pdfBytes = createStep44SourceFreeTestPdfBytes([0.16, 0.48, 0.95]);
  const alternatePdfBytes = createStep44SourceFreeTestPdfBytes([0.85, 0.15, 0.25]);
  const outputPrefix = resolve(directory, "page");
  const poppler = runRealBuildPrefix50Step44Poppler({
    sourceBytes: pdfBytes,
    label: "source-free fixture Poppler render",
    arguments: ["-f", "45", "-l", "45", "-r", "180", "-png", "-singlefile", "-", outputPrefix],
  });
  return {
    pdfBytes,
    alternatePdfBytes,
    pageBytes: await readFile(`${outputPrefix}.png`),
    rendererVersion: poppler.version,
  };
}
