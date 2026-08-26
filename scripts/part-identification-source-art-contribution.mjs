import { createHash } from "node:crypto";

export const PDF_SOURCE_ART_CONTRIBUTION_SCHEMA = "lego.pdf-source-art-contribution/1";

const MAX_LOOKAHEAD_OPERATORS = 32;
const MAX_RECORDED_GROUPS = 100_000;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Source-art contribution contains a non-finite number.");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Source-art contribution cannot canonicalize ${typeof value}.`);
}

export { canonicalJson as canonicalSourceArtJson };

function milli(value, origin = 0) {
  if (!Number.isFinite(value) || !Number.isFinite(origin)) {
    throw new Error("Source-art contribution coordinates must be finite.");
  }
  const delta = value - origin;
  // PDF operands in this booklet carry independent float32/decimal spellings.
  // Values less than one millipoint from the translation origin denote that
  // origin; retaining their binary phase would turn a sub-pixel source phase
  // into a false program distinction.
  if (origin !== 0 && Math.abs(delta) < 0.001) return 0;
  const rounded = Math.round(delta * 1_000);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function numberArray(value, label) {
  if (value === null || value === undefined || typeof value !== "object") {
    throw new Error(`${label} must be an array-like numeric PDF operand.`);
  }
  const array = Array.from(value);
  if (array.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`${label} contains a non-finite PDF operand.`);
  }
  return array;
}

function normalizedPackedPath(value, origin, label) {
  if (value === null || value === undefined || typeof value !== "object") {
    throw new Error(`${label} must be an array-like packed PDF path.`);
  }
  const packedSegments = Array.from(value);
  if (packedSegments.length < 1 || packedSegments.length > 64) {
    throw new Error(`${label} must contain 1..64 packed path segments.`);
  }
  const arity = new Map([
    [0, 2],
    [1, 2],
    [2, 6],
    [3, 0],
    [4, 4],
  ]);
  return packedSegments.map((packed, segmentIndex) => {
    const values = numberArray(packed, `${label} segment ${segmentIndex}`);
    const operations = [];
    for (let offset = 0; offset < values.length;) {
      const operation = values[offset++];
      const coordinateCount = arity.get(operation);
      if (!Number.isSafeInteger(operation) || coordinateCount === undefined) {
        throw new Error(
          `${label} segment ${segmentIndex} uses unsupported path opcode ${operation}.`,
        );
      }
      if (offset + coordinateCount > values.length) {
        throw new Error(`${label} segment ${segmentIndex} ends inside path opcode ${operation}.`);
      }
      const coordinatesMilliPt = values
        .slice(offset, offset + coordinateCount)
        .map((coordinate, index) => milli(coordinate, origin[index % 2]));
      offset += coordinateCount;
      operations.push({ coordinatesMilliPt, operation });
    }
    return operations;
  });
}

function normalizedPath(args, origin, label) {
  if (!Array.isArray(args) || args.length !== 3) {
    throw new Error(`${label} must have the exact PDF constructPath operand shape.`);
  }
  const bounds = numberArray(args[2], `${label} bounds`);
  if (bounds.length !== 4) throw new Error(`${label} must have four path bounds.`);
  return {
    boundsMilliPt: bounds.map((value, index) =>
      milli(value, index % 2 === 0 ? origin[0] : origin[1]),
    ),
    segments: normalizedPackedPath(args[1], origin, `${label} coordinates`),
  };
}

function shownText(args) {
  const glyphs = args?.[0];
  if (!Array.isArray(glyphs) || glyphs.length > 64) return null;
  let text = "";
  const normalized = [];
  for (const glyph of glyphs) {
    if (typeof glyph === "number" && Number.isFinite(glyph)) {
      normalized.push({ spacing: glyph });
    } else if (
      typeof glyph === "object" &&
      glyph !== null &&
      typeof glyph.unicode === "string" &&
      Number.isFinite(glyph.width)
    ) {
      text += glyph.unicode;
      normalized.push({ unicode: glyph.unicode, width: glyph.width });
    } else {
      return null;
    }
  }
  return { normalized, text };
}

