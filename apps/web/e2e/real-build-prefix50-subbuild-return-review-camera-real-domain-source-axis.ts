import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  type RealBuildPrefix50Step42SourceGeometryAdmission,
  deriveRealBuildPrefix50Step42LocalTopology,
  requireRealBuildPrefix50Step42SourceGeometryAdmission,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";

const WIDTH = 720;
const HEIGHT = 470;
const PIXELS = WIDTH * HEIGHT;
const EXACT_SOURCE_CROP_PIXEL_DIGEST =
  "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d" as const;

export const REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY = deepFreeze({
  panelStep: 42 as const,
  crop: { width: WIDTH, height: HEIGHT },
  darkStudCore: {
    roi: { minX: 330, maxX: 480, minY: 220, maxY: 290 },
    maximumRgbInclusive: 35,
    connectivity: 4 as const,
    minimumPixels: 80,
    maximumPixels: 110,
    minimumWidth: 20,
    maximumWidth: 24,
    minimumHeight: 8,
    maximumHeight: 10,
    exactQualifiedComponents: 4,
    minimumPitchPx: 32,
    maximumPitchPx: 40,
    maximumGapDeviationFraction: 0.02,
  },
  yellow: {
    redGreaterThan: 180,
    greenGreaterThan: 140,
    blueLessThan: 110,
    redMinusGreenLessThan: 100,
    greenMinusBlueGreaterThan: 60,
    connectivity: 4 as const,
    exactSignificantComponents: 1,
    minimumComponentPixels: 5,
    exactPixels: 3_223,
    exactNativeBounds: { minX: 128, minY: 134, maxX: 554, maxY: 330 },
  },
  segmentation:
    "four-dark-cores-identify-the-only-studded-middle-1x4;-strict-yellow-side-asymmetry-binds-the-catalog-6/4/2-order-without-rounded-length-inference" as const,
  signedYRequirement:
    "all-four-native-top-core/top-rim-to-source-bound-lower-wall/base-rim-correspondences-plus-vertical/horizontal/combined-mirror-and-erased-wall-controls" as const,
  documentToThreeXScale: 1 / 20,
});

interface PixelBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Component extends PixelBox {
  readonly pixels: readonly number[];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

type ControlKind = "native" | "vertical-mirror" | "horizontal-mirror" | "combined-mirror";

function components4(mask: Uint8Array): Component[] {
  const seen = new Uint8Array(mask.length);
  const result: Component[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    const queue = [start];
    seen[start] = 1;
    let minX = WIDTH;
    let minY = HEIGHT;
    let maxX = -1;
    let maxY = -1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const at = queue[cursor]!;
      const x = at % WIDTH;
      const y = Math.floor(at / WIDTH);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < WIDTH - 1 ? at + 1 : -1,
        y > 0 ? at - WIDTH : -1,
        y < HEIGHT - 1 ? at + WIDTH : -1,
      ])
        if (next >= 0 && mask[next] === 1 && seen[next] === 0) {
          seen[next] = 1;
          queue.push(next);
        }
    }
    result.push({ pixels: queue, minX, minY, maxX, maxY });
  }
  return result;
}

function centroid(component: Component): Point {
  let x = 0;
  let y = 0;
  for (const pixel of component.pixels) {
    x += pixel % WIDTH;
    y += Math.floor(pixel / WIDTH);
  }
  return { x: x / component.pixels.length, y: y / component.pixels.length };
}

function transformRgba(rgba: Uint8Array, control: ControlKind): Uint8Array {
  if (control === "native") return new Uint8Array(rgba);
  const horizontal = control === "horizontal-mirror" || control === "combined-mirror";
  const vertical = control === "vertical-mirror" || control === "combined-mirror";
  const transformed = new Uint8Array(rgba.length);
  for (let y = 0; y < HEIGHT; y += 1)
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX = horizontal ? WIDTH - 1 - x : x;
      const sourceY = vertical ? HEIGHT - 1 - y : y;
      const source = (sourceY * WIDTH + sourceX) * 4;
      transformed.set(rgba.subarray(source, source + 4), (y * WIDTH + x) * 4);
    }
  return transformed;
}

