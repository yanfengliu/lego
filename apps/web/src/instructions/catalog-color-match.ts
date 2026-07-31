import { COLOR_DEFINITIONS } from "@lego-studio/catalog";

/**
 * Maps a colour lifted off a booklet page onto the catalog palette.
 *
 * Because the art is vector, a brick's colour arrives as an exact fill rather
 * than as pixels to classify. Matching it is then a nearest-neighbour lookup,
 * and how close the nearest neighbour sits is itself a signal: art that matches
 * the palette tightly says the reader is looking at bricks, while a poor match
 * says it is looking at shadows, outlines, or page furniture.
 */
export interface ColorMatch {
  readonly colorId: string;
  readonly displayName: string;
  /** Euclidean distance in sRGB, 0 for an exact hit and 441 at the extreme. */
  readonly distance: number;
}

/** Distance under which a fill is treated as naming a catalog colour. */
export const CATALOG_COLOR_TOLERANCE = 40;

export function parseHexColor(hex: string): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const PALETTE = COLOR_DEFINITIONS.map((color) => ({
  colorId: color.id,
  displayName: color.displayName,
  rgb: parseHexColor(color.displayHex) ?? ([0, 0, 0] as const),
}));

/** The catalog colour closest to a fill, or null if the fill is unreadable. */
export function matchCatalogColor(hex: string): ColorMatch | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;

  let best: ColorMatch | null = null;
  for (const entry of PALETTE) {
    const distance = Math.hypot(
      rgb[0] - entry.rgb[0],
      rgb[1] - entry.rgb[1],
      rgb[2] - entry.rgb[2],
    );
    if (!best || distance < best.distance) {
      best = { colorId: entry.colorId, displayName: entry.displayName, distance };
    }
  }
  return best;
}

export interface ColorCoverage {
  readonly distinctFills: number;
  /** Fills within tolerance of a catalog colour. */
  readonly matched: number;
  readonly matchedFraction: number;
  /** Fills no catalog colour comes close to, worst first. */
  readonly unmatched: readonly { readonly fillHex: string; readonly nearest: ColorMatch | null }[];
}

/**
 * How much of a page's palette the catalog accounts for. This is measurable the
 * moment shapes are extracted, with no model built and no placement guessed.
 */
export function scoreColorCoverage(
  fills: readonly string[],
  tolerance = CATALOG_COLOR_TOLERANCE,
): ColorCoverage {
  const distinct = [...new Set(fills)];
  const scored = distinct.map((fillHex) => ({ fillHex, nearest: matchCatalogColor(fillHex) }));
  const matched = scored.filter(({ nearest }) => nearest !== null && nearest.distance <= tolerance);

  return {
    distinctFills: distinct.length,
    matched: matched.length,
    matchedFraction: distinct.length === 0 ? 0 : matched.length / distinct.length,
    unmatched: scored
      .filter(({ nearest }) => nearest === null || nearest.distance > tolerance)
      .sort((left, right) => (right.nearest?.distance ?? 0) - (left.nearest?.distance ?? 0)),
  };
}
