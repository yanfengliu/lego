import { isDeepStrictEqual } from "node:util";

import { reconcilePrefix50OfficialLeaves } from "./part-identification-prefix50-official-ldraw-world-proposal-reconcile.mjs";

const XML_MAX_BYTES = 2 * 1024 * 1024;
const LDRAW_MAX_BYTES = 256 * 1024;
const MAX_POSITION_ABS_LDU = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const DESIGN_REVISION = /^[1-9]\d*;[A-Z0-9]+$/u;
const NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const XML_BASIS_SIGNS = Object.freeze([1, -1, -1]);

function boundedBytes(value, label, maximumBytes) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 || value.byteLength > maximumBytes) {
    throw new TypeError(
      `${label} must contain 1..${maximumBytes} bytes; received ${value?.byteLength ?? "non-bytes"}.`,
    );
  }
  return Buffer.from(value);
}

function decode(value, label, maximumBytes) {
  const bytes = boundedBytes(value, label, maximumBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${label} must be valid UTF-8.`);
  }
}

function attributes(source, label, keys, optionalKeys = []) {
  const result = {};
  let cursor = 0;
  while (cursor < source.length) {
    const match = /^\s+([A-Za-z][A-Za-z0-9]*)="([^"]*)"/u.exec(source.slice(cursor));
    if (match === null) {
      if (source.slice(cursor).trim() === "") break;
      throw new TypeError(`${label} contains malformed or non-double-quoted attributes.`);
    }
    const [, name, value] = match;
    if (Object.hasOwn(result, name)) throw new TypeError(`${label} repeats attribute ${name}.`);
    if (/[<>&]/u.test(value)) throw new TypeError(`${label}.${name} contains forbidden markup.`);
    result[name] = value;
    cursor += match[0].length;
  }
  const actualKeys = Object.keys(result).sort();
  const requiredKeys = [...keys].sort();
  const allowedKeys = [...keys, ...optionalKeys].sort();
  if (
    requiredKeys.some((key) => !Object.hasOwn(result, key)) ||
    actualKeys.some((key) => !allowedKeys.includes(key))
  ) {
    throw new TypeError(
      `${label} must carry [${requiredKeys.join(",")}] plus only optional [${optionalKeys.join(",")}]; received [${actualKeys.join(",")}].`,
    );
  }
  return result;
}

function finiteNumbers(source, count, label) {
  const tokens = source.split(",");
  if (tokens.length !== count || tokens.some((token) => !NUMBER_TOKEN.test(token))) {
    throw new TypeError(`${label} must contain exactly ${count} finite decimal numbers.`);
  }
  const values = tokens.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${label} contains a non-finite number.`);
  }
  return values;
}

function completeRecords(source, expression, label) {
  const records = [];
  let end = 0;
  for (const match of source.matchAll(expression)) {
    if (source.slice(end, match.index).trim() !== "") {
      throw new TypeError(`${label} contains unsupported text or elements near byte ${end}.`);
    }
    records.push(match);
    end = match.index + match[0].length;
  }
  if (source.slice(end).trim() !== "") {
    throw new TypeError(
      `${label} contains unsupported trailing text or elements near byte ${end}.`,
    );
  }
  return records;
}

