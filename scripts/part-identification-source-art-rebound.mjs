import { createHash } from "node:crypto";

import { assertV6CalloutManifest } from "./part-identification-artifact-source.mjs";
import { canonicalSourceArtJson as canonicalJson } from "./part-identification-source-art-contribution.mjs";
import {
  PDF_SOURCE_ART_PDFJS_VERSION,
  containingPdfSourceArtImageOperators,
  enumeratePdfSourceArtImageOperators,
  resolveDecodedPdfSourceArtImage,
} from "./part-identification-source-art-images.mjs";
import { renderPdfSourceArtContributionPage } from "./part-identification-source-art-rebound-render.mjs";

export const PART_IDENTIFICATION_SOURCE_ART_REBOUND_SCHEMA =
  "lego.part-identification-source-art-rebound/1";

const EXPECTED_PRINTED_STEPS = 359;
const AUTHORIZED_THROUGH_STEP = 50;
const EXPECTED_CALLOUTS = 881;
const EXPECTED_PHYSICAL = 859;
const EXPECTED_SEMANTIC = 22;
const EXPECTED_AMBIGUITIES = 18;
const EXPECTED_FIXED_GEOMETRY_ROWS = 7;
const MAX_PDF_BYTES = 80 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 512 * 1024;
const FIXED_LINEAR_TRANSFORM_MILLI = Object.freeze([41_034, 0, 0, 37_908]);
const POSITIVE_PIXEL_SHA256 =
  "sha256:e9842a52e0ce0665d6c925858e07408e6124693a19752889d158553052554dc4";
const NEGATIVE_PIXEL_SHA256 =
  "sha256:8fdba53e6dffa31890ec1ae5c4be67ea5af5e39a824bb452b6d382c3eae8ed89";
const REFERENCE_IDENTITY = "p11|q1|x506.064|y212.112";
const EXPECTED_MEMBERS = Object.freeze([
  "p11|q1|x90.511|y212.112",
  REFERENCE_IDENTITY,
  "p20|q1|x36.320|y430.691",
]);
const EXPECTED_COUNTEREVIDENCE = Object.freeze([
  "p89|q1|x511.258|y475.022",
  "p93|q1|x511.258|y477.151",
  "p100|q1|x479.849|y422.972",
  "p104|q1|x469.096|y477.151",
]);

const verifiedClosures = new WeakMap();

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function canonicalArtifactBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`);
}

function ownedBytes(value, label, maximumBytes) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 || value.byteLength > maximumBytes) {
    throw new Error(`${label} must be 1..${maximumBytes} exact bytes.`);
  }
  return Uint8Array.from(value);
}

function parseJsonBytes(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Error(`${label} is not fatal UTF-8.`, { cause });
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`${label} is not one JSON value.`, { cause });
  }
}

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function linearTransformMilli(transform) {
  return transform.slice(0, 4).map((value) => Math.round(value * 1_000));
}

function sameNumbers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertExactLabel(textContent, row) {
  const expected = `${row.quantity}x`;
  const matches = textContent.items.filter(
    (item) =>
      item?.str === expected &&
      Array.isArray(item.transform) &&
      Math.abs(Number(item.transform[4]) - row.xPt) < 0.001 &&
      Math.abs(Number(item.transform[5]) - row.yPt) < 0.001,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Source-art rebound ${row.identity} expected exactly one PDF label ${JSON.stringify(expected)} at ${row.xPt},${row.yPt}; found ${matches.length}.`,
    );
  }
}

function sourceComponent(row) {
  return {
    absoluteForegroundSha256: row.sourceComponent.absoluteForegroundSha256,
    boundsPx: { ...row.sourceComponent.boundsPx },
    foregroundPixels: row.sourceComponent.foregroundPixels,
    rasterScale: row.sourceComponent.rasterScale,
    rawComponentCount: row.sourceComponent.rawComponentCount,
  };
}

