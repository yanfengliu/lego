interface DescriptorSnapshot {
  readonly key: PropertyKey;
  readonly descriptor: PropertyDescriptor;
}

interface SurfaceSnapshot {
  readonly label: string;
  readonly owner: object;
  readonly prototype: object | null;
  readonly descriptors: readonly DescriptorSnapshot[];
}

interface GlobalSnapshot {
  readonly key: string;
  readonly descriptor: PropertyDescriptor | undefined;
}

const SAFE_GLOBAL = globalThis;
const SAFE_TYPE_ERROR = TypeError;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_HAS_OWN_PROPERTY = Object.prototype.hasOwnProperty;
const SAFE_OBJECT_IS = Object.is;
const SAFE_OWN_KEYS = Reflect.ownKeys;
const SAFE_REFLECT_APPLY = Reflect.apply;

const GLOBAL_KEYS = [
  "Array",
  "ArrayBuffer",
  "Float64Array",
  "Function",
  "Int32Array",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "RangeError",
  "Set",
  "SharedArrayBuffer",
  "String",
  "Symbol",
  "TextDecoder",
  "TextEncoder",
  "TypeError",
  "Uint8Array",
  "Uint8ClampedArray",
  "WeakMap",
  "WeakSet",
] as const;

function descriptor(owner: object, key: PropertyKey): PropertyDescriptor | undefined {
  return SAFE_REFLECT_APPLY(SAFE_GET_OWN_PROPERTY_DESCRIPTOR, Object, [owner, key]) as
    PropertyDescriptor | undefined;
}

function prototypeOf(owner: object): object | null {
  return SAFE_REFLECT_APPLY(SAFE_GET_PROTOTYPE_OF, Object, [owner]) as object | null;
}

function ownKeys(owner: object): readonly PropertyKey[] {
  return SAFE_REFLECT_APPLY(SAFE_OWN_KEYS, Reflect, [owner]) as readonly PropertyKey[];
}

function hasOwn(owner: object, key: PropertyKey): boolean {
  return SAFE_REFLECT_APPLY(SAFE_HAS_OWN_PROPERTY, owner, [key]) as boolean;
}

function sameDescriptor(
  left: PropertyDescriptor | undefined,
  right: PropertyDescriptor | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  const leftData = hasOwn(left, "value");
  const rightData = hasOwn(right, "value");
  if (
    leftData !== rightData ||
    left.configurable !== right.configurable ||
    left.enumerable !== right.enumerable
  ) {
    return false;
  }
  return leftData
    ? SAFE_OBJECT_IS(left.value, right.value) && left.writable === right.writable
    : left.get === right.get && left.set === right.set;
}

function captureSurface(owner: object, surfaces: SurfaceSnapshot[], label: string): void {
  for (let index = 0; index < surfaces.length; index += 1) {
    if (surfaces[index]!.owner === owner) return;
  }
  const keys = ownKeys(owner);
  const descriptors: DescriptorSnapshot[] = new Array(keys.length);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const observed = descriptor(owner, key);
    if (observed === undefined) {
      throw new SAFE_TYPE_ERROR("Source derivation could not capture one primordial descriptor.");
    }
    descriptors[index] = { key, descriptor: observed };
  }
  surfaces[surfaces.length] = { label, owner, prototype: prototypeOf(owner), descriptors };
  const parent = prototypeOf(owner);
  if (parent !== null) captureSurface(parent, surfaces, `${label}[[Prototype]]`);
  const prototypeDescriptor = descriptor(owner, "prototype");
  const ownedPrototype = prototypeDescriptor?.value;
  if (
    ownedPrototype !== null &&
    (typeof ownedPrototype === "object" || typeof ownedPrototype === "function")
  ) {
    captureSurface(ownedPrototype as object, surfaces, `${label}.prototype`);
  }
}

const GLOBALS: GlobalSnapshot[] = new Array(GLOBAL_KEYS.length);
const SURFACES: SurfaceSnapshot[] = [];
for (let index = 0; index < GLOBAL_KEYS.length; index += 1) {
  const key = GLOBAL_KEYS[index]!;
  const observed = descriptor(SAFE_GLOBAL, key);
  GLOBALS[index] = { key, descriptor: observed };
  const value =
    observed === undefined
      ? undefined
      : hasOwn(observed, "value")
        ? observed.value
        : observed.get === undefined
          ? undefined
          : SAFE_REFLECT_APPLY(observed.get, SAFE_GLOBAL, []);
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    captureSurface(value as object, SURFACES, key);
  }
}

const ARRAY_VALUES = Array.prototype.values;
const MAP_ENTRIES = Map.prototype.entries;
const SET_VALUES = Set.prototype.values;
captureSurface(
  prototypeOf(SAFE_REFLECT_APPLY(ARRAY_VALUES, [], []) as object)!,
  SURFACES,
  "ArrayIteratorPrototype",
);
captureSurface(
  prototypeOf(SAFE_REFLECT_APPLY(MAP_ENTRIES, new Map(), []) as object)!,
  SURFACES,
  "MapIteratorPrototype",
);
captureSurface(
  prototypeOf(SAFE_REFLECT_APPLY(SET_VALUES, new Set(), []) as object)!,
  SURFACES,
  "SetIteratorPrototype",
);

/**
 * The shared panel-art pipeline predates hostile input and resolves realm
 * primordials dynamically. After all source inputs are non-invoking snapshots,
 * verify that complete synchronous derivation will run in the captured realm.
 */
function realBuildSourceDerivationPrimordialDrift(): string | null {
  try {
    for (let index = 0; index < GLOBALS.length; index += 1) {
      const expected = GLOBALS[index]!;
      if (!sameDescriptor(descriptor(SAFE_GLOBAL, expected.key), expected.descriptor)) {
        return `global binding ${expected.key}`;
      }
    }
    for (let index = 0; index < SURFACES.length; index += 1) {
      const expected = SURFACES[index]!;
      if (prototypeOf(expected.owner) !== expected.prototype) return `${expected.label} prototype`;
      const keys = ownKeys(expected.owner);
      if (keys.length !== expected.descriptors.length) return `${expected.label} own-key count`;
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        const retained = expected.descriptors[keyIndex]!;
        if (
          keys[keyIndex] !== retained.key ||
          !sameDescriptor(descriptor(expected.owner, retained.key), retained.descriptor)
        ) {
          return `${expected.label} descriptor ${typeof retained.key === "string" ? retained.key : "symbol"}`;
        }
      }
    }
    return null;
  } catch {
    return "non-invoking descriptor inspection";
  }
}

export function requireRealBuildSourceDerivationPrimordials(): void {
  const drift = realBuildSourceDerivationPrimordialDrift();
  if (drift !== null) {
    throw new SAFE_TYPE_ERROR(
      `Source evidence derivation primordials changed after module initialization at ${drift}; refuse before raster work.`,
    );
  }
}