export function parsePrefix50OfficialXml(xmlBytes) {
  const source = decode(xmlBytes, "Official XML", XML_MAX_BYTES);
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA|<!--/iu.test(source)) {
    throw new TypeError("Official XML may not contain doctypes, entities, CDATA, or comments.");
  }
  if (!source.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\r\n')) {
    throw new TypeError("Official XML must retain its exact UTF-8 declaration and CRLF framing.");
  }
  const containers = [...source.matchAll(/<Bricks\b([^>]*)>([\s\S]*?)<\/Bricks>/gu)];
  if (containers.length !== 1 || containers[0][1].trim() !== "") {
    throw new TypeError(
      `Official XML requires one attribute-free Bricks inventory; received ${containers.length}.`,
    );
  }
  const brickMatches = completeRecords(
    containers[0][2],
    /<Brick\b([^>]*)>([\s\S]*?)<\/Brick>/gu,
    "Official XML Bricks inventory",
  );
  const brickRefs = new Set();
  const partRefs = new Set();
  const boneRefs = new Set();
  const bricks = brickMatches.map((match, brickIndex) => {
    const brick = attributes(
      match[1],
      `Official XML Brick ${brickIndex + 1}`,
      ["designID", "itemNos", "uuid"],
      ["decorationBriefId"],
    );
    if (!UUID.test(brick.uuid) || brickRefs.has(brick.uuid)) {
      throw new TypeError(`Official XML Brick ${brickIndex + 1} has an invalid or repeated uuid.`);
    }
    if (!DESIGN_REVISION.test(brick.designID)) {
      throw new TypeError(
        `Official XML Brick ${brickIndex + 1} has invalid designID ${brick.designID}.`,
      );
    }
    const itemNos = brick.itemNos.split(",");
    if (
      itemNos.some((item) => !/^[1-9]\d*$/u.test(item)) ||
      new Set(itemNos).size !== itemNos.length
    ) {
      throw new TypeError(
        `Official XML Brick ${brickIndex + 1} has invalid itemNos ${brick.itemNos}.`,
      );
    }
    brickRefs.add(brick.uuid);
    const partMatches = completeRecords(
      match[2],
      /<Part\b([^>]*)>([\s\S]*?)<\/Part>/gu,
      `Official XML Brick ${brickIndex + 1}`,
    );
    if (partMatches.length < 1 || partMatches.length > 16) {
      throw new TypeError(`Official XML Brick ${brickIndex + 1} must contain 1..16 Part leaves.`);
    }
    const parts = partMatches.map((partMatch, partIndex) => {
      const part = attributes(
        partMatch[1],
        `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1}`,
        ["designID", "materials", "partType", "uuid"],
        ["decoration"],
      );
      if (
        !UUID.test(part.uuid) ||
        partRefs.has(part.uuid) ||
        !DESIGN_REVISION.test(part.designID)
      ) {
        throw new TypeError(
          `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} has invalid or repeated identity.`,
        );
      }
      if (part.partType !== "rigid" || !/^[1-9]\d*:0(?:,[1-9]\d*:0)*$/u.test(part.materials)) {
        throw new TypeError(
          `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} must be rigid with numeric material layers.`,
        );
      }
      const materialIds = part.materials.split(",").map((entry) => entry.split(":", 1)[0]);
      if (new Set(materialIds).size !== 1) {
        throw new TypeError(
          `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} has mixed material colors.`,
        );
      }
      const bones = completeRecords(
        partMatch[2],
        /<Bone\b([^>]*)\/>/gu,
        `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1}`,
      );
      if (bones.length !== 1) {
        throw new TypeError(
          `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} requires exactly one Bone.`,
        );
      }
      const bone = attributes(
        bones[0][1],
        `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} Bone`,
        ["transformation", "uuid"],
      );
      if (!UUID.test(bone.uuid) || boneRefs.has(bone.uuid)) {
        throw new TypeError(
          `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} has an invalid or repeated Bone uuid.`,
        );
      }
      const transform = finiteNumbers(
        bone.transformation,
        12,
        `Official XML Brick ${brickIndex + 1} Part ${partIndex + 1} Bone transformation`,
      );
      if (
        transform.slice(0, 9).some((value) => Math.abs(value) > 1.000001) ||
        transform.slice(9).some((value) => Math.abs(value) > 1_000)
      ) {
        throw new TypeError(`Official XML Brick ${brickIndex + 1} contains an out-of-bounds Bone.`);
      }
      partRefs.add(part.uuid);
      boneRefs.add(bone.uuid);
      return Object.freeze({
        partRef: part.uuid,
        designRevision: part.designID,
        materialId: materialIds[0],
        matrix: Object.freeze(transform.slice(0, 9)),
        position: Object.freeze(transform.slice(9)),
      });
    });
    if (parts.length === 1 && parts[0].designRevision !== brick.designID) {
      throw new TypeError(
        `Official XML single-part Brick ${brickIndex + 1} disagrees with its Part.`,
      );
    }
    return Object.freeze({
      xmlRow: brickIndex + 1,
      brickRef: brick.uuid,
      designRevision: brick.designID,
      itemNos: Object.freeze(itemNos),
      parts: Object.freeze(parts),
    });
  });
  return Object.freeze(bricks);
}

