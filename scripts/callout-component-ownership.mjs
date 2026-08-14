const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMPONENT_KEYS = [
  "absoluteForegroundSha256",
  "boundsPx",
  "foregroundPixels",
  "rasterScale",
  "rawComponentCount",
];
const BOUNDS_KEYS = ["bottom", "left", "right", "top"];
const ARRAY_IS_ARRAY = Array.isArray;
const MAP_GET = Map.prototype.get;
const MAP_SET = Map.prototype.set;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_HAS_OWN = Object.hasOwn;
const REFLECT_APPLY = Reflect.apply;
const REFLECT_OWN_KEYS = Reflect.ownKeys;
const REGEXP_TEST = RegExp.prototype.test;

const integer = (value, minimum = 0, maximum = 100_000) =>
  NUMBER_IS_SAFE_INTEGER(value) && value >= minimum && value <= maximum;
const exactKeys = (value, keys) => {
  if (value === null || typeof value !== "object" || ARRAY_IS_ARRAY(value)) return false;
  if (REFLECT_OWN_KEYS(value).length !== keys.length) return false;
  for (let index = 0; index < keys.length; index += 1) {
    if (!OBJECT_HAS_OWN(value, keys[index])) return false;
  }
  return true;
};
const identity = (callout, index) =>
  typeof callout?.identity === "string" && callout.identity.length <= 96
    ? callout.identity
    : `entry ${index}`;
const bounds = (value) => {
  if (!exactKeys(value, BOUNDS_KEYS)) return false;
  for (let index = 0; index < BOUNDS_KEYS.length; index += 1) {
    if (!integer(value[BOUNDS_KEYS[index]])) return false;
  }
  return value.left <= value.right && value.top <= value.bottom;
};
const clearance = (value) => {
  if (!exactKeys(value, BOUNDS_KEYS)) return false;
  for (let index = 0; index < BOUNDS_KEYS.length; index += 1) {
    if (!integer(value[BOUNDS_KEYS[index]])) return false;
  }
  return true;
};
const mapGet = (map, key) => REFLECT_APPLY(MAP_GET, map, [key]);
const mapSet = (map, key, value) => REFLECT_APPLY(MAP_SET, map, [key, value]);

export function assertCalloutComponentOwnership(callouts, label = "Callout manifest") {
  if (!ARRAY_IS_ARRAY(callouts) || callouts.length < 1 || callouts.length > 2_000) {
    throw new Error(`${label} must contain 1..2000 bounded callout records.`);
  }
  const digestOwners = new Map();
  const boundsOwners = new Map();
  for (let index = 0; index < callouts.length; index += 1) {
    const callout = callouts[index];
    const owner = identity(callout, index);
    if (callout?.evidenceKind !== "part-art") {
      if (callout?.sourceComponent !== null) {
        throw new Error(`${label} ${owner} is semantic and must declare sourceComponent null.`);
      }
      if (callout?.cropStrategy !== "semantic-action-region") {
        throw new Error(`${label} ${owner} must use the semantic-action-region crop strategy.`);
      }
      continue;
    }
    const component = callout.sourceComponent;
    const cropWidth = callout?.cropRectPx?.right - callout?.cropRectPx?.left + 1;
    const cropHeight = callout?.cropRectPx?.bottom - callout?.cropRectPx?.top + 1;
    const componentArea = component?.boundsPx
      ? (component.boundsPx.right - component.boundsPx.left + 1) *
        (component.boundsPx.bottom - component.boundsPx.top + 1)
      : 0;
    if (
      callout.regionKind !== "isolated-component" ||
      callout.cropStrategy !== "ranked-component" ||
      !exactKeys(component, COMPONENT_KEYS) ||
      component.rasterScale !== 8 ||
      !bounds(component.boundsPx) ||
      !integer(component.foregroundPixels, 1, 4_000_000) ||
      !integer(component.rawComponentCount, 1, 64) ||
      component.foregroundPixels !== callout.foregroundPixels ||
      !REFLECT_APPLY(REGEXP_TEST, SHA256, [component.absoluteForegroundSha256]) ||
      !bounds(callout.cropRectPx) ||
      !clearance(callout.boundaryClearancePx) ||
      !integer(callout.widthPx, 1, 4_096) ||
      !integer(callout.heightPx, 1, 4_096) ||
      callout.widthPx * callout.heightPx > 16 * 1024 * 1024 ||
      cropWidth !== callout.widthPx ||
      cropHeight !== callout.heightPx ||
      component.foregroundPixels > componentArea ||
      component.rawComponentCount > component.foregroundPixels ||
      (component.foregroundPixels === 1 && componentArea > 1)
    ) {
      throw new Error(
        `${label} ${owner} must bind one ranked-component physical source group with 1..64 raw members no greater than its foreground pixels at scale 8, exact inclusive crop dimensions and tight foreground bounds (one pixel requires 1x1), and a lowercase absolute-foreground SHA-256.`,
      );
    }
    const derived = {
      left: callout.cropRectPx.left + callout.boundaryClearancePx.left,
      top: callout.cropRectPx.top + callout.boundaryClearancePx.top,
      right: callout.cropRectPx.right - callout.boundaryClearancePx.right,
      bottom: callout.cropRectPx.bottom - callout.boundaryClearancePx.bottom,
    };
    if (
      component.boundsPx.left !== derived.left ||
      component.boundsPx.top !== derived.top ||
      component.boundsPx.right !== derived.right ||
      component.boundsPx.bottom !== derived.bottom
    ) {
      throw new Error(
        `${label} ${owner} source-component-group bounds do not equal its retained crop foreground bounds.`,
      );
    }
    const digestOwner = mapGet(digestOwners, component.absoluteForegroundSha256);
    if (digestOwner !== undefined) {
      throw new Error(
        `${label} ${owner} and ${digestOwner} claim the same absolute source component-group digest.`,
      );
    }
    const boundsKey = `${callout.pageNumber}|${derived.left}|${derived.top}|${derived.right}|${derived.bottom}`;
    const boundsOwner = mapGet(boundsOwners, boundsKey);
    if (boundsOwner !== undefined) {
      throw new Error(
        `${label} ${owner} and ${boundsOwner} claim the same absolute source component-group bounds.`,
      );
    }
    mapSet(digestOwners, component.absoluteForegroundSha256, owner);
    mapSet(boundsOwners, boundsKey, owner);
  }
  return callouts;
}
