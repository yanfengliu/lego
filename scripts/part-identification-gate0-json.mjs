const arrayIsArray = Array.isArray;
const arrayJoin = Function.call.bind(Array.prototype.join);
const arraySort = Function.call.bind(Array.prototype.sort);
const bufferByteLength = Buffer.byteLength;
const bufferEquals = Function.call.bind(Buffer.prototype.equals);
const bufferFrom = Buffer.from;
const getDescriptors = Object.getOwnPropertyDescriptors;
const getPrototypeOf = Object.getPrototypeOf;
const jsonStringify = JSON.stringify;
const numberIsSafeInteger = Number.isSafeInteger;
const reflectOwnKeys = Reflect.ownKeys;

const MAX_CANONICAL_BYTES = 24 * 1024 * 1024;
const MAX_CANONICAL_DEPTH = 32;
const MAX_CANONICAL_NODES = 4_096;

export class PartIdentificationGate0JsonError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartIdentificationGate0JsonError";
  }
}

function fail(message) {
  throw new PartIdentificationGate0JsonError(message);
}

function append(state, text) {
  state.byteLength += bufferByteLength(text, "utf8");
  if (state.byteLength > MAX_CANONICAL_BYTES) {
    fail(`Gate-0 canonical JSON exceeds ${MAX_CANONICAL_BYTES} UTF-8 bytes.`);
  }
  state.chunks[state.chunks.length] = text;
}

function primitive(value, state) {
  const type = typeof value;
  if (value === null) append(state, "null");
  else if (type === "string") append(state, jsonStringify(value));
  else if (type === "boolean") append(state, value ? "true" : "false");
  else if (type === "number" && numberIsSafeInteger(value)) {
    append(state, jsonStringify(value));
  } else {
    fail(
      "Gate-0 canonical JSON accepts only null, strings, booleans, and safe integers as leaves.",
    );
  }
}

function enter(value, state, depth) {
  if (depth > MAX_CANONICAL_DEPTH) {
    fail(`Gate-0 canonical JSON exceeds depth ${MAX_CANONICAL_DEPTH}.`);
  }
  state.nodes += 1;
  if (state.nodes > MAX_CANONICAL_NODES) {
    fail(`Gate-0 canonical JSON exceeds ${MAX_CANONICAL_NODES} structural values.`);
  }
  for (let index = 0; index < depth; index += 1) {
    if (state.stack[index] === value) fail("Gate-0 canonical JSON cannot contain a cycle.");
  }
  state.stack[depth] = value;
}

function arrayValue(value, state, depth) {
  enter(value, state, depth);
  const lengthDescriptor = getDescriptors(value).length;
  if (
    !lengthDescriptor ||
    !("value" in lengthDescriptor) ||
    !numberIsSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    fail("Gate-0 canonical JSON array length is not an own safe data property.");
  }
  const length = lengthDescriptor.value;
  const keys = reflectOwnKeys(value);
  if (keys.length !== length + 1) {
    fail("Gate-0 canonical JSON arrays must be dense and carry no extra own fields.");
  }
  const descriptors = getDescriptors(value);
  append(state, "[");
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(`Gate-0 canonical JSON array index ${index} is not an enumerable data property.`);
    }
    if (index > 0) append(state, ",");
    serialize(descriptor.value, state, depth + 1);
  }
  append(state, "]");
  state.stack[depth] = undefined;
}

function objectValue(value, state, depth) {
  enter(value, state, depth);
  const prototype = getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("Gate-0 canonical JSON objects must have Object.prototype or null prototype.");
  }
  const keys = reflectOwnKeys(value);
  const descriptors = getDescriptors(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const descriptor = descriptors[key];
    if (
      typeof key !== "string" ||
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      fail("Gate-0 canonical JSON objects require only enumerable string data properties.");
    }
  }
  arraySort(keys, (left, right) => (left < right ? -1 : left > right ? 1 : 0));
  append(state, "{");
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const descriptor = descriptors[key];
    if (index > 0) append(state, ",");
    append(state, jsonStringify(key));
    append(state, ":");
    serialize(descriptor.value, state, depth + 1);
  }
  append(state, "}");
  state.stack[depth] = undefined;
}

function serialize(value, state, depth) {
  if (typeof value !== "object" || value === null) primitive(value, state);
  else if (arrayIsArray(value)) arrayValue(value, state, depth);
  else objectValue(value, state, depth);
}

export function partIdentificationGate0CanonicalJsonBytes(value) {
  const state = { byteLength: 0, chunks: [], nodes: 0, stack: [] };
  serialize(value, state, 0);
  return bufferFrom(arrayJoin(state.chunks, ""), "utf8");
}

export function samePartIdentificationGate0CanonicalValue(left, right) {
  return bufferEquals(
    partIdentificationGate0CanonicalJsonBytes(left),
    partIdentificationGate0CanonicalJsonBytes(right),
  );
}