function determinant(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

function transpose(matrix) {
  return [
    matrix[0],
    matrix[3],
    matrix[6],
    matrix[1],
    matrix[4],
    matrix[7],
    matrix[2],
    matrix[5],
    matrix[8],
  ];
}

export function multiplyMatrices(left, right) {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset] * right[offset * 3 + column],
      0,
    );
  });
}

export function transformPoint(matrix, point) {
  return [0, 1, 2].map((row) =>
    [0, 1, 2].reduce((sum, column) => sum + matrix[row * 3 + column] * point[column], 0),
  );
}

function properRigidMatrix(matrix, label) {
  const gram = multiplyMatrices(transpose(matrix), matrix);
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const orthogonalResidual = Math.max(
    ...gram.map((value, index) => Math.abs(value - identity[index])),
  );
  const determinantResidual = Math.abs(determinant(matrix) - 1);
  if (orthogonalResidual > 1e-9 || determinantResidual > 1e-9) {
    throw new TypeError(
      `${label} must be a determinant-positive rigid matrix; orthogonal residual ${orthogonalResidual}, determinant residual ${determinantResidual}.`,
    );
  }
}

export function parsePrefix50OfficialLdraw(ldrawBytes) {
  const source = decode(ldrawBytes, "Official LDraw MPD", LDRAW_MAX_BYTES);
  if (!source.endsWith("\r\n") || source.replaceAll("\r\n", "").includes("\n")) {
    throw new TypeError("Official LDraw MPD must retain CRLF lines and a final CRLF.");
  }
  const files = new Map();
  let current = null;
  for (const [lineIndex, line] of source.split("\r\n").entries()) {
    if (line === "") continue;
    if (line.startsWith("0 FILE ")) {
      const name = line.slice(7);
      if (!/^[A-Za-z0-9_]+$/u.test(name) || files.has(name)) {
        throw new TypeError(
          `Official LDraw line ${lineIndex + 1} has an invalid or repeated FILE name.`,
        );
      }
      current = [];
      files.set(name, current);
      continue;
    }
    if (current === null || !line.startsWith("1 ")) {
      throw new TypeError(
        `Official LDraw line ${lineIndex + 1} is outside the strict type-1 MPD grammar.`,
      );
    }
    const tokens = line.split(/\s+/u);
    if (tokens.length !== 15 || tokens[0] !== "1") {
      throw new TypeError(
        `Official LDraw line ${lineIndex + 1} must contain one canonical type-1 row.`,
      );
    }
    const colorCode = Number(tokens[1]);
    if (!/^\d+$/u.test(tokens[1]) || !Number.isSafeInteger(colorCode) || colorCode > 511) {
      throw new TypeError(`Official LDraw line ${lineIndex + 1} has an invalid color code.`);
    }
    if (tokens.slice(2, 14).some((token) => !NUMBER_TOKEN.test(token))) {
      throw new TypeError(`Official LDraw line ${lineIndex + 1} contains a non-decimal transform.`);
    }
    const values = tokens.slice(2, 14).map(Number);
    const position = values.slice(0, 3);
    const matrix = values.slice(3);
    if (
      values.some((value) => !Number.isFinite(value)) ||
      position.some((value) => Math.abs(value) > MAX_POSITION_ABS_LDU) ||
      matrix.some((value) => Math.abs(value) > 1.000001)
    ) {
      throw new TypeError(
        `Official LDraw line ${lineIndex + 1} contains an out-of-bounds transform.`,
      );
    }
    properRigidMatrix(matrix, `Official LDraw line ${lineIndex + 1}`);
    const filename = tokens[14];
    if (!/^[A-Za-z0-9_]+(?:\.dat)?$/u.test(filename)) {
      throw new TypeError(`Official LDraw line ${lineIndex + 1} has an unsafe reference filename.`);
    }
    current.push(
      Object.freeze({
        sourceLine: lineIndex + 1,
        row: current.length + 1,
        colorCode,
        position: Object.freeze(position),
        matrix: Object.freeze(matrix),
        filename,
      }),
    );
  }
  const names = [...files.keys()];
  if (!isDeepStrictEqual(names, ["vx1087034_21066_a", "vx1087034_21066_a_assembly_0"])) {
    throw new TypeError(
      `Official LDraw MPD has unexpected FILE sections ${JSON.stringify(names)}.`,
    );
  }
  return Object.freeze({
    top: Object.freeze(files.get(names[0])),
    composite: Object.freeze(files.get(names[1])),
  });
}

