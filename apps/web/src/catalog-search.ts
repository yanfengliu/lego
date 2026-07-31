import { PART_DEFINITIONS, type PartDefinition, type PartFamily } from "@lego-studio/catalog";

/** Families in palette order, with the label the panel shows. */
export const PART_FAMILY_ORDER: readonly PartFamily[] = Object.freeze(["brick", "plate", "tile"]);

export const PART_FAMILY_LABELS: Readonly<Record<PartFamily, string>> = Object.freeze({
  brick: "Bricks",
  plate: "Plates",
  tile: "Tiles",
});

/**
 * Folds the many ways a size gets typed onto one form, so "2x4", "2 x 4", and
 * "2X4" all find the same part.
 */
export function normalizePartQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*x\s*/g, "x")
    .replace(/\s+/g, " ");
}

/** The text a part can be found by: its name, family, size, and LDraw alias. */
function searchableTerms(part: PartDefinition): readonly string[] {
  const { widthStuds, lengthStuds } = part.dimensions;
  return [
    normalizePartQuery(part.displayName),
    part.family,
    `${widthStuds}x${lengthStuds}`,
    // Size is symmetric to a builder: a 2x4 is also a 4x2.
    `${lengthStuds}x${widthStuds}`,
    ...part.aliases.map(({ value }) => value.toLowerCase()),
  ];
}

export function matchesPartQuery(part: PartDefinition, query: string): boolean {
  const normalized = normalizePartQuery(query);
  if (normalized.length === 0) return true;
  return searchableTerms(part).some((term) => term.includes(normalized));
}

export interface PartFamilyGroup {
  readonly family: PartFamily;
  readonly label: string;
  readonly parts: readonly PartDefinition[];
}

/**
 * Groups the catalog for display. Families keep their palette order and parts
 * keep catalog order, so the panel is stable between renders.
 */
export function groupPartsByFamily(parts: readonly PartDefinition[]): readonly PartFamilyGroup[] {
  return PART_FAMILY_ORDER.map((family) => ({
    family,
    label: PART_FAMILY_LABELS[family],
    parts: parts.filter((part) => part.family === family),
  })).filter(({ parts: familyParts }) => familyParts.length > 0);
}

export interface PartSearchOptions {
  readonly query: string;
  /** null shows every family. */
  readonly family: PartFamily | null;
}

export function searchParts({ query, family }: PartSearchOptions): readonly PartDefinition[] {
  return PART_DEFINITIONS.filter(
    (part) => (family === null || part.family === family) && matchesPartQuery(part, query),
  );
}

/** How many parts each family holds, for the filter chips. */
export function countPartsByFamily(): Readonly<Record<PartFamily, number>> {
  const counts = Object.fromEntries(PART_FAMILY_ORDER.map((family) => [family, 0])) as Record<
    PartFamily,
    number
  >;
  for (const part of PART_DEFINITIONS) counts[part.family] += 1;
  return counts;
}
