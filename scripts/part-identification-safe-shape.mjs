const arrayIsArrayIntrinsic = Array.isArray;
const objectGetPrototypeOfIntrinsic = Object.getPrototypeOf;
const objectKeysIntrinsic = Object.keys;
const hasOwnIntrinsic = Function.call.bind(Object.prototype.hasOwnProperty);
const mapDeleteIntrinsic = Function.call.bind(Map.prototype.delete);
const mapGetIntrinsic = Function.call.bind(Map.prototype.get);
const mapHasIntrinsic = Function.call.bind(Map.prototype.has);
const mapSetIntrinsic = Function.call.bind(Map.prototype.set);
const setAddIntrinsic = Function.call.bind(Set.prototype.add);
const setDeleteIntrinsic = Function.call.bind(Set.prototype.delete);
const setHasIntrinsic = Function.call.bind(Set.prototype.has);
const setSizeGetter = Object.getOwnPropertyDescriptor(Set.prototype, "size").get;
const setSizeIntrinsic = Function.call.bind(setSizeGetter);

export const isArray = (value) => arrayIsArrayIntrinsic(value);
export const own = (value, key) => hasOwnIntrinsic(value, key);
export const mapDelete = (value, key) => mapDeleteIntrinsic(value, key);
export const mapGet = (value, key) => mapGetIntrinsic(value, key);
export const mapHas = (value, key) => mapHasIntrinsic(value, key);
export const mapSet = (value, key, entry) => mapSetIntrinsic(value, key, entry);
export const setAdd = (value, entry) => setAddIntrinsic(value, entry);
export const setDelete = (value, entry) => setDeleteIntrinsic(value, entry);
export const setHas = (value, entry) => setHasIntrinsic(value, entry);
export const setSize = (value) => setSizeIntrinsic(value);

export function isOrdinaryObject(value) {
  if (typeof value !== "object" || value === null || arrayIsArrayIntrinsic(value)) return false;
  const prototype = objectGetPrototypeOfIntrinsic(value);
  return prototype === Object.prototype || prototype === null;
}

export function ownKeys(value) {
  return isOrdinaryObject(value) ? objectKeysIntrinsic(value) : [];
}

export function exactOwnKeys(value, expected) {
  if (!isOrdinaryObject(value) || !arrayIsArrayIntrinsic(expected)) return false;
  const actual = objectKeysIntrinsic(value);
  if (actual.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (typeof expected[index] !== "string" || !hasOwnIntrinsic(value, expected[index]))
      return false;
  }
  return true;
}

export function sameOrderedStrings(left, right) {
  if (
    !arrayIsArrayIntrinsic(left) ||
    !arrayIsArrayIntrinsic(right) ||
    left.length !== right.length
  ) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (typeof left[index] !== "string" || left[index] !== right[index]) return false;
  }
  return true;
}

export function containsString(values, expected) {
  if (!arrayIsArrayIntrinsic(values)) return false;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === expected) return true;
  }
  return false;
}

export function copyArray(values) {
  if (!arrayIsArrayIntrinsic(values)) return null;
  const copy = new Array(values.length);
  for (let index = 0; index < values.length; index += 1) copy[index] = values[index];
  return copy;
}

export function sortedUniqueStrings(values) {
  const copy = copyArray(values);
  if (copy === null) return null;
  for (let index = 0; index < copy.length; index += 1) {
    if (typeof copy[index] !== "string") return null;
    let cursor = index;
    while (cursor > 0 && copy[cursor - 1] > copy[cursor]) {
      const held = copy[cursor - 1];
      copy[cursor - 1] = copy[cursor];
      copy[cursor] = held;
      cursor -= 1;
    }
  }
  for (let index = 1; index < copy.length; index += 1) {
    if (copy[index - 1] === copy[index]) return null;
  }
  return copy;
}