function officialXmlWorld(part) {
  const matrix = part.matrix.map((_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return part.matrix[column * 3 + row] * XML_BASIS_SIGNS[row] * XML_BASIS_SIGNS[column];
  });
  const position = part.position.map((value, axis) => value * 25 * XML_BASIS_SIGNS[axis]);
  return { matrix, position };
}

function composeRows(parent, child) {
  const rotated = transformPoint(parent.matrix, child.position);
  return Object.freeze({
    sourceLine: child.sourceLine,
    row: child.row,
    colorCode: child.colorCode === 16 ? parent.colorCode : child.colorCode,
    position: Object.freeze(rotated.map((value, axis) => value + parent.position[axis])),
    matrix: Object.freeze(multiplyMatrices(parent.matrix, child.matrix)),
    filename: child.filename,
  });
}

export function reconcilePrefix50OfficialXmlLdraw(xmlBricks, ldraw) {
  if (xmlBricks.length !== 1_465 || ldraw.top.length !== 1_465 || ldraw.composite.length !== 5) {
    throw new TypeError(
      `Official XML/LDraw accounting must be 1465/1465/5; received ${xmlBricks.length}/${ldraw.top.length}/${ldraw.composite.length}.`,
    );
  }
  const leaves = [];
  for (const brick of xmlBricks) {
    const topLevelLdrawRow =
      brick.xmlRow === 1_440 ? 1_465 : brick.xmlRow >= 1_441 ? brick.xmlRow - 1 : brick.xmlRow;
    const top = ldraw.top[topLevelLdrawRow - 1];
    const rows =
      brick.xmlRow === 1_440 ? ldraw.composite.map((row) => composeRows(top, row)) : [top];
    if (
      brick.xmlRow === 1_440
        ? brick.parts.length !== 5 ||
          top.filename !== "vx1087034_21066_a_assembly_0" ||
          top.colorCode !== 16
        : brick.parts.length !== 1 || !top.filename.endsWith(".dat")
    ) {
      throw new TypeError(
        `Official XML/LDraw composite permutation drifted at XML row ${brick.xmlRow}.`,
      );
    }
    for (const [partIndex, part] of brick.parts.entries()) {
      const ldrawLeaf = rows[partIndex];
      const xmlWorld = officialXmlWorld(part);
      const inverseXmlWorld = transpose(xmlWorld.matrix);
      const localMatrix = multiplyMatrices(inverseXmlWorld, ldrawLeaf.matrix);
      const localTranslationLdu = transformPoint(
        inverseXmlWorld,
        ldrawLeaf.position.map((value, axis) => value - xmlWorld.position[axis]),
      );
      leaves.push(
        Object.freeze({
          brickRef: brick.brickRef,
          xmlRow: brick.xmlRow,
          xmlPartRow: partIndex + 1,
          topLevelLdrawRow,
          compositeLdrawRow: brick.xmlRow === 1_440 ? partIndex + 1 : null,
          designRevision: part.designRevision,
          xmlDesignId: part.designRevision.split(";", 1)[0],
          xmlMaterialId: part.materialId,
          ldrawFilename: ldrawLeaf.filename,
          ldrawColorCode: ldrawLeaf.colorCode,
          ldrawWorldMatrix: ldrawLeaf.matrix,
          ldrawWorldPositionLdu: ldrawLeaf.position,
          localMatrix: Object.freeze(localMatrix),
          localTranslationLdu: Object.freeze(localTranslationLdu),
        }),
      );
    }
  }
  if (leaves.length !== 1_469)
    throw new TypeError(`Official XML/LDraw flattening yielded ${leaves.length} leaves.`);
  return reconcilePrefix50OfficialLeaves(leaves);
}
