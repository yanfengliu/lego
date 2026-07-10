export interface DataOnlyLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxStringChars: number;
  readonly maxKeyChars: number;
  readonly maxTotalChars: number;
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isArrayIndex(key: string, length: number): boolean {
  if (!/^(0|[1-9][0-9]*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index < length && String(index) === key;
}

/**
 * Preflights ordinary JavaScript values without reading data properties. Proxies
 * still require a process boundary that parses bounded bytes into inert data.
 */
export function cloneBoundedDataOnlyJson(value: unknown, limits: DataOnlyLimits): unknown | null {
  const pending: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let characters = 0;
  try {
    while (pending.length > 0) {
      const current = pending.pop()!;
      nodes += 1;
      if (nodes > limits.maxNodes || current.depth > limits.maxDepth) return null;
      if (isPrimitive(current.value)) {
        if (typeof current.value === "string") {
          if (current.value.length > limits.maxStringChars) return null;
          characters += current.value.length;
          if (characters > limits.maxTotalChars) return null;
        }
        continue;
      }
      if (typeof current.value !== "object" || current.value === null) return null;
      if (seen.has(current.value)) continue;
      seen.add(current.value);

      const array = Array.isArray(current.value);
      const prototype = Object.getPrototypeOf(current.value) as object | null;
      if (
        (array && prototype !== Array.prototype) ||
        (!array && prototype !== Object.prototype && prototype !== null)
      ) {
        return null;
      }
      if (array) {
        const length = Object.getOwnPropertyDescriptor(current.value, "length")?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > limits.maxNodes) return null;
      }
      const descriptors = Object.getOwnPropertyDescriptors(current.value);
      if (Reflect.ownKeys(descriptors).some((key) => typeof key === "symbol")) return null;
      const keys = Object.keys(descriptors);
      for (const key of keys) {
        if (key.length > limits.maxKeyChars) return null;
        characters += key.length;
        if (characters > limits.maxTotalChars) return null;
      }
      const children: unknown[] = [];
      if (array) {
        const lengthDescriptor = descriptors.length;
        if (!lengthDescriptor || !("value" in lengthDescriptor)) return null;
        const length = lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) return null;
        for (const key of keys) {
          if (key === "length") continue;
          const descriptor = descriptors[key];
          if (
            !descriptor ||
            !("value" in descriptor) ||
            !descriptor.enumerable ||
            !isArrayIndex(key, length)
          ) {
            return null;
          }
          children.push(descriptor.value);
        }
      } else {
        for (const key of keys) {
          const descriptor = descriptors[key];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
          children.push(descriptor.value);
        }
      }
      if (nodes + pending.length + children.length > limits.maxNodes) return null;
      for (const child of children) pending.push({ value: child, depth: current.depth + 1 });
    }
    return structuredClone(value);
  } catch {
    return null;
  }
}
