import { PART_DEFINITIONS, type PartDefinition, type PartFamily } from "@lego-studio/catalog";

/** Families in palette order, with the label the panel shows. */
export const PART_FAMILY_ORDER: readonly PartFamily[] = Object.freeze([
  "brick",
  "plate",
  "jumper-plate",
  "wedge-plate",
  "tile",
  "grille-tile",
]);

export const PART_FAMILY_LABELS: Readonly<Record<PartFamily, string>> = Object.freeze({
  brick: "Bricks",
  plate: "Plates",
  tile: "Tiles",
  "jumper-plate": "Jumper plates",
  "wedge-plate": "Wedge plates",
  "grille-tile": "Grille tiles",
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

/** Text a part can be found by part-way through: its name, family, LDraw alias. */
function searchableTerms(part: PartDefinition): readonly string[] {
  return [
    normalizePartQuery(part.displayName),
    part.family,
    ...part.aliases.map(({ value }) => value.toLowerCase()),
  ];
}

/**
 * A part's size, matched whole rather than part-way through.
 *
 * Substring matching a size is wrong once the catalog holds a part with a
 * two-digit dimension: "12x4" contains "2x4", so searching for a 2x4 plate
 * returned the 4x12 as well.
 */
function sizeTerms(part: PartDefinition): readonly string[] {
  const { widthStuds, lengthStuds } = part.dimensions;
  // Size is symmetric to a builder: a 2x4 is also a 4x2.
  return [`${widthStuds}x${lengthStuds}`, `${lengthStuds}x${widthStuds}`];
}

export function matchesPartQuery(part: PartDefinition, query: string): boolean {
  const normalized = normalizePartQuery(query);
  if (normalized.length === 0) return true;
  if (sizeTerms(part).includes(normalized)) return true;
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
