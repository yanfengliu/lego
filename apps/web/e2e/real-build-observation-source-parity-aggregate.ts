import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityAggregate,
  type RealBuildSourceParityBrowserResult,
  type RealBuildSourceParityMaskComparison,
} from "./real-build-observation-source-parity-types";

type MetricKey =
  "productionArea" | "candidateArea" | "intersectionPixels" | "unionPixels" | "mismatchPixels";

export function aggregateRealBuildSourceParitySteps(
  steps: RealBuildSourceParityBrowserResult["steps"],
): readonly RealBuildSourceParityAggregate[] {
  const totalPixels = steps.reduce((sum, step) => sum + step.width * step.height, 0);
  return REAL_BUILD_SOURCE_PARITY_CLASSES.map((sourceClass) => {
    const metrics = steps.map((step) =>
      step.comparisons.find((entry) => entry.sourceClass === sourceClass),
    );
    if (metrics.some((entry) => entry === undefined)) {
      throw new TypeError(`Source-parity aggregate is missing ${sourceClass} comparisons.`);
    }
    const complete = metrics as readonly RealBuildSourceParityMaskComparison[];
    const total = (key: MetricKey): number => complete.reduce((sum, entry) => sum + entry[key], 0);
    const intersectionPixels = total("intersectionPixels");
    const unionPixels = total("unionPixels");
    return {
      sourceClass,
      panels: complete.length,
      panelsDiffering: complete.filter(({ mismatchPixels }) => mismatchPixels > 0).length,
      totalPixels,
      productionArea: total("productionArea"),
      candidateArea: total("candidateArea"),
      intersectionPixels,
      unionPixels,
      mismatchPixels: total("mismatchPixels"),
      iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
      meanIou: complete.reduce((sum, entry) => sum + entry.iou, 0) / complete.length,
      minimumIou: Math.min(...complete.map(({ iou }) => iou)),
    };
  });
}
