export function requireRealBuildPrefix50ExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}
