import { sha256Digest } from "./real-build-artifacts";
import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS,
  realBuildSourceParityWorkGeometry,
  realBuildSourceParityPreparedPanelsManifest,
} from "./real-build-observation-source-parity-contract";
import {
  expectedRealBuildSourceParityDiagnosticDimensions,
  validateRealBuildSourceParityDiagnosticContent,
} from "./real-build-observation-source-parity-output-diagnostic";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";
import {
  boundedDenseSourceParityArray as boundedDenseArray,
  decodeSourceParityBase64 as decodeCanonicalBase64,
  exactSourceParityKeys as exactKeys,
  sourceParityDigest as requireDigest,
  sourceParityFinite as finite,
  sourceParityInteger as safeInteger,
  sourceParityMismatchFacts as mismatchFacts,
  snapshotDenseSourceParityArray as snapshotArray,
  snapshotSourceParityRecord as snapshotRecord,
  validateSourceParityComparisonShape as validateComparisonShape,
} from "./real-build-observation-source-parity-output-primitives";
import {
  realBuildSourceParityPublicationLimits,
  type RealBuildSourceParityPublicationLimits,
} from "./real-build-observation-source-parity-output-limits";
export type { RealBuildSourceParityPublicationLimits } from "./real-build-observation-source-parity-output-limits";
import { inspectRealBuildSourceParityPng } from "./real-build-observation-source-parity-png";
import { prepareRealBuildSourceParityProvenance } from "./real-build-observation-source-parity-provenance";
import { validatedRealBuildSourceParitySummaryCore } from "./real-build-observation-source-parity-summary-validation";
import { decodeRealBuildPngCapture } from "./real-build-png-capture";
import { stepPanelEvidenceDigest } from "./real-build-ledger";
import { validateRealBuildSourceParityBrowserResultBinding } from "./real-build-observation-source-parity-output-browser-result";

const MAXIMUM_CAPTURE_DATA_URL_CHARACTERS = 700_000;

