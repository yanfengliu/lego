import { CALLOUT_RECOVERY_BY_IDENTITY } from "./callout-recovery-fixture.ts";

const METRIC_FIELDS = [
  "foregroundPixels",
  "sourceTextGlyphPixels",
  "sourceQuantityGlyphPixels",
  "textGlyphOverlapPixels",
  "quantityGlyphOverlapPixels",
  "quantityGlyphPixelsMasked",
] as const;

const ARRAY_IS_ARRAY = Array.isArray;
const MAP_GET = Map.prototype.get;
const MATH_MIN = Math.min;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_HAS_OWN = Object.hasOwn;
const REFLECT_APPLY = Reflect.apply;
const REFLECT_OWN_KEYS = Reflect.ownKeys;

function recoveryFixtureFor(identity: string) {
  return REFLECT_APPLY(MAP_GET, CALLOUT_RECOVERY_BY_IDENTITY, [identity]) as ReturnType<
    typeof CALLOUT_RECOVERY_BY_IDENTITY.get
  >;
}

const boundedMetric = (value: unknown): value is number =>
  NUMBER_IS_SAFE_INTEGER(value) && (value as number) >= 0 && (value as number) <= 4_000_000;
const boundedDimension = (value: unknown): value is number =>
  NUMBER_IS_SAFE_INTEGER(value) && (value as number) >= 1 && (value as number) <= 4_096;
const nonnegativeInteger = (value: unknown): value is number =>
  NUMBER_IS_SAFE_INTEGER(value) && (value as number) >= 0;
const BOUNDS_KEYS = ["bottom", "left", "right", "top"];
const exactBoundsKeys = (value: object): boolean => {
  if (REFLECT_OWN_KEYS(value).length !== BOUNDS_KEYS.length) return false;
  for (let index = 0; index < BOUNDS_KEYS.length; index += 1) {
    if (!OBJECT_HAS_OWN(value, BOUNDS_KEYS[index]!)) return false;
  }
  return true;
};
const sameArray = (left: unknown, right: readonly unknown[]): boolean => {
  if (!ARRAY_IS_ARRAY(left) || left.length !== right.length) return false;
  for (let index = 0; index < right.length; index += 1) {
    if (!OBJECT_HAS_OWN(left, index) || left[index] !== right[index]) return false;
  }
  return true;
};
const sameBounds = (left: unknown, right: unknown): boolean => {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return false;
  const observed = left as Record<string, unknown>;
  const expected = right as Record<string, unknown>;
  for (let index = 0; index < BOUNDS_KEYS.length; index += 1) {
    const key = BOUNDS_KEYS[index]!;
    if (observed[key] !== expected[key]) return false;
  }
  return true;
};
const boundedBox = (
  value: unknown,
): value is Record<"left" | "top" | "right" | "bottom", number> => {
  const box = value as Record<string, unknown> | null;
  return (
    box !== null &&
    typeof box === "object" &&
    exactBoundsKeys(box) &&
    nonnegativeInteger(box.left) &&
    nonnegativeInteger(box.top) &&
    nonnegativeInteger(box.right) &&
    nonnegativeInteger(box.bottom) &&
    (box.left as number) <= (box.right as number) &&
    (box.top as number) <= (box.bottom as number)
  );
};
const boundedClearance = (
  value: unknown,
): value is Record<"left" | "top" | "right" | "bottom", number> => {
  const margins = value as Record<string, unknown> | null;
  return (
    margins !== null &&
    typeof margins === "object" &&
    exactBoundsKeys(margins) &&
    nonnegativeInteger(margins.left) &&
    nonnegativeInteger(margins.top) &&
    nonnegativeInteger(margins.right) &&
    nonnegativeInteger(margins.bottom)
  );
};

