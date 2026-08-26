import { createHash } from "node:crypto";

import { canonicalSourceArtJson as canonicalJson } from "./part-identification-source-art-contribution.mjs";

export const PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA = "lego.pdf-source-art-image-contribution/2";

const MAX_RECORDED_GROUPS = 100_000;
const MAX_IMAGE_CLOSURE_OPERATIONS = 32;
const MAX_IMAGE_DIMENSION = 16_384;
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function digestPdfSourceArtImageContribution(normalizedProgram) {
  return sha256(
    Buffer.from(`${PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA}\0${canonicalJson(normalizedProgram)}`),
  );
}

function milli(value, origin = 0) {
  if (!Number.isFinite(value) || !Number.isFinite(origin)) {
    throw new Error("Source-art image contribution coordinates must be finite.");
  }
  const delta = value - origin;
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
        throw new Error(`${label} segment ${segmentIndex} uses unsupported opcode ${operation}.`);
      }
      if (offset + coordinateCount > values.length) {
        throw new Error(`${label} segment ${segmentIndex} ends inside opcode ${operation}.`);
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

function recordedGroupMap(recordedGroups) {
  if (!Array.isArray(recordedGroups) || recordedGroups.length > MAX_RECORDED_GROUPS) {
    throw new Error(
      `Source-art image contribution requires at most ${MAX_RECORDED_GROUPS} recorded groups.`,
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
      throw new Error(`Source-art recorded group ${position} is malformed or duplicate.`);
    }
    map.set(group.idx, group);
  }
  return map;
}

function exactNullArgs(args, name, index) {
  if (args !== null) {
    throw new Error(`Source-art closure ${name} at ${index} must have null operands.`);
  }
}

function exactImagePaintArgs(args, label) {
  if (
    !Array.isArray(args) ||
    args.length !== 3 ||
    typeof args[0] !== "string" ||
    args[0].length < 1 ||
    !Number.isSafeInteger(args[1]) ||
    args[1] < 1 ||
    args[1] > MAX_IMAGE_DIMENSION ||
    !Number.isSafeInteger(args[2]) ||
    args[2] < 1 ||
    args[2] > MAX_IMAGE_DIMENSION
  ) {
    throw new Error(`${label} must contain one bounded image resource and width/height.`);
  }
  return { height: args[2], resource: args[0], width: args[1] };
}

function orderedClosure(pdfjs, operatorList, recordedGroups, imageOperatorIndex) {
  const group = recordedGroupMap(recordedGroups).get(imageOperatorIndex);
  if (group === undefined)
    throw new Error("Source-art image paint has no recorded dependency group.");
  const uniqueDependencies = new Set(group.dependencies);
  if (
    uniqueDependencies.size !== group.dependencies.length ||
    uniqueDependencies.has(imageOperatorIndex)
  ) {
    throw new Error("Source-art image dependency closure contains duplicate operations.");
  }
  const indexes = [...uniqueDependencies, imageOperatorIndex].sort((left, right) => left - right);
  if (indexes.length > MAX_IMAGE_CLOSURE_OPERATIONS) {
    throw new Error(
      `Source-art image dependency closure has ${indexes.length} operations; maximum is ${MAX_IMAGE_CLOSURE_OPERATIONS}.`,
    );
  }
  for (const index of indexes) {
    if (index < 0 || index >= operatorList.fnArray.length) {
      throw new Error(
        `Source-art image dependency closure contains out-of-range operation ${index} for terminal ${imageOperatorIndex} in ${operatorList.fnArray.length} operations.`,
      );
    }
  }
  return indexes;
}

function normalizeImageOnlyClosure(pdfjs, operatorList, recordedGroups, imageOperatorIndex) {
  const indexes = orderedClosure(pdfjs, operatorList, recordedGroups, imageOperatorIndex);
  const operationNames = new Map(Object.entries(pdfjs.OPS).map(([name, value]) => [value, name]));
  const named = indexes.map((index) => ({
    args: operatorList.argsArray[index],
    index,
    name: operationNames.get(operatorList.fnArray[index]) ?? "unknown",
  }));
  const transforms = named.filter(({ name }) => name === "transform");
  const paths = named.filter(({ name }) => name === "constructPath");
  const clips = named.filter(({ name }) => name === "clip");
  const dependencies = named.filter(({ name }) => name === "dependency");
  if (
    transforms.length !== 1 ||
    paths.length !== 1 ||
    clips.length !== 1 ||
    dependencies.length !== 1
  ) {
    throw new Error(
      `Source-art image dependency closure requires exactly one transform/clip/path/resource dependency; received ${transforms.length}/${clips.length}/${paths.length}/${dependencies.length}.`,
    );
  }
  const transform = numberArray(transforms[0].args, "Source-art image transform");
  if (transform.length !== 6) throw new Error("Source-art image transform must have six operands.");
  if (paths[0].args?.[0] !== pdfjs.OPS.endPath) {
    throw new Error("Source-art image dependency closure must retain one clipping-only path.");
  }
  const terminal = named.find(({ index }) => index === imageOperatorIndex);
  if (terminal?.name !== "paintImageXObject") {
    throw new Error("Source-art image dependency closure terminal is not its exact image paint.");
  }
  const paint = exactImagePaintArgs(terminal.args, "Source-art terminal image paint");
  const dependencyArgs = dependencies[0].args;
  if (
    !Array.isArray(dependencyArgs) ||
    dependencyArgs.length !== 1 ||
    dependencyArgs[0] !== paint.resource
  ) {
    throw new Error("Source-art image resource dependency does not bind its terminal image paint.");
  }
  const origin = [transform[4], transform[5]];
  let saveDepth = 0;
  const operations = named.map(({ args, index, name }) => {
    if (name === "save") {
      exactNullArgs(args, name, index);
      saveDepth += 1;
      return { operation: name };
    }
    if (name === "restore") {
      exactNullArgs(args, name, index);
      saveDepth -= 1;
      if (saveDepth < 0) throw new Error("Source-art image closure restores unsaved state.");
      return { operation: name };
    }
    if (name === "clip") {
      exactNullArgs(args, name, index);
      return { operation: name };
    }
    if (name === "constructPath") {
      return { operation: name, path: normalizedPath(args, origin, "Source-art image clip") };
    }
    if (name === "transform") {
      return {
        matrixMilli: transform.map((value, position) =>
          milli(value, position === 4 ? origin[0] : position === 5 ? origin[1] : 0),
        ),
        operation: name,
      };
    }
    if (name === "dependency") {
      return { operation: name, terminalImageResource: true };
    }
    if (name === "paintImageXObject" && index === imageOperatorIndex) {
      return { height: paint.height, operation: name, width: paint.width };
    }
    throw new Error(
      `Source-art image dependency closure contains unsupported operation ${name} at ${index}.`,
    );
  });
  if (saveDepth !== 0)
    throw new Error("Source-art image closure leaves graphics state unbalanced.");
  return { indexes, operations };
}

export function measurePdfSourceArtImageContribution({
  pdfjs,
  operatorList,
  recordedGroups,
  imageOperatorIndex,
}) {
  if (
    !Array.isArray(operatorList?.fnArray) ||
    !Array.isArray(operatorList.argsArray) ||
    operatorList.fnArray.length !== operatorList.argsArray.length ||
    operatorList.fnArray.length > MAX_RECORDED_GROUPS ||
    !Number.isSafeInteger(imageOperatorIndex) ||
    imageOperatorIndex < 0 ||
    operatorList.fnArray[imageOperatorIndex] !== pdfjs?.OPS?.paintImageXObject
  ) {
    throw new Error("Source-art image contribution requires one bounded PDF image paint.");
  }
  const closure = normalizeImageOnlyClosure(
    pdfjs,
    operatorList,
    recordedGroups,
    imageOperatorIndex,
  );
  const normalizedProgram = {
    operations: closure.operations,
    schemaVersion: PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA,
  };
  return {
    normalizedProgram,
    normalizedProgramSha256: digestPdfSourceArtImageContribution(normalizedProgram),
    operationIndexes: new Set(closure.indexes),
    operationClosureCount: closure.indexes.length,
  };
}

export const __testOnly = Object.freeze({
  milli,
  normalizeImageOnlyClosure,
  normalizedPath,
  recordedGroupMap,
});