function relationRow(row, decoded, programSha256, proof) {
  return {
    cropSha256: row.sha256,
    decodedPixelSha256: decoded.decodedPixelSha256,
    identity: row.identity,
    normalizedProgramSha256: programSha256,
    pageNumber: row.pageNumber,
    quantity: row.quantity,
    renderProof: proof,
    sourceComponent: sourceComponent(row),
    stepNumber: row.stepNumber,
  };
}

function exactIdentitySet(rows, expected, label) {
  const actual = rows.map(({ identity }) => identity).sort();
  const wanted = [...expected].sort();
  if (!sameNumbers(actual, wanted)) {
    throw new Error(
      `Source-art rebound ${label} were ${JSON.stringify(actual)}; expected exact fixed class ${JSON.stringify(wanted)}.`,
    );
  }
}

async function compileValue(pdfBytes, manifestBytes) {
  const parsedManifest = parseJsonBytes(manifestBytes, "Source-art rebound manifest bytes");
  const manifest = assertV6CalloutManifest(parsedManifest);
  const observedPdfSha256 = sha256(pdfBytes);
  if (observedPdfSha256 !== manifest.sourceHash) {
    throw new Error(
      `Source-art rebound PDF hashes to ${observedPdfSha256}, not authenticated manifest source ${manifest.sourceHash}.`,
    );
  }
  const physicalRows = manifest.callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  const semanticRows = manifest.callouts.filter(({ evidenceKind }) => evidenceKind !== "part-art");
  if (
    manifest.callouts.length !== EXPECTED_CALLOUTS ||
    physicalRows.length !== EXPECTED_PHYSICAL ||
    semanticRows.length !== EXPECTED_SEMANTIC
  ) {
    throw new Error(
      `Source-art rebound denominator was ${manifest.callouts.length}/${physicalRows.length}/${semanticRows.length}; expected ${EXPECTED_CALLOUTS}/${EXPECTED_PHYSICAL}/${EXPECTED_SEMANTIC} complete/physical/semantic callouts.`,
    );
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjs.version !== PDF_SOURCE_ART_PDFJS_VERSION) {
    throw new Error(
      `Source-art rebound loaded pdfjs ${JSON.stringify(pdfjs.version)}, not pinned ${PDF_SOURCE_ART_PDFJS_VERSION}.`,
    );
  }
  const documentHandle = await pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false })
    .promise;
  const scanRows = [];
  const measuredRows = [];
  try {
    const byPage = new Map();
    for (const row of physicalRows) {
      const rows = byPage.get(row.pageNumber) ?? [];
      rows.push(row);
      byPage.set(row.pageNumber, rows);
    }
    for (const pageNumber of [...byPage.keys()].sort((left, right) => left - right)) {
      const page = await documentHandle.getPage(pageNumber);
      try {
        const operatorList = await page.getOperatorList();
        const images = enumeratePdfSourceArtImageOperators(
          pdfjs,
          operatorList,
          page.getViewport({ scale: 1 }).height,
          `Source-art rebound page ${pageNumber}`,
        );
        const decodedByOperator = new Map();
        const pageMeasured = [];
        for (const row of byPage.get(pageNumber)) {
          const generic = containingPdfSourceArtImageOperators(
            images,
            row.sourceComponent.boundsPx,
          );
          const fixedGeometry = generic.filter((image) =>
            sameNumbers(linearTransformMilli(image.transform), FIXED_LINEAR_TRANSFORM_MILLI),
          );
          const fixed = [];
          for (const operator of fixedGeometry) {
            let decoded = decodedByOperator.get(operator.operatorIndex);
            if (decoded === undefined) {
              decoded = await resolveDecodedPdfSourceArtImage(page, operator, row.identity);
              decodedByOperator.set(operator.operatorIndex, decoded);
            }
            if (decoded.width !== 86 || decoded.height !== 80 || decoded.kind !== 2) {
              throw new Error(
                `Source-art rebound fixed-geometry candidate for ${row.identity} decoded ${decoded.width}x${decoded.height} kind ${decoded.kind}; expected exact RGB24 86x80 class geometry.`,
              );
            }
            if (
              decoded.decodedPixelSha256 !== POSITIVE_PIXEL_SHA256 &&
              decoded.decodedPixelSha256 !== NEGATIVE_PIXEL_SHA256
            ) {
              throw new Error(
                `Source-art rebound fixed-geometry candidate for ${row.identity} has unregistered decoded pixels ${decoded.decodedPixelSha256}; the positive/negative class cannot slide to new art.`,
              );
            }
            fixed.push({ decoded, operator });
          }
          if (fixed.length > 1) {
            throw new Error(
              `Source-art rebound ${row.identity} retains ${fixed.length} fixed-class candidates after decoded-image filtering; ambiguous containment cannot choose one.`,
            );
          }
          const classification =
            fixed.length === 0
              ? "outside-fixed-class"
              : fixed[0].decoded.decodedPixelSha256 === POSITIVE_PIXEL_SHA256
                ? "member"
                : "counterevidence";
          scanRows.push({
            classification,
            fixedClassCandidateCount: fixed.length,
            genericContainmentCandidateCount: generic.length,
            identity: row.identity,
            stepNumber: row.stepNumber,
          });
          if (fixed.length === 1) pageMeasured.push({ row, ...fixed[0] });
        }
        if (pageMeasured.length > 0) {
          const textContent = await page.getTextContent();
          for (const { row } of pageMeasured) assertExactLabel(textContent, row);
          const positivePageMeasured = pageMeasured.filter(
            ({ decoded }) => decoded.decodedPixelSha256 === POSITIVE_PIXEL_SHA256,
          );
          const rendered =
            positivePageMeasured.length === 0
              ? []
              : await renderPdfSourceArtContributionPage({
                  operatorList,
                  page,
                  pdfjs,
                  targets: positivePageMeasured.map(({ operator, row }) => ({
                    imageOperator: operator,
                    key: row.identity,
                    label: `${row.quantity}x`,
                    labelTransformPt: [row.xPt, row.yPt],
                    sourceComponentBoundsPxAtScale8: row.sourceComponent.boundsPx,
                  })),
                });
          const renderByIdentity = new Map(rendered.map((entry) => [entry.targetKey, entry]));
          for (const measured of pageMeasured) {
            const render = renderByIdentity.get(measured.row.identity);
            if (
              measured.decoded.decodedPixelSha256 === POSITIVE_PIXEL_SHA256 &&
              render === undefined
            ) {
              throw new Error(`Source-art rebound render omitted ${measured.row.identity}.`);
            }
            measuredRows.push({ ...measured, render: render ?? null });
          }
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await documentHandle.destroy();
  }

  const ambiguities = scanRows.filter(
    ({ genericContainmentCandidateCount }) => genericContainmentCandidateCount !== 1,
  ).length;
  const membersMeasured = measuredRows.filter(
    ({ decoded }) => decoded.decodedPixelSha256 === POSITIVE_PIXEL_SHA256,
  );
  const counterMeasured = measuredRows.filter(
    ({ decoded }) => decoded.decodedPixelSha256 === NEGATIVE_PIXEL_SHA256,
  );
  if (
    ambiguities !== EXPECTED_AMBIGUITIES ||
    measuredRows.length !== EXPECTED_FIXED_GEOMETRY_ROWS
  ) {
    throw new Error(
      `Source-art rebound measured ${ambiguities} generic containment ambiguities and ${measuredRows.length} fixed-geometry rows; expected ${EXPECTED_AMBIGUITIES} and ${EXPECTED_FIXED_GEOMETRY_ROWS}.`,
    );
  }
  exactIdentitySet(
    membersMeasured.map(({ row }) => row),
    EXPECTED_MEMBERS,
    "members",
  );
  exactIdentitySet(
    counterMeasured.map(({ row }) => row),
    EXPECTED_COUNTEREVIDENCE,
    "counterevidence rows",
  );
  const programDigests = new Set(
    membersMeasured.map(({ render }) => render.contribution.normalizedProgramSha256),
  );
  if (programDigests.size !== 1) {
    throw new Error(
      `Source-art rebound fixed geometry produced ${programDigests.size} normalized whole-contribution programs; translation equivalence is not exact.`,
    );
  }
  const normalizedProgramSha256 = [...programDigests][0];
  const referenceMeasured = membersMeasured.find(({ row }) => row.identity === REFERENCE_IDENTITY);
  const normalizedProgram = referenceMeasured.render.contribution.normalizedProgram;
  const members = membersMeasured
    .map(({ decoded, render, row }) =>
      relationRow(row, decoded, normalizedProgramSha256, render.proof),
    )
    .sort((left, right) => left.stepNumber - right.stepNumber);
  const counterevidence = counterMeasured
    .map(({ decoded, row }) => relationRow(row, decoded, null, null))
    .sort((left, right) => left.stepNumber - right.stepNumber);
  const reference = members.find(({ identity }) => identity === REFERENCE_IDENTITY);
  const classDigest = sha256(
    Buffer.from(
      `lego.part-identification-source-art-class/1\0${canonicalJson({
        decodedPixelSha256: POSITIVE_PIXEL_SHA256,
        height: 80,
        kind: 2,
        linearTransformMilli: FIXED_LINEAR_TRANSFORM_MILLI,
        normalizedProgramSha256,
        width: 86,
      })}`,
    ),
  );
  const outcomeDigest = sha256(
    Buffer.from(`lego.part-identification-source-art-scan/1\0${canonicalJson(scanRows)}`),
  );
  return {
    authority: {
      catalogAdmission: "absent",
      completion: "absent",
      placement: "absent",
      semanticIdentity: "absent",
    },
    inputDigests: {
      manifestSha256: sha256(manifestBytes),
      pdfSha256: observedPdfSha256,
    },
    reference,
    scan: {
      fixedGeometryRows: measuredRows.length,
      genericContainmentAmbiguities: ambiguities,
      outcomeDigest,
      physicalRowsScanned: scanRows.length,
    },
    schemaVersion: PART_IDENTIFICATION_SOURCE_ART_REBOUND_SCHEMA,
    scope: {
      authorizedThroughStep: AUTHORIZED_THROUGH_STEP,
      calloutCount: manifest.callouts.length,
      expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
      physicalPartArtCalloutCount: physicalRows.length,
      semanticCalloutCount: semanticRows.length,
      suffixPolicy: "counterevidence-only-no-identity-or-action-authority",
    },
    sourceArtClass: {
      classDigest,
      counterevidence,
      decodedImage: {
        decodedPixelSha256: POSITIVE_PIXEL_SHA256,
        height: 80,
        kind: 2,
        linearTransformMilli: FIXED_LINEAR_TRANSFORM_MILLI,
        width: 86,
      },
      members,
      normalizedProgram,
      normalizedProgramSha256,
    },
  };
}

export async function compilePartIdentificationSourceArtRebound({ pdfBytes, manifestBytes }) {
  const ownedPdf = ownedBytes(pdfBytes, "Source-art rebound PDF", MAX_PDF_BYTES);
  const ownedManifest = ownedBytes(
    manifestBytes,
    "Source-art rebound manifest",
    MAX_MANIFEST_BYTES,
  );
  return canonicalArtifactBytes(await compileValue(ownedPdf, ownedManifest));
}

export async function verifyPartIdentificationSourceArtReboundClosure({
  artifactBytes,
  pdfBytes,
  manifestBytes,
}) {
  const ownedArtifact = ownedBytes(
    artifactBytes,
    "Source-art rebound artifact",
    MAX_ARTIFACT_BYTES,
  );
  const ownedPdf = ownedBytes(pdfBytes, "Source-art rebound PDF", MAX_PDF_BYTES);
  const ownedManifest = ownedBytes(
    manifestBytes,
    "Source-art rebound manifest",
    MAX_MANIFEST_BYTES,
  );
  const parsed = parseJsonBytes(ownedArtifact, "Source-art rebound artifact");
  const canonicalInput = canonicalArtifactBytes(parsed);
  if (!Buffer.from(ownedArtifact).equals(canonicalInput)) {
    throw new Error("Source-art rebound artifact must be exact canonical JSON plus one LF.");
  }
  const recompiled = await compilePartIdentificationSourceArtRebound({
    manifestBytes: ownedManifest,
    pdfBytes: ownedPdf,
  });
  if (!Buffer.from(ownedArtifact).equals(recompiled)) {
    throw new Error(
      `Source-art rebound artifact ${sha256(ownedArtifact)} does not equal independent raw-PDF/manifest recompilation ${sha256(recompiled)}.`,
    );
  }
  const verified = deepFreeze(parsed);
  const projection = deepFreeze({
    artifactSha256: sha256(ownedArtifact),
    authority: verified.authority,
    authorizedThroughStep: verified.scope.authorizedThroughStep,
    calloutCount: verified.scope.calloutCount,
    classDigest: verified.sourceArtClass.classDigest,
    counterevidence: verified.sourceArtClass.counterevidence,
    expectedPrintedSteps: verified.scope.expectedPrintedSteps,
    fixedGeometryRows: verified.scan.fixedGeometryRows,
    genericContainmentAmbiguities: verified.scan.genericContainmentAmbiguities,
    inputDigests: verified.inputDigests,
    members: verified.sourceArtClass.members,
    outcomeDigest: verified.scan.outcomeDigest,
    physicalRowsScanned: verified.scan.physicalRowsScanned,
    reference: verified.reference,
    schemaVersion: verified.schemaVersion,
    semanticRowsPreservedAsCounterevidence: verified.scope.semanticCalloutCount,
  });
  verifiedClosures.set(verified, {
    artifactSha256: projection.artifactSha256,
    manifestSha256: sha256(ownedManifest),
    pdfSha256: sha256(ownedPdf),
    projection,
  });
  return verified;
}

export function inspectVerifiedPartIdentificationSourceArtRebound(verified) {
  const held = verifiedClosures.get(verified);
  if (held === undefined) {
    throw new Error(
      "Source-art rebound inspection requires the opaque result returned by this module's raw closure verifier.",
    );
  }
  return held.projection;
}

export function assertVerifiedPartIdentificationSourceArtReboundClosure(
  verified,
  { artifactBytes, pdfBytes, manifestBytes },
) {
  const held = verifiedClosures.get(verified);
  if (held === undefined) {
    throw new Error("Source-art rebound closure assertion requires one privately verified result.");
  }
  const observed = {
    artifactSha256: sha256(
      ownedBytes(artifactBytes, "Source-art rebound held artifact", MAX_ARTIFACT_BYTES),
    ),
    manifestSha256: sha256(
      ownedBytes(manifestBytes, "Source-art rebound held manifest", MAX_MANIFEST_BYTES),
    ),
    pdfSha256: sha256(ownedBytes(pdfBytes, "Source-art rebound held PDF", MAX_PDF_BYTES)),
  };
  for (const field of Object.keys(observed)) {
    if (observed[field] !== held[field]) {
      throw new Error(
        `Source-art rebound held ${field} changed from ${held[field]} to ${observed[field]} after asynchronous verification.`,
      );
    }
  }
  return held.projection;
}

export const __testOnly = Object.freeze({
  canonicalArtifactBytes,
  canonicalJson,
  exactIdentitySet,
  linearTransformMilli,
});
