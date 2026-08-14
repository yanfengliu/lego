const MAX_OBSERVED_CHARACTERS = 240;
const MAX_STRING_CHARACTERS = 120;
const MAX_SAMPLE_ITEMS = 4;

function boundedString(value) {
  if (value.length <= MAX_STRING_CHARACTERS) return JSON.stringify(value);
  return `${JSON.stringify(`${value.slice(0, MAX_STRING_CHARACTERS - 3)}...`)} (string length ${value.length})`;
}

function scalarSummary(value) {
  if (value === null) return "null";
  if (typeof value === "string") return boundedString(value);
  if (typeof value === "number") {
    if (Object.is(value, -0)) return "-0";
    return String(value);
  }
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "boolean" || typeof value === "undefined") return String(value);
  if (typeof value === "symbol") return "<symbol>";
  if (typeof value === "function") return "<function>";
  if (Array.isArray(value)) return `Array(length=${value.length})`;
  return "Object";
}

/** Render hostile values without serializing their full retained payload. */
export function boundedObserved(value) {
  let rendered;
  try {
    if (Array.isArray(value)) {
      const sample = value.slice(0, MAX_SAMPLE_ITEMS).map(scalarSummary).join(", ");
      rendered = `Array(length=${value.length}, sample=[${sample}${
        value.length > MAX_SAMPLE_ITEMS ? ", ..." : ""
      }])`;
    } else if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value);
      const sample = keys.slice(0, MAX_SAMPLE_ITEMS).map(boundedString).join(", ");
      rendered = `Object(keys=${keys.length}, sample=[${sample}${
        keys.length > MAX_SAMPLE_ITEMS ? ", ..." : ""
      }])`;
    } else {
      rendered = scalarSummary(value);
    }
  } catch {
    rendered = `<uninspectable ${value === null ? "null" : typeof value}>`;
  }
  return rendered.length <= MAX_OBSERVED_CHARACTERS
    ? rendered
    : `${rendered.slice(0, MAX_OBSERVED_CHARACTERS - 3)}...`;
}

export const __testOnly = Object.freeze({ MAX_OBSERVED_CHARACTERS });
