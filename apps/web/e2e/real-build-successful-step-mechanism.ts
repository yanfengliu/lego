export type SuccessfulStepMechanism =
  | "anchor-orientation"
  | "highlight"
  | "arrow"
  | "exhaustive"
  | "deferred-lookahead"
  | "exploded-ghost"
  | "compiled-observation"
  | "instruction-transition"
  | "official-ledger";

const MECHANISMS: readonly SuccessfulStepMechanism[] = [
  "anchor-orientation",
  "highlight",
  "arrow",
  "exhaustive",
  "deferred-lookahead",
  "exploded-ghost",
  "compiled-observation",
  "instruction-transition",
  "official-ledger",
];

export function isRealBuildSuccessfulStepMechanism(
  value: unknown,
): value is SuccessfulStepMechanism {
  if (typeof value !== "string") return false;
  for (let index = 0; index < MECHANISMS.length; index += 1) {
    if (value === MECHANISMS[index]) return true;
  }
  return false;
}