export function assertCalloutEvidenceContract(
  callouts: readonly Record<string, unknown>[],
  label = "Callout manifest",
): void {
  if (!ARRAY_IS_ARRAY(callouts) || callouts.length < 1 || callouts.length > 2_000) {
    throw new Error(`${label} must contain 1..2000 bounded evidence records.`);
  }
  for (let index = 0; index < callouts.length; index += 1) {
    const callout = callouts[index]!;
    const owner =
      typeof callout.identity === "string" && callout.identity.length <= 96
        ? callout.identity
        : `entry ${index}`;
    const fixture =
      typeof callout.identity === "string" ? recoveryFixtureFor(callout.identity) : undefined;
    const expectedKind = fixture?.evidenceKind ?? "part-art";
    const expectedRegion = fixture?.regionKind ?? "isolated-component";
    const expectedMasks = fixture?.requiredMasks ?? ["all-pdf-text"];
    const expectedStrategy =
      expectedKind === "part-art" ? "ranked-component" : "semantic-action-region";
    let metricsAreBounded = true;
    for (let metricIndex = 0; metricIndex < METRIC_FIELDS.length; metricIndex += 1) {
      if (!boundedMetric(callout[METRIC_FIELDS[metricIndex]!])) {
        metricsAreBounded = false;
        break;
      }
    }
    const cropRect = callout.cropRectPx;
    const clearance = callout.boundaryClearancePx;
    const geometryIsBounded =
      boundedBox(cropRect) &&
      boundedClearance(clearance) &&
      cropRect.right - cropRect.left + 1 === callout.widthPx &&
      cropRect.bottom - cropRect.top + 1 === callout.heightPx;
    const minimumClearance = fixture?.minimumBoundaryClearancePx ?? 0;
    if (
      callout.evidenceKind !== expectedKind ||
      callout.regionKind !== expectedRegion ||
      callout.cropStrategy !== expectedStrategy ||
      !sameArray(callout.masksApplied, expectedMasks) ||
      !ARRAY_IS_ARRAY(callout.contamination) ||
      callout.contamination.length !== 0 ||
      !metricsAreBounded ||
      !boundedDimension(callout.widthPx) ||
      !boundedDimension(callout.heightPx) ||
      (callout.widthPx as number) * (callout.heightPx as number) > 16 * 1024 * 1024 ||
      !geometryIsBounded ||
      (callout.widthPx as number) < (fixture?.minimumWidthPx ?? 1) ||
      (callout.heightPx as number) < (fixture?.minimumHeightPx ?? 1) ||
      (callout.foregroundPixels as number) < (fixture?.minimumForegroundPixels ?? 1) ||
      (geometryIsBounded &&
        REFLECT_APPLY(MATH_MIN, Math, [
          clearance.left,
          clearance.top,
          clearance.right,
          clearance.bottom,
        ]) < minimumClearance) ||
      (callout.foregroundPixels as number) >
        (callout.widthPx as number) * (callout.heightPx as number) ||
      (callout.textGlyphOverlapPixels as number) > (callout.sourceTextGlyphPixels as number) ||
      (callout.quantityGlyphOverlapPixels as number) >
        (callout.sourceQuantityGlyphPixels as number) ||
      (callout.quantityGlyphPixelsMasked as number) > (callout.sourceQuantityGlyphPixels as number)
    ) {
      throw new Error(
        `${label} ${owner} must match its preregistered evidence kind, region, crop strategy and masks; retain no contamination; and carry bounded, internally consistent glyph metrics.`,
      );
    }
    if (expectedKind === "part-art") {
      if (
        callout.sourceTextGlyphPixels !== 0 ||
        callout.sourceQuantityGlyphPixels !== 0 ||
        callout.textGlyphOverlapPixels !== 0 ||
        callout.quantityGlyphOverlapPixels !== 0 ||
        callout.quantityGlyphPixelsMasked !== 0
      ) {
        throw new Error(
          `${label} ${owner} physical component must exclude every PDF-text and quantity glyph pixel before publication.`,
        );
      }
      const component = callout.sourceComponent as {
        readonly boundsPx?: unknown;
        readonly rawComponentCount?: unknown;
        readonly absoluteForegroundSha256?: unknown;
      } | null;
      if (
        !Number.isSafeInteger(component?.rawComponentCount) ||
        (component?.rawComponentCount as number) < 1 ||
        (component?.rawComponentCount as number) > 64 ||
        (fixture?.expectedSourceComponentBoundsPx &&
          !sameBounds(component?.boundsPx, fixture.expectedSourceComponentBoundsPx)) ||
        (fixture?.expectedSourceComponentSha256 &&
          component?.absoluteForegroundSha256 !== fixture.expectedSourceComponentSha256)
      ) {
        throw new Error(
          `${label} ${owner} must retain 1..64 raw members and the preregistered exact source-component-group bounds and digest for this fixed recovery case.`,
        );
      }
    } else if (
      callout.sourceQuantityGlyphPixels === 0 ||
      callout.quantityGlyphOverlapPixels !== 0 ||
      callout.quantityGlyphPixelsMasked !== callout.sourceQuantityGlyphPixels
    ) {
      throw new Error(
        `${label} ${owner} semantic crop must prove that its complete printed quantity glyph was found and masked without retained overlap.`,
      );
    }
  }
}
