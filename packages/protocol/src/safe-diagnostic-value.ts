const ARRAY_IS_ARRAY = Array.isArray;
const REFLECT_APPLY = Reflect.apply;
const STRING = String;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const STRING_FROM_CHAR_CODE = String.fromCharCode;

const HEX_DIGITS = "0123456789abcdef";
const MAX_RENDERED_STRING_CODE_UNITS = 72;

function escapedCodeUnit(code: number): string {
  if (code === 0x22) return '\\"';
  if (code === 0x5c) return "\\\\";
  if (code >= 0x20 && code <= 0x7e) return STRING_FROM_CHAR_CODE(code);
  return `\\u${HEX_DIGITS[(code >>> 12) & 0xf]}${HEX_DIGITS[(code >>> 8) & 0xf]}${HEX_DIGITS[(code >>> 4) & 0xf]}${HEX_DIGITS[code & 0xf]}`;
}

function boundedString(value: string): string {
  const limit =
    value.length < MAX_RENDERED_STRING_CODE_UNITS ? value.length : MAX_RENDERED_STRING_CODE_UNITS;
  let rendered = '"';
  for (let index = 0; index < limit; index += 1) {
    const code = REFLECT_APPLY(STRING_CHAR_CODE_AT, value, [index]) as number;
    rendered += escapedCodeUnit(code);
  }
  rendered += '"';
  if (value.length > limit) {
    rendered += ` (truncated from ${STRING(value.length)} code units)`;
  }
  return rendered;
}

/** Renders hostile values as bounded, one-line diagnostics without invoking their methods. */
export function safeDiagnosticValue(value: unknown): string {
  if (typeof value === "string") return boundedString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return STRING(value);
  }
  if (typeof value === "bigint") return "a bigint value";
  if (value === undefined) return "undefined";
  if (ARRAY_IS_ARRAY(value)) return "an array value";
  if (typeof value === "object") return "an object value";
  if (typeof value === "symbol") return "a symbol value";
  return "a function value";
}