export function prepareRealBuildSourceParityPublication(input: {
  readonly repoRoot: string;
  readonly result: RealBuildSourceParityProbeResult;
  readonly provenance: readonly import("./real-build-observation-source-parity-types").RealBuildSourceParityProvenanceRole[];
  readonly limits?: Partial<RealBuildSourceParityPublicationLimits>;
}) {
  const rawResult = input.result;
  exactKeys(
    rawResult,
    [
      "pdfDigest",
      "pdfBytes",
      "preparedPanelsDigest",
      "steps",
      "aggregate",
      "captures",
      "packedEvidence",
      "sourceSnapshot",
    ],
    "Source-parity result",
  );
  boundedDenseArray(
    rawResult.steps,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    "Source-parity prepared steps",
  );
  boundedDenseArray(
    rawResult.captures,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS,
    "Captures",
  );
  boundedDenseArray(
    rawResult.packedEvidence,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS,
    "Packed evidence",
  );
  boundedDenseArray(
    rawResult.aggregate,
    REAL_BUILD_SOURCE_PARITY_CLASSES.length,
    REAL_BUILD_SOURCE_PARITY_CLASSES.length,
    "Source-parity aggregate",
  );
  const scalarResult = snapshotRecord(rawResult, [
    "pdfDigest",
    "pdfBytes",
    "preparedPanelsDigest",
    "steps",
    "aggregate",
    "captures",
    "packedEvidence",
    "sourceSnapshot",
  ]);
  const result: RealBuildSourceParityProbeResult = {
    ...scalarResult,
    steps: snapshotArray(scalarResult.steps),
    aggregate: snapshotArray(scalarResult.aggregate),
    captures: snapshotArray(scalarResult.captures),
    packedEvidence: snapshotArray(scalarResult.packedEvidence),
  };
  const pdfDigest = requireDigest(result.pdfDigest, "Source-parity PDF digest");
  safeInteger(
    result.pdfBytes,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
    "Source-parity PDF bytes",
  );
  requireDigest(result.preparedPanelsDigest, "Prepared-panels digest");
  const seenStepClasses = new Set<string>();
  let totalPanelPixels = 0;
  let previousPage = 0;
  for (let index = 0; index < result.steps.length; index += 1) {
    const step = result.steps[index]!;
    exactKeys(
      step,
      [
        "stepNumber",
        "pageNumber",
        "minXPt",
        "maxXPt",
        "minYPt",
        "maxYPt",
        "calloutBoxes",
        "panelEvidenceDigest",
        "width",
        "height",
        "workRgbaBrowserCommitmentDigest",
        "candidatePolicyBrowserCommitmentDigest",
        "candidateDerivationBrowserCommitmentDigest",
        "comparisons",
      ],
      `Source-parity step ${index + 1}`,
    );
    if (step.stepNumber !== index + 1) {
      throw new TypeError(
        `Source-parity steps must be dense 1..359; row ${index} is step ${step.stepNumber}.`,
      );
    }
    safeInteger(step.pageNumber, 1, 400, `Printed step ${step.stepNumber} page`);
    if (step.pageNumber < previousPage) {
      throw new TypeError(
        `Printed step ${step.stepNumber} page ${step.pageNumber} precedes prior page ${previousPage}.`,
      );
    }
    previousPage = step.pageNumber;
    const minX = finite(step.minXPt, "Panel minXPt");
    const maxX = finite(step.maxXPt, "Panel maxXPt");
    const minY = finite(step.minYPt, "Panel minYPt");
    const maxY = finite(step.maxYPt, "Panel maxYPt");
    if (maxX <= minX || maxY <= minY) throw new RangeError("Panel bounds must have positive area.");
    boundedDenseArray(
      step.calloutBoxes,
      0,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
      `Printed step ${step.stepNumber} callouts`,
    );
    for (const box of step.calloutBoxes) {
      exactKeys(box, ["minXPt", "maxXPt", "minYPt", "maxYPt"], "Callout bounds");
      if (
        finite(box.maxXPt, "Callout maxXPt") <= finite(box.minXPt, "Callout minXPt") ||
        finite(box.maxYPt, "Callout maxYPt") <= finite(box.minYPt, "Callout minYPt")
      ) {
        throw new RangeError(`Printed step ${step.stepNumber} has non-positive callout bounds.`);
      }
    }
    const expectedPanelDigest = stepPanelEvidenceDigest({
      pdfDigest,
      stepNumber: step.stepNumber,
      pageNumber: step.pageNumber,
      bounds: { minXPt: minX, maxXPt: maxX, minYPt: minY, maxYPt: maxY },
      calloutBoxes: step.calloutBoxes,
    });
    if (step.panelEvidenceDigest !== expectedPanelDigest) {
      throw new TypeError(
        `Printed step ${step.stepNumber} panel evidence digest does not reproduce.`,
      );
    }
    const width = safeInteger(
      step.width,
      1,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
      "Raster width",
    );
    const height = safeInteger(
      step.height,
      1,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
      "Raster height",
    );
    const pixels = width * height;
    const expectedGeometry = realBuildSourceParityWorkGeometry({
      minXPt: minX,
      maxXPt: maxX,
      minYPt: minY,
      maxYPt: maxY,
    });
    if (!Number.isSafeInteger(pixels) || pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS) {
      throw new RangeError(`Printed step ${step.stepNumber} raster exceeds the pixel bound.`);
    }
    if (width !== expectedGeometry.width || height !== expectedGeometry.height) {
      throw new TypeError(
        `Printed step ${step.stepNumber} raster is ${width}x${height}; exact prepared bounds require ${expectedGeometry.width}x${expectedGeometry.height}.`,
      );
    }
    totalPanelPixels += pixels;
    if (
      totalPanelPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS ||
      totalPanelPixels * REAL_BUILD_SOURCE_PARITY_CLASSES.length >
        REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS
    ) {
      throw new RangeError(
        `Printed step ${step.stepNumber} exceeds the bounded aggregate panel/comparison pixel work.`,
      );
    }
    requireDigest(step.workRgbaBrowserCommitmentDigest, "Opaque browser work-RGBA commitment");
    requireDigest(
      step.candidatePolicyBrowserCommitmentDigest,
      "Opaque browser candidate-policy commitment",
    );
    requireDigest(
      step.candidateDerivationBrowserCommitmentDigest,
      "Opaque browser candidate-derivation commitment",
    );
    boundedDenseArray(
      step.comparisons,
      REAL_BUILD_SOURCE_PARITY_CLASSES.length,
      REAL_BUILD_SOURCE_PARITY_CLASSES.length,
      `Printed step ${step.stepNumber} comparisons`,
    );
    for (
      let classIndex = 0;
      classIndex < REAL_BUILD_SOURCE_PARITY_CLASSES.length;
      classIndex += 1
    ) {
      const comparison = step.comparisons[classIndex]!;
      const sourceClass = REAL_BUILD_SOURCE_PARITY_CLASSES[classIndex]!;
      validateComparisonShape(comparison, step.stepNumber, sourceClass, width, height);
      const key = `${step.stepNumber}:${comparison.sourceClass}`;
      if (seenStepClasses.has(key))
        throw new TypeError(`Duplicate source-parity comparison ${key}.`);
      seenStepClasses.add(key);
      if (comparison.sourceClass !== sourceClass) {
        throw new TypeError(
          `Printed step ${step.stepNumber} comparisons are not in canonical class order.`,
        );
      }
    }
  }
  const preparedDigest = sha256Digest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, result.steps)),
  );
  if (preparedDigest !== result.preparedPanelsDigest) {
    throw new TypeError("Prepared-panels digest does not reproduce the exact 359 panel records.");
  }
  const summaryCore = validatedRealBuildSourceParitySummaryCore(result, pdfDigest);
  const limits = realBuildSourceParityPublicationLimits(input.limits);
  let captureBytes = 0;
  const captures = result.captures.map((capture) => {
    exactKeys(capture, ["digest", "width", "height", "png"], "Source-parity capture");
    const digest = requireDigest(capture.digest, "Capture digest");
    if (
      typeof capture.png !== "string" ||
      capture.png.length > MAXIMUM_CAPTURE_DATA_URL_CHARACTERS
    ) {
      throw new RangeError(`Capture ${digest} exceeds the bounded data-URL character budget.`);
    }
    const bytes = decodeRealBuildPngCapture(capture.png);
    captureBytes += bytes.length;
    if (
      bytes.length > limits.maximumCaptureBytes ||
      captureBytes > limits.maximumAggregateCaptureBytes
    ) {
      throw new RangeError(`Source-parity captures exceed bounded byte budgets at ${digest}.`);
    }
    if (sha256Digest(bytes) !== digest)
      throw new TypeError(`Capture ${digest} bytes do not reproduce.`);
    const dimensions = inspectRealBuildSourceParityPng(bytes);
    safeInteger(capture.width, 1, 512, `Capture ${digest} width`);
    safeInteger(capture.height, 1, 128, `Capture ${digest} height`);
    if (dimensions.width !== capture.width || dimensions.height !== capture.height) {
      throw new TypeError(
        `Capture ${digest} IHDR is ${dimensions.width}x${dimensions.height}, not ${capture.width}x${capture.height}.`,
      );
    }
    return { digest, width: capture.width, height: capture.height, bytes, rgba: dimensions.rgba };
  });
  if (
    captures.some(
      ({ digest }, index) => index > 0 && captures[index - 1]!.digest.localeCompare(digest) >= 0,
    )
  ) {
    throw new TypeError("Source-parity captures must be unique and digest-sorted.");
  }
  let packedBytes = 0;
  const packedEvidence = result.packedEvidence.map((entry) => {
    exactKeys(
      entry,
      ["packedDigest", "pixelCount", "byteLength", "lowPaddingBits", "base64"],
      "Packed parity evidence",
    );
    const packedDigest = requireDigest(entry.packedDigest, "Packed evidence digest");
    const pixelCount = safeInteger(
      entry.pixelCount,
      1,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
      "Packed evidence pixel count",
    );
    const byteLength = Math.ceil(pixelCount / 8);
    const lowPaddingBits = (8 - (pixelCount & 7)) & 7;
    const bytes = decodeCanonicalBase64(entry.base64, `Packed evidence ${packedDigest}`);
    packedBytes += bytes.length;
    if (
      entry.byteLength !== byteLength ||
      entry.lowPaddingBits !== lowPaddingBits ||
      bytes.length !== byteLength ||
      packedBytes > limits.maximumAggregatePackedEvidenceBytes ||
      sha256Digest(bytes) !== packedDigest
    ) {
      throw new TypeError(
        `Packed evidence ${packedDigest} does not reproduce its bounded descriptor.`,
      );
    }
    return { packedDigest, pixelCount, byteLength, lowPaddingBits, bytes };
  });
  if (
    packedEvidence.some(
      ({ packedDigest }, index) =>
        index > 0 && packedEvidence[index - 1]!.packedDigest.localeCompare(packedDigest) >= 0,
    )
  ) {
    throw new TypeError("Packed parity evidence must be unique and digest-sorted.");
  }
  const capturesByDigest = new Map(captures.map((entry) => [entry.digest, entry]));
  const packedByDigest = new Map(packedEvidence.map((entry) => [entry.packedDigest, entry]));
  const usedCaptures = new Set<string>();
  const usedPacked = new Set<string>();
  for (const step of result.steps) {
    const pixels = step.width * step.height;
    for (const comparison of step.comparisons) {
      const differing = comparison.mismatchPixels > 0;
      if (
        (differing &&
          (comparison.diagnosticCaptureDigest === null ||
            comparison.xorEvidencePackedDigest === null)) ||
        (!differing &&
          (comparison.diagnosticCaptureDigest !== null ||
            comparison.xorEvidencePackedDigest !== null))
      ) {
        throw new TypeError(
          `Printed step ${step.stepNumber} ${comparison.sourceClass} content refs do not match its mismatch count.`,
        );
      }
      if (comparison.diagnosticCaptureDigest !== null) {
        requireDigest(comparison.diagnosticCaptureDigest, "Diagnostic capture ref");
        const capture = capturesByDigest.get(comparison.diagnosticCaptureDigest);
        const expected = expectedRealBuildSourceParityDiagnosticDimensions(step.width, step.height);
        if (
          capture === undefined ||
          capture.width !== expected.width ||
          capture.height !== expected.height
        ) {
          throw new TypeError(`Missing diagnostic capture ${comparison.diagnosticCaptureDigest}.`);
        }
        usedCaptures.add(comparison.diagnosticCaptureDigest);
      }
      let xor: Uint8Array = new Uint8Array(pixels);
      if (comparison.xorEvidencePackedDigest !== null) {
        const packed = packedByDigest.get(comparison.xorEvidencePackedDigest);
        if (packed === undefined || packed.pixelCount !== pixels) {
          throw new TypeError(
            `Missing or dimension-mismatched XOR evidence for step ${step.stepNumber}.`,
          );
        }
        usedPacked.add(packed.packedDigest);
        xor = unpackRealBuildCompiledBinaryMaskMsb(packed.bytes, step.width, step.height);
      }
      const facts = mismatchFacts(xor, step.width);
      const boundsMatch =
        facts.bounds === null
          ? comparison.mismatchBounds === null
          : comparison.mismatchBounds !== null &&
            facts.bounds.minXPx === comparison.mismatchBounds.minXPx &&
            facts.bounds.minYPx === comparison.mismatchBounds.minYPx &&
            facts.bounds.maxXPxExclusive === comparison.mismatchBounds.maxXPxExclusive &&
            facts.bounds.maxYPxExclusive === comparison.mismatchBounds.maxYPxExclusive;
      if (
        sha256Digest(xor) !== comparison.xorMaskDigest ||
        facts.pixels !== comparison.mismatchPixels ||
        !boundsMatch
      ) {
        throw new TypeError(
          `Printed step ${step.stepNumber} ${comparison.sourceClass} XOR evidence does not reproduce.`,
        );
      }
      const productionRef = requireDigest(
        comparison.productionEvidencePackedDigest,
        "Production evidence ref",
      );
      const productionPacked = packedByDigest.get(productionRef);
      if (productionPacked === undefined || productionPacked.pixelCount !== pixels) {
        throw new TypeError(
          `Printed step ${step.stepNumber} production mask is missing or mis-sized.`,
        );
      }
      usedPacked.add(productionRef);
      const production = unpackRealBuildCompiledBinaryMaskMsb(
        productionPacked.bytes,
        step.width,
        step.height,
      );
      const candidate = new Uint8Array(pixels);
      let productionArea = 0;
      let candidateArea = 0;
      let intersection = 0;
      for (let pixel = 0; pixel < pixels; pixel += 1) {
        candidate[pixel] = production[pixel]! ^ xor[pixel]!;
        productionArea += production[pixel]!;
        candidateArea += candidate[pixel]!;
        if (production[pixel] === 1 && candidate[pixel] === 1) intersection += 1;
      }
      if (comparison.diagnosticCaptureDigest !== null) {
        const capture = capturesByDigest.get(comparison.diagnosticCaptureDigest)!;
        validateRealBuildSourceParityDiagnosticContent({
          stepNumber: step.stepNumber,
          sourceWidth: step.width,
          sourceHeight: step.height,
          capture,
          production,
          candidate,
          xor,
        });
      }
      if (
        sha256Digest(production) !== comparison.productionMaskDigest ||
        sha256Digest(candidate) !== comparison.candidateMaskDigest ||
        productionArea !== comparison.productionArea ||
        candidateArea !== comparison.candidateArea ||
        intersection !== comparison.intersectionPixels
      ) {
        throw new TypeError(
          `Printed step ${step.stepNumber} production/XOR masks do not reproduce metrics.`,
        );
      }
    }
  }
  if (usedCaptures.size !== captures.length || usedPacked.size !== packedEvidence.length) {
    throw new TypeError("Source-parity content roles contain orphaned evidence.");
  }
  validateRealBuildSourceParityBrowserResultBinding({
    result,
    summaryCore,
    captures,
    packedEvidence,
  });
  const provenance = prepareRealBuildSourceParityProvenance({
    roles: input.provenance,
    snapshot: result.sourceSnapshot,
    pdfDigest,
    pdfBytes: result.pdfBytes,
    repoRoot: input.repoRoot,
  });
  return {
    summaryCore,
    captures,
    packedEvidence,
    provenance,
  };
}