function transformBox(box: PixelBox, control: ControlKind): PixelBox {
  const horizontal = control === "horizontal-mirror" || control === "combined-mirror";
  const vertical = control === "vertical-mirror" || control === "combined-mirror";
  return {
    minX: horizontal ? WIDTH - 1 - box.maxX : box.minX,
    maxX: horizontal ? WIDTH - 1 - box.minX : box.maxX,
    minY: vertical ? HEIGHT - 1 - box.maxY : box.minY,
    maxY: vertical ? HEIGHT - 1 - box.minY : box.maxY,
  };
}

function darkStudCores(rgba: Uint8Array, roi: PixelBox) {
  const policy = REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY.darkStudCore;
  const mask = new Uint8Array(PIXELS);
  for (let y = roi.minY; y <= roi.maxY; y += 1)
    for (let x = roi.minX; x <= roi.maxX; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      if (
        Math.max(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!) <= policy.maximumRgbInclusive
      )
        mask[y * WIDTH + x] = 1;
    }
  const all = components4(mask);
  const qualified = all.filter((component) => {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    return (
      component.pixels.length >= policy.minimumPixels &&
      component.pixels.length <= policy.maximumPixels &&
      width >= policy.minimumWidth &&
      width <= policy.maximumWidth &&
      height >= policy.minimumHeight &&
      height <= policy.maximumHeight
    );
  });
  if (qualified.length !== policy.exactQualifiedComponents)
    throw new TypeError(
      `Step-42 source pixels contain ${qualified.length} qualified dark stud cores, not exactly four.`,
    );
  return { allCount: all.length, qualified };
}

function fitStudAxis(cores: readonly Component[]) {
  const centers = cores.map(centroid);
  const center = {
    x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
  };
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of centers) {
    const x = point.x - center.x;
    const y = point.y - center.y;
    xx += x * x;
    xy += x * y;
    yy += y * y;
  }
  const angleRadians = Math.atan2(2 * xy, xx - yy) / 2;
  const imageRightUnit = { x: Math.cos(angleRadians), y: Math.sin(angleRadians) };
  if (imageRightUnit.x < 0) {
    imageRightUnit.x *= -1;
    imageRightUnit.y *= -1;
  }
  const projection = (point: Point): number =>
    (point.x - center.x) * imageRightUnit.x + (point.y - center.y) * imageRightUnit.y;
  const rows = cores
    .map((component, index) => ({
      pixels: component.pixels.length,
      bounds: {
        minX: component.minX,
        minY: component.minY,
        maxX: component.maxX,
        maxY: component.maxY,
      },
      centroid: centers[index]!,
      projection: projection(centers[index]!),
    }))
    .sort((left, right) => left.projection - right.projection);
  const pitchGaps = rows.slice(1).map((row, index) => row.projection - rows[index]!.projection);
  const meanPitch = pitchGaps.reduce((sum, gap) => sum + gap, 0) / pitchGaps.length;
  const maximumGapDeviationFraction = Math.max(
    ...pitchGaps.map((gap) => Math.abs(gap - meanPitch) / meanPitch),
  );
  const policy = REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY.darkStudCore;
  if (
    meanPitch < policy.minimumPitchPx ||
    meanPitch > policy.maximumPitchPx ||
    maximumGapDeviationFraction > policy.maximumGapDeviationFraction
  )
    throw new TypeError(
      "Step-42 dark cores do not form the fixed equally pitched four-stud TLS row.",
    );
  return {
    center,
    xx,
    xy,
    yy,
    angleRadians,
    imageRightUnit,
    projection,
    rows,
    pitchGaps,
    meanPitch,
    maximumGapDeviationFraction,
  };
}

function strictYellowComponent(rgba: Uint8Array, control: ControlKind): Component {
  const policy = REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY.yellow;
  const mask = new Uint8Array(PIXELS);
  for (let pixel = 0, offset = 0; pixel < PIXELS; pixel += 1, offset += 4) {
    const red = rgba[offset]!;
    const green = rgba[offset + 1]!;
    const blue = rgba[offset + 2]!;
    if (
      red > policy.redGreaterThan &&
      green > policy.greenGreaterThan &&
      blue < policy.blueLessThan &&
      red - green < policy.redMinusGreenLessThan &&
      green - blue > policy.greenMinusBlueGreaterThan
    )
      mask[pixel] = 1;
  }
  const significant = components4(mask).filter(
    ({ pixels }) => pixels.length >= policy.minimumComponentPixels,
  );
  if (significant.length !== policy.exactSignificantComponents)
    throw new TypeError(
      `Step-42 strict yellow segmentation found ${significant.length} significant components, not exactly one.`,
    );
  const component = significant[0]!;
  const expectedBounds = transformBox(policy.exactNativeBounds, control);
  if (
    component.pixels.length !== policy.exactPixels ||
    component.minX !== expectedBounds.minX ||
    component.minY !== expectedBounds.minY ||
    component.maxX !== expectedBounds.maxX ||
    component.maxY !== expectedBounds.maxY
  )
    throw new TypeError(
      "Step-42 strict yellow segmentation did not reproduce its exact pixel count and mirrored bounds.",
    );
  return component;
}