function recordedGroupMap(recordedGroups) {
  if (!Array.isArray(recordedGroups) || recordedGroups.length > MAX_RECORDED_GROUPS) {
    throw new Error(
      `Source-art contribution requires at most ${MAX_RECORDED_GROUPS} PDF.js recorded groups.`,
    );
  }
  const map = new Map();
  for (const [position, group] of recordedGroups.entries()) {
    if (
      !Number.isSafeInteger(group?.idx) ||
      group.idx < 0 ||
      !Array.isArray(group.dependencies) ||
      group.dependencies.length > MAX_RECORDED_GROUPS ||
      group.dependencies.some((index) => !Number.isSafeInteger(index) || index < 0) ||
      map.has(group.idx)
    ) {
      throw new Error(
        `Source-art contribution recorded group ${position} is malformed or duplicate.`,
      );
    }
    map.set(group.idx, group);
  }
  return map;
}

function closureFor(groupMap, terminalIndex, label) {
  const group = groupMap.get(terminalIndex);
  if (group === undefined) {
    throw new Error(`${label} has no PDF.js recorded dependency group.`);
  }
  return new Set([...group.dependencies, terminalIndex]);
}

function lastClosureOperation(pdfjs, operatorList, closure, terminalIndex, kind, label) {
  for (let index = terminalIndex; index >= 0; index -= 1) {
    if (closure.has(index) && operatorList.fnArray[index] === pdfjs.OPS[kind]) {
      return { args: operatorList.argsArray[index], index };
    }
  }
  throw new Error(`${label} dependency closure does not retain inherited PDF ${kind} state.`);
}

function exactColor(operation, label) {
  if (!Array.isArray(operation.args) || operation.args.length !== 1) {
    throw new Error(`${label} must contain one exact PDF color operand.`);
  }
  const color = operation.args[0];
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/u.test(color)) {
    throw new Error(`${label} must contain one lowercase RGB color.`);
  }
  return color;
}

function exactScalar(operation, label) {
  if (
    !Array.isArray(operation.args) ||
    operation.args.length !== 1 ||
    !Number.isFinite(operation.args[0])
  ) {
    throw new Error(`${label} must contain one finite PDF scalar.`);
  }
  return milli(operation.args[0]);
}

function findTerminals(pdfjs, operatorList, imageOperatorIndex, label, origin) {
  const outlines = [];
  let text = null;
  const limit = Math.min(
    operatorList.fnArray.length,
    imageOperatorIndex + MAX_LOOKAHEAD_OPERATORS + 1,
  );
  for (let index = imageOperatorIndex + 1; index < limit; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === pdfjs.OPS.paintImageXObject) break;
    if (fn === pdfjs.OPS.constructPath && args?.[0] === pdfjs.OPS.stroke) {
      const path = normalizedPath(args, origin, `Source-art ${label} outline`);
      if (
        path.boundsMilliPt[0] >= -2_000 &&
        path.boundsMilliPt[1] >= -2_000 &&
        path.boundsMilliPt[2] <= 10_000 &&
        path.boundsMilliPt[3] <= 8_000
      ) {
        outlines.push({ index, path });
      }
    } else if (fn === pdfjs.OPS.showText) {
      const shown = shownText(args);
      if (shown?.text === label) text = { index, shown };
    }
  }
  if (outlines.length !== 2 || text === null || text.index <= outlines[1].index) {
    throw new Error(
      `Source-art ${JSON.stringify(label)} must resolve exactly two vector outlines followed by one matching PDF text paint within ${MAX_LOOKAHEAD_OPERATORS} operators of its image.`,
    );
  }
  return { outlines, text };
}

/**
 * Derives a translation-normalized whole-contribution program from PDF.js's
 * independently recorded paint dependency closures. Object ids and operator
 * positions are used only while decoding; neither enters the durable digest.
 */
