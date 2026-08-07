/**
 * Reads the filled shapes a booklet page is drawn from.
 *
 * Where a page is vector art, this is far more tractable than pixels: a fill
 * arrives as an exact colour, so identifying it is a lookup rather than a
 * classification.
 *
 * It does not read the brick art. Rendering the sample booklet and looking at it
 * settled that: the assemblies are raster images, and the filled paths on a
 * build page are the callout box, the panel divider, the progress bar, and
 * similar furniture. Six sampled pages yielded 119 paths and five colours, all
 * page chrome. This is useful for finding a page's regions, not its bricks.
 *
 * The operator list is untrusted like the rest of the document, so the shape
 * count is bounded and a malformed operand is skipped rather than trusted.
 */
export const PAGE_SHAPES_SCHEMA_VERSION = "lego.page-shapes/1" as const;

export const PAGE_SHAPE_LIMITS = Object.freeze({
  maxShapesPerPage: 20_000,
  maxOperatorsPerPage: 200_000,
});

export interface PageShapeLimits {
  readonly maxShapesPerPage: number;
  readonly maxOperatorsPerPage: number;
}

export interface ShapeBounds {
  readonly minXPt: number;
  readonly minYPt: number;
  readonly maxXPt: number;
  readonly maxYPt: number;
}

export interface PageShape {
  /** sRGB fill as `#rrggbb`. */
  readonly fillHex: string;
  readonly bounds: ShapeBounds;
  /** Corners the page-space bounds were derived from. */
  readonly pointCount: number;
}

/** The pdfjs operator list, narrowed to what this reader uses. */
export interface OperatorList {
  readonly fnArray: readonly number[];
  readonly argsArray: readonly unknown[];
}

/**
 * Operator codes this reader reacts to, supplied by the caller from pdfjs OPS.
 *
 * A path does not get its own paint operator: pdfjs packs the intended one into
 * the `constructPath` operands, so `fill` and `eoFill` are matched there rather
 * than looked for in the operator stream.
 */
export interface ShapeOperatorCodes {
  readonly setFillRGBColor: number;
  readonly constructPath: number;
  readonly fill: number;
  readonly eoFill: number;
  readonly fillStroke: number;
  readonly save: number;
  readonly restore: number;
  readonly transform: number;
}

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function applyMatrix(matrix: Matrix, x: number, y: number): readonly [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

function toHex(value: unknown): string {
  const channel = typeof value === "number" ? Math.round(value) : 0;
  return Math.min(255, Math.max(0, channel)).toString(16).padStart(2, "0");
}

/**
 * The fill operand. pdfjs hands this over as an already-formatted CSS hex
 * string rather than as three channels; treating it as numbers silently yields
 * black for every shape on the page. Numeric channels are still accepted, since
 * other producers and older versions emit them.
 */
function readFillHex(args: unknown): string | null {
  const operands = Array.isArray(args) ? args : [];
  const first = operands[0];
  if (typeof first === "string") {
    const hex = /^#([0-9a-f]{6})$/i.exec(first.trim());
    return hex ? `#${hex[1]!.toLowerCase()}` : null;
  }
  if (typeof first !== "number") return null;
  return `#${toHex(operands[0])}${toHex(operands[1])}${toHex(operands[2])}`;
}

function asMatrix(value: unknown): Matrix | null {
  if (!Array.isArray(value) || value.length < 6) return null;
  const entries = value.slice(0, 6);
  if (!entries.every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  return entries as unknown as Matrix;
}

/**
 * A `constructPath`'s operands: the paint operator it is destined for, and the
 * bounding box pdfjs has already computed for it, as `[minX, minY, maxX, maxY]`
 * in path space. Taking that box saves walking every segment and matches what
 * pdfjs itself uses for culling.
 */
function pathOperands(args: unknown): { readonly drawKind: number; readonly box: number[] } | null {
  if (!Array.isArray(args) || args.length < 3) return null;
  const drawKind = args[0];
  const box = args[2];
  if (typeof drawKind !== "number") return null;
  const values =
    box instanceof Float32Array || box instanceof Float64Array
      ? Array.from(box)
      : Array.isArray(box)
        ? box
        : null;
  if (!values || values.length < 4) return null;
  if (!values.slice(0, 4).every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }
  return { drawKind, box: values.slice(0, 4) };
}

export interface ExtractShapesOptions {
  readonly limits?: PageShapeLimits;
}

/**
 * Walks a page's operator list into filled shapes in page coordinates.
 *
 * Save and restore carry the whole graphics state, not just the transform.
 * PDF's `q`/`Q` save and restore the fill colour too, so a shape drawn after a
 * restore takes the colour that was current at the matching save — it does not
 * need a `setFillRGBColor` of its own. Stacking the transform alone let the
 * colour leak forwards across a restore, and every such shape was reported in
 * whatever colour happened to be left over.
 *
 * Measured on 6651557 page 13, which prints the rotate-the-model icon twice:
 * both are drawn as a white rounded square under a black glyph, the second
 * relies on the restored white, and it was reported `#000000`. The icon
 * detector keys on `#ffffff`, so step 8's icon was invisible and the booklet's
 * 39 icons read as one per page — the count that made a two-icon page look
 * impossible.
 */
export function extractPageShapes(
  operators: OperatorList,
  codes: ShapeOperatorCodes,
  { limits = PAGE_SHAPE_LIMITS }: ExtractShapesOptions = {},
): readonly PageShape[] {
  const shapes: PageShape[] = [];
  const stack: { readonly transform: Matrix; readonly fillHex: string }[] = [];
  let transform: Matrix = IDENTITY;
  let fillHex = "#000000";

  const operatorCount = Math.min(operators.fnArray.length, limits.maxOperatorsPerPage);
  for (let index = 0; index < operatorCount; index += 1) {
    if (shapes.length >= limits.maxShapesPerPage) break;
    const code = operators.fnArray[index];
    const args = operators.argsArray[index];

    if (code === codes.save) {
      stack.push({ transform, fillHex });
    } else if (code === codes.restore) {
      const restored = stack.pop();
      transform = restored?.transform ?? IDENTITY;
      fillHex = restored?.fillHex ?? "#000000";
    } else if (code === codes.transform) {
      const matrix = asMatrix(args);
      if (matrix) transform = multiply(transform, matrix);
    } else if (code === codes.setFillRGBColor) {
      const parsed = readFillHex(args);
      if (parsed) fillHex = parsed;
    } else if (code === codes.constructPath) {
      const operands = pathOperands(args);
      if (!operands) continue;
      // A stroked or merely closed path is an outline, not a piece of art.
      const isFilled =
        operands.drawKind === codes.fill ||
        operands.drawKind === codes.eoFill ||
        operands.drawKind === codes.fillStroke;
      if (!isFilled) continue;

      const [x0, y0, x1, y1] = operands.box as [number, number, number, number];
      // The box is axis-aligned in path space; a rotation makes its corners the
      // only honest source for page-space bounds.
      const corners = [
        applyMatrix(transform, x0, y0),
        applyMatrix(transform, x1, y0),
        applyMatrix(transform, x1, y1),
        applyMatrix(transform, x0, y1),
      ];
      if (!corners.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) continue;

      shapes.push({
        fillHex,
        bounds: {
          minXPt: Math.min(...corners.map(([x]) => x)),
          minYPt: Math.min(...corners.map(([, y]) => y)),
          maxXPt: Math.max(...corners.map(([x]) => x)),
          maxYPt: Math.max(...corners.map(([, y]) => y)),
        },
        pointCount: 4,
      });
    }
  }

  return shapes;
}