function unsignedMeasurement(
  native: Uint8Array,
  control: ControlKind,
  admission: RealBuildPrefix50Step42SourceGeometryAdmission,
) {
  const rgba = transformRgba(native, control);
  const roi = transformBox(REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY.darkStudCore.roi, control);
  const cores = darkStudCores(rgba, roi);
  const tls = fitStudAxis(cores.qualified);
  const yellow = strictYellowComponent(rgba, control);
  const yellowProjections = yellow.pixels.map((pixel) =>
    tls.projection({ x: pixel % WIDTH, y: Math.floor(pixel / WIDTH) }),
  );
  const leftExtentPitches =
    (tls.rows[0]!.projection - Math.min(...yellowProjections)) / tls.meanPitch;
  const rightExtentPitches =
    (Math.max(...yellowProjections) - tls.rows.at(-1)!.projection) / tls.meanPitch;
  const imageLengthRoster = leftExtentPitches > rightExtentPitches ? [6, 4, 2] : [2, 4, 6];
  const topology = deriveRealBuildPrefix50Step42LocalTopology(admission);
  if (canonicalDigest(imageLengthRoster) !== canonicalDigest(topology.spatialLengthRoster))
    throw new TypeError(
      "Step-42 strict pixel segmentation reverses the exact raw-source 6636/3710/3069 spatial order.",
    );
  const sourceRows = topology.spatialRows.map((row, sourceRank) => ({
    sourceRank,
    occurrenceOrdinal: row.occurrenceOrdinal,
    officialDesignId: row.officialDesignId,
    catalogPartId: row.catalogPartId,
    documentX: row.catalogWorldTransform.positionLdu[0],
    threeX:
      row.catalogWorldTransform.positionLdu[0] *
      REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY.documentToThreeXScale,
    lengthStuds: row.lengthStuds,
    topStudCount: row.topStudCount,
  }));
  if (
    sourceRows.some(
      (row, index) => index > 0 && !(sourceRows[index - 1]!.documentX > row.documentX),
    ) ||
    sourceRows.some((row, index) => index > 0 && !(sourceRows[index - 1]!.threeX > row.threeX))
  )
    throw new TypeError("Step-42 image-right order is not decreasing in document and Three X.");
  return deepFreeze({
    control,
    transformedPixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(rgba),
    darkComponentCount: cores.allCount,
    qualifiedStudCores: tls.rows,
    tls: {
      center: tls.center,
      scatter: { xx: tls.xx, xy: tls.xy, yy: tls.yy },
      imageRightUnitAxis: tls.imageRightUnit,
      angleRadians: tls.angleRadians,
      angleDegrees: (tls.angleRadians * 180) / Math.PI,
      pitchGaps: tls.pitchGaps,
      meanPitch: tls.meanPitch,
      maximumGapDeviationFraction: tls.maximumGapDeviationFraction,
    },
    yellow: {
      pixels: yellow.pixels.length,
      bounds: { minX: yellow.minX, minY: yellow.minY, maxX: yellow.maxX, maxY: yellow.maxY },
      leftExtentPitches,
      rightExtentPitches,
      imageLengthRoster,
    },
    sourceRows,
    sourceImageRightDocumentUnitAxis: [-1, 0, 0] as const,
    sourceImageRightThreeUnitAxis: [-1, 0, 0] as const,
  });
}

