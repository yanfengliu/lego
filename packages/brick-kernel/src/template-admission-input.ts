import { normalizeTemplateSnapshotContent, type TemplateSnapshotV1 } from "@lego-studio/protocol";

export interface DataOnlyJsonLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
}

function isDataPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * Rejects ordinary accessor-bearing and non-JSON objects before structuredClone.
 * JavaScript cannot inspect an arbitrary Proxy without invoking its traps, so
 * process trust boundaries must still parse bounded bytes into inert data.
 */
export function isBoundedDataOnlyJson(
  value: unknown,
  { maxDepth, maxNodes }: DataOnlyJsonLimits,
): boolean {
  const pending: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let visitedNodes = 0;

  try {
    while (pending.length > 0) {
      const current = pending.pop()!;
      visitedNodes += 1;
      if (visitedNodes > maxNodes) return false;
      if (isDataPrimitive(current.value)) continue;
      if (typeof current.value !== "object" || current.value === null) return false;
      if (current.depth > maxDepth) return false;
      if (seen.has(current.value)) continue;
      seen.add(current.value);

      const array = Array.isArray(current.value);
      const prototype = Object.getPrototypeOf(current.value) as object | null;
      if (
        (array && prototype !== Array.prototype) ||
        (!array && prototype !== Object.prototype && prototype !== null)
      ) {
        return false;
      }

      const descriptors = Object.getOwnPropertyDescriptors(current.value);
      const ownKeys = Reflect.ownKeys(descriptors);
      if (ownKeys.some((key) => typeof key !== "string")) return false;
      const keys = ownKeys as string[];
      const childValues: unknown[] = [];

      if (array) {
        const lengthDescriptor = descriptors.length;
        if (!lengthDescriptor || !("value" in lengthDescriptor)) return false;
        const length = lengthDescriptor.value as unknown;
        if (!Number.isSafeInteger(length) || (length as number) < 0) return false;
        if (keys.length !== (length as number) + 1) return false;
        for (const key of keys) {
          if (key === "length") continue;
          const descriptor = descriptors[key];
          if (
            !isCanonicalArrayIndex(key, length as number) ||
            !descriptor ||
            !("value" in descriptor) ||
            !descriptor.enumerable
          ) {
            return false;
          }
          childValues.push(descriptor.value);
        }
      } else {
        for (const key of keys) {
          const descriptor = descriptors[key];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return false;
          childValues.push(descriptor.value);
        }
      }

      if (visitedNodes + pending.length + childValues.length > maxNodes) return false;
      for (const child of childValues) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  } catch {
    return false;
  }

  return true;
}

export function canonicalTemplateSnapshot(snapshot: TemplateSnapshotV1): TemplateSnapshotV1 {
  const normalizedContent = normalizeTemplateSnapshotContent(snapshot) as Omit<
    TemplateSnapshotV1,
    "contentHash"
  >;
  const normalizeLdu = (values: readonly [number, number, number]) =>
    values.map((value) => (Object.is(value, -0) ? 0 : value)) as [number, number, number];

  return {
    ...normalizedContent,
    parts: normalizedContent.parts.map((part) => ({
      ...part,
      transform: {
        positionLdu: normalizeLdu(part.transform.positionLdu),
        orientationId: part.transform.orientationId,
      },
    })),
    clearanceVolume: {
      minLdu: normalizeLdu(normalizedContent.clearanceVolume.minLdu),
      maxLdu: normalizeLdu(normalizedContent.clearanceVolume.maxLdu),
    },
    provenance: {
      origin: normalizedContent.provenance.origin,
      sourceId: normalizedContent.provenance.sourceId,
      ...(normalizedContent.provenance.sourceHash === undefined
        ? {}
        : { sourceHash: normalizedContent.provenance.sourceHash }),
    },
    license: {
      spdxExpression: normalizedContent.license.spdxExpression,
      attribution: normalizedContent.license.attribution,
      redistribution: normalizedContent.license.redistribution,
    },
    contentHash: snapshot.contentHash,
  };
}
