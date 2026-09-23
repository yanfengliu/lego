import type {
  RealBuildPrefix50ReviewedVisualBinding,
  RealBuildPrefix50SelectedSubBuildReturn,
  RealBuildPrefix50SubBuildReturnResult,
} from "./real-build-prefix50-subbuild-return-contract";

export function createRealBuildPrefix50SubBuildReturnBrands() {
  const productionResults = new WeakSet<object>();
  const syntheticReviewResults = new WeakSet<object>();
  const reviewedBindings = new WeakSet<object>();
  const selectedResults = new WeakSet<object>();
  const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
  const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
  const SAFE_APPLY = Reflect.apply;

  function add(set: WeakSet<object>, value: object): void {
    SAFE_APPLY(SAFE_WEAK_SET_ADD, set, [value]);
  }

  function has(set: WeakSet<object>, value: object): boolean {
    return SAFE_APPLY(SAFE_WEAK_SET_HAS, set, [value]) as boolean;
  }

  function brandRealBuildPrefix50SubBuildReturnResult(
    result: RealBuildPrefix50SubBuildReturnResult,
  ): void {
    add(productionResults, result);
  }

  function brandRealBuildPrefix50SyntheticReviewResult(
    result: RealBuildPrefix50SubBuildReturnResult,
  ): RealBuildPrefix50SubBuildReturnResult {
    add(syntheticReviewResults, result);
    return result;
  }

  function requireRealBuildPrefix50SubBuildReturnResult(
    value: unknown,
  ): RealBuildPrefix50SubBuildReturnResult {
    if (value === null || typeof value !== "object" || !has(productionResults, value))
      throw new TypeError(
        "Prefix-50 return requires the exact runtime-branded enumeration receipt; caller clones carry no selection authority.",
      );
    return value as RealBuildPrefix50SubBuildReturnResult;
  }

  function requireRealBuildPrefix50SubBuildReturnReviewResult(
    value: unknown,
  ): RealBuildPrefix50SubBuildReturnResult {
    if (
      value === null ||
      typeof value !== "object" ||
      (!has(productionResults, value) && !has(syntheticReviewResults, value))
    )
      throw new TypeError("Prefix-50 review requires a runtime-branded return receipt.");
    return value as RealBuildPrefix50SubBuildReturnResult;
  }

  function brandRealBuildPrefix50ReviewedVisualBinding(
    binding: RealBuildPrefix50ReviewedVisualBinding,
  ): void {
    add(reviewedBindings, binding);
  }

  function requireRealBuildPrefix50ReviewedVisualBinding(
    value: unknown,
  ): RealBuildPrefix50ReviewedVisualBinding {
    if (value === null || typeof value !== "object" || !has(reviewedBindings, value))
      throw new TypeError(
        "Prefix-50 return selection requires a repository-owned reviewed visual binding; caller lookalikes and clones are forbidden.",
      );
    return value as RealBuildPrefix50ReviewedVisualBinding;
  }

  function brandRealBuildPrefix50SelectedSubBuildReturn(
    selected: RealBuildPrefix50SelectedSubBuildReturn,
  ): void {
    add(selectedResults, selected);
  }

  function requireRealBuildPrefix50SelectedSubBuildReturn(
    value: unknown,
  ): RealBuildPrefix50SelectedSubBuildReturn {
    if (value === null || typeof value !== "object" || !has(selectedResults, value))
      throw new TypeError(
        "Prefix-50 return requires the exact runtime-branded selected receipt; caller clones carry no selection authority.",
      );
    return value as RealBuildPrefix50SelectedSubBuildReturn;
  }

  return Object.freeze({
    brandRealBuildPrefix50ReviewedVisualBinding,
    brandRealBuildPrefix50SelectedSubBuildReturn,
    brandRealBuildPrefix50SubBuildReturnResult,
    brandRealBuildPrefix50SyntheticReviewResult,
    requireRealBuildPrefix50ReviewedVisualBinding,
    requireRealBuildPrefix50SelectedSubBuildReturn,
    requireRealBuildPrefix50SubBuildReturnResult,
    requireRealBuildPrefix50SubBuildReturnReviewResult,
  });
}

export const realBuildPrefix50SubBuildReturnBrands = createRealBuildPrefix50SubBuildReturnBrands();