export function measurePdfSourceArtContribution({
  pdfjs,
  operatorList,
  recordedGroups,
  imageOperatorIndex,
  label,
  labelTransformPt,
}) {
  if (
    !Array.isArray(operatorList?.fnArray) ||
    !Array.isArray(operatorList.argsArray) ||
    operatorList.fnArray.length !== operatorList.argsArray.length ||
    operatorList.fnArray.length > 100_000 ||
    !Number.isSafeInteger(imageOperatorIndex) ||
    imageOperatorIndex < 0 ||
    operatorList.fnArray[imageOperatorIndex] !== pdfjs?.OPS?.paintImageXObject ||
    typeof label !== "string" ||
    label.length < 1 ||
    label.length > 16 ||
    !Array.isArray(labelTransformPt) ||
    labelTransformPt.length !== 2 ||
    labelTransformPt.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      "Source-art contribution requires one bounded image paint, label, and label transform.",
    );
  }

  const groupMap = recordedGroupMap(recordedGroups);
  const terminals = findTerminals(pdfjs, operatorList, imageOperatorIndex, label, labelTransformPt);
  const imageClosure = closureFor(groupMap, imageOperatorIndex, "Source-art image paint");
  const imageTransform = lastClosureOperation(
    pdfjs,
    operatorList,
    imageClosure,
    imageOperatorIndex,
    "transform",
    "Source-art image paint",
  );
  const transform = numberArray(imageTransform.args, "Source-art image transform");
  if (transform.length !== 6) throw new Error("Source-art image transform must have six operands.");
  const clip = lastClosureOperation(
    pdfjs,
    operatorList,
    imageClosure,
    imageOperatorIndex,
    "constructPath",
    "Source-art image paint",
  );
  if (clip.args?.[0] !== pdfjs.OPS.endPath) {
    throw new Error("Source-art image dependency closure must retain its exact clipping path.");
  }

  const normalizedOutlines = terminals.outlines.map(({ index, path }, position) => {
    const closure = closureFor(groupMap, index, `Source-art outline ${position + 1}`);
    return {
      fillRule: "stroke",
      lineWidthMilliPt: exactScalar(
        lastClosureOperation(
          pdfjs,
          operatorList,
          closure,
          index,
          "setLineWidth",
          "Source-art outline",
        ),
        "Source-art outline line width",
      ),
      miterLimitMilli: exactScalar(
        lastClosureOperation(
          pdfjs,
          operatorList,
          closure,
          index,
          "setMiterLimit",
          "Source-art outline",
        ),
        "Source-art outline miter limit",
      ),
      path,
      strokeRgb: exactColor(
        lastClosureOperation(
          pdfjs,
          operatorList,
          closure,
          index,
          "setStrokeRGBColor",
          "Source-art outline",
        ),
        "Source-art outline stroke color",
      ),
    };
  });

  const textClosure = closureFor(groupMap, terminals.text.index, "Source-art text paint");
  const matrixOperation = lastClosureOperation(
    pdfjs,
    operatorList,
    textClosure,
    terminals.text.index,
    "setTextMatrix",
    "Source-art text paint",
  );
  const matrix = numberArray(matrixOperation.args?.[0], "Source-art text matrix");
  if (matrix.length !== 6) throw new Error("Source-art text matrix must have six operands.");
  const font = lastClosureOperation(
    pdfjs,
    operatorList,
    textClosure,
    terminals.text.index,
    "setFont",
    "Source-art text paint",
  );
  if (!Array.isArray(font.args) || font.args.length !== 2 || !Number.isFinite(font.args[1])) {
    throw new Error("Source-art text dependency closure must retain one bounded font size.");
  }

  const normalizedProgram = {
    image: {
      clip: normalizedPath(clip.args, labelTransformPt, "Source-art image clip"),
      linearTransformMilli: transform.slice(0, 4).map((value) => milli(value)),
      translationFromLabelMilliPt: [
        milli(transform[4], labelTransformPt[0]),
        milli(transform[5], labelTransformPt[1]),
      ],
    },
    label: {
      fillRgb: exactColor(
        lastClosureOperation(
          pdfjs,
          operatorList,
          textClosure,
          terminals.text.index,
          "setFillRGBColor",
          "Source-art text paint",
        ),
        "Source-art label fill color",
      ),
      fontSizeMilliPt: milli(font.args[1]),
      glyphs: terminals.text.shown.normalized,
      outlines: normalizedOutlines,
      text: label,
      textMatrix: {
        linearMilli: matrix.slice(0, 4).map((value) => milli(value)),
        translationFromLabelMilliPt: [
          milli(matrix[4], labelTransformPt[0]),
          milli(matrix[5], labelTransformPt[1]),
        ],
      },
    },
    schemaVersion: PDF_SOURCE_ART_CONTRIBUTION_SCHEMA,
  };
  const canonicalBytes = Buffer.from(
    `lego.pdf-source-art-contribution/1\0${canonicalJson(normalizedProgram)}`,
  );
  const operationIndexes = new Set();
  for (const index of [
    imageOperatorIndex,
    ...terminals.outlines.map(({ index }) => index),
    terminals.text.index,
  ]) {
    const closure = closureFor(groupMap, index, "Source-art terminal paint");
    for (const dependency of closure) operationIndexes.add(dependency);
  }
  return {
    normalizedProgram,
    normalizedProgramSha256: sha256(canonicalBytes),
    operationIndexes,
    terminalPaintCount: 4,
  };
}

export const __testOnly = Object.freeze({ canonicalJson, normalizedPath, shownText });
