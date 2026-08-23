const arrayIsArray = Array.isArray;
const arrayJoin = Function.call.bind(Array.prototype.join);
const bufferByteLength = Buffer.byteLength;
const bufferFrom = Buffer.from;
const getDescriptors = Object.getOwnPropertyDescriptors;
const getPrototypeOf = Object.getPrototypeOf;
const jsonStringify = JSON.stringify;
const numberIsFinite = Number.isFinite;
const numberIsSafeInteger = Number.isSafeInteger;
const reflectOwnKeys = Reflect.ownKeys;

const MAX_BYTES = 24 * 1024 * 1024;
const MAX_DEPTH = 64;
const MAX_NODES = 32_768;

function fail(message) {
  throw new TypeError(message);
}

function append(state, value) {
  state.bytes += bufferByteLength(value, "utf8");
  if (state.bytes > MAX_BYTES) fail(`Safe JSON exceeds ${MAX_BYTES} UTF-8 bytes.`);
  state.chunks[state.chunks.length] = value;
}

function enter(value, state, depth) {
  if (depth > MAX_DEPTH) fail(`Safe JSON exceeds depth ${MAX_DEPTH}.`);
  state.nodes += 1;
  if (state.nodes > MAX_NODES) fail(`Safe JSON exceeds ${MAX_NODES} values.`);
  for (let index = 0; index < depth; index += 1) {
    if (state.stack[index] === value) fail("Safe JSON cannot contain a cycle.");
  }
  state.stack[depth] = value;
}

function primitive(value, state, arrayEntry = false) {
  const type = typeof value;
  if (value === null) append(state, "null");
  else if (type === "string") append(state, jsonStringify(value));
  else if (type === "boolean") append(state, value ? "true" : "false");
  else if (type === "number") append(state, numberIsFinite(value) ? jsonStringify(value) : "null");
  else if (type === "undefined" && arrayEntry) append(state, "null");
  else fail(`Safe JSON cannot encode ${type} in this position.`);
}

function arrayValue(value, state, depth) {
  enter(value, state, depth);
  const descriptors = getDescriptors(value);
  const length = descriptors.length?.value;
  if (!numberIsSafeInteger(length) || length < 0) fail("Safe JSON array length is invalid.");
  append(state, "[");
  for (let index = 0; index < length; index += 1) {
    if (index > 0) append(state, ",");
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined) append(state, "null");
    else if (!("value" in descriptor)) fail(`Safe JSON array index ${index} is an accessor.`);
    else serialize(descriptor.value, state, depth + 1, true);
  }
  append(state, "]");
  state.stack[depth] = undefined;
}

function objectValue(value, state, depth) {
  enter(value, state, depth);
  const prototype = getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("Safe JSON objects must have Object.prototype or null prototype.");
  }
  const keys = reflectOwnKeys(value);
  const descriptors = getDescriptors(value);
  append(state, "{");
  let emitted = 0;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const descriptor = descriptors[key];
    if (typeof key !== "string" || descriptor?.enumerable !== true) continue;
    if (!("value" in descriptor)) fail(`Safe JSON property ${jsonStringify(key)} is an accessor.`);
    if (typeof descriptor.value === "undefined") continue;
    if (emitted > 0) append(state, ",");
    append(state, jsonStringify(key));
    append(state, ":");
    serialize(descriptor.value, state, depth + 1, false);
    emitted += 1;
  }
  append(state, "}");
  state.stack[depth] = undefined;
}

function serialize(value, state, depth, arrayEntry) {
  if (typeof value !== "object" || value === null) primitive(value, state, arrayEntry);
  else if (arrayIsArray(value)) arrayValue(value, state, depth);
  else objectValue(value, state, depth);
}

/** JSON.stringify-compatible field order without inherited toJSON or accessor execution. */
export function partIdentificationSafeJsonBytes(value) {
  const state = { bytes: 0, chunks: [], nodes: 0, stack: [] };
  serialize(value, state, 0, false);
  return bufferFrom(arrayJoin(state.chunks, ""), "utf8");
}
