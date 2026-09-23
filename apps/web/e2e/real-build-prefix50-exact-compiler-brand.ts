import type { RealBuildPrefix50ExactCompilation } from "./real-build-prefix50-exact-compiler-contract.ts";

const exactCompilations = new WeakSet<object>();
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

export function brandRealBuildPrefix50ExactCompilation(
  value: RealBuildPrefix50ExactCompilation,
): void {
  SAFE_APPLY(SAFE_WEAK_SET_ADD, exactCompilations, [value]);
}

export function requireRealBuildPrefix50ExactCompilation(
  value: unknown,
): RealBuildPrefix50ExactCompilation {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_APPLY(SAFE_WEAK_SET_HAS, exactCompilations, [value])
  )
    throw new TypeError(
      "Prefix-50 finalization requires the exact runtime-branded real-evidence compilation; caller clones and diagnostic lookalikes carry no completion authority.",
    );
  return value as RealBuildPrefix50ExactCompilation;
}