function controlledUnsignedResult(
  native: Uint8Array,
  control: ControlKind,
  admission: RealBuildPrefix50Step42SourceGeometryAdmission,
) {
  try {
    const measurement = unsignedMeasurement(native, control, admission);
    return deepFreeze({ status: "unsigned-pass" as const, measurement });
  } catch (error) {
    return deepFreeze({
      status: "unsigned-refused" as const,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function deriveRealBuildPrefix50Step42SourceAxisDiagnostic(input: {
  readonly panelStep: 41 | 42;
  readonly rgba: Uint8Array;
  readonly sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission;
}) {
  const sourceGeometryReceipt = requireRealBuildPrefix50Step42SourceGeometryAdmission(
    input.sourceGeometryAdmission,
  );
  if (input.panelStep !== 42)
    throw new TypeError(
      "Step 41 is an unsigned control with four repeated equal-identity additions; only Step 42 may attempt a source-axis receipt.",
    );
  if (!(input.rgba instanceof Uint8Array) || input.rgba.byteLength !== PIXELS * 4)
    throw new RangeError("Step-42 source-axis diagnostic requires exact 720x470 RGBA pixels.");
  const sourceCropPixelDigest = sha256RealBuildPrefix50Step44ReviewBytes(input.rgba);
  if (sourceCropPixelDigest !== EXACT_SOURCE_CROP_PIXEL_DIGEST)
    throw new TypeError(
      "Step-42 source-axis diagnostic input is not the exact pinned native crop.",
    );
  const native = unsignedMeasurement(input.rgba, "native", input.sourceGeometryAdmission);
  const controls = {
    verticalMirror: controlledUnsignedResult(
      input.rgba,
      "vertical-mirror",
      input.sourceGeometryAdmission,
    ),
    horizontalMirror: controlledUnsignedResult(
      input.rgba,
      "horizontal-mirror",
      input.sourceGeometryAdmission,
    ),
    combinedMirror: controlledUnsignedResult(
      input.rgba,
      "combined-mirror",
      input.sourceGeometryAdmission,
    ),
    erasedLowerWall: {
      status: "signed-y-refused" as const,
      reason:
        "No source-bound lower-wall/base-rim correspondence exists to erase while retaining four proven top rims.",
    },
    ambiguityRefusal: {
      status: "signed-y-refused" as const,
      reason:
        "Native and vertical-mirror pixels both satisfy the same unsigned four-core and 6/4/2 evidence, so the transverse sign remains two-valued.",
    },
  };
  const body = {
    schemaVersion: "lego.real-build-prefix50-step42-source-axis-diagnostic/2" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    status: "signed-y-refused" as const,
    panelStep: 42 as const,
    sourceCropPixelDigest,
    sourceGeometryBindingCommitment: sourceGeometryReceipt.admittedBindingCommitment,
    sourceGeometrySemanticCommitment: sourceGeometryReceipt.semanticGeometryCommitment,
    sourceGeometryVerifierManifestCommitment: sourceGeometryReceipt.verifierManifestCommitment,
    sourceGeometryMemberCount: sourceGeometryReceipt.admittedBinding.members.length,
    policyCommitment: canonicalDigest(REAL_BUILD_PREFIX50_STEP42_SOURCE_AXIS_POLICY),
    native,
    measuredPlusDocumentX: {
      x: -native.tls.imageRightUnitAxis.x,
      y: -native.tls.imageRightUnitAxis.y,
    },
    measuredPlusDocumentY: null,
    fullRankCameraSeedCommitment: null,
    directVerticalCorrespondences: [] as const,
    controls,
    refusalReasons: [
      "Native Step-42 pixels do not provide four source-bound top-core/top-rim to lower-wall/base-rim correspondences.",
      "The adjacent cyan and lower black wall belong to the predecessor picture and have no Step-42 child-topology binding.",
      "Without direct correspondences, vertical/horizontal/combined mirror sign laws and the erased-wall refusal cannot be qualified.",
      "No qualifying full-rank camera seed commitment may be bound before the source-method scale bars pass.",
    ] as const,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function requireRealBuildPrefix50Step42SignedSourceAxis(
  diagnostic: ReturnType<typeof deriveRealBuildPrefix50Step42SourceAxisDiagnostic>,
): never {
  throw new TypeError(
    `Step-42 signed +Y source-axis receipt refused (${diagnostic.commitment}): ${diagnostic.refusalReasons.join(" ")}`,
  );
}

export type RealBuildPrefix50Step42SourceAxisDiagnostic = ReturnType<
  typeof deriveRealBuildPrefix50Step42SourceAxisDiagnostic
>;
export type RealBuildPrefix50Step42SourceAxisDiagnosticCommitment = Sha256Digest;
