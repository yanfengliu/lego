import { Buffer } from "node:buffer";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAXIMUM_STEP_CAPTURE_BYTES = 16 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodeRealBuildPngCapture(value: string): Buffer {
  if (!value.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new TypeError("Real-build step capture must be an exact PNG data URL.");
  }
  const encoded = value.slice(PNG_DATA_URL_PREFIX.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    throw new TypeError("Real-build step capture must contain canonical base64.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length < PNG_SIGNATURE.length ||
    bytes.length > MAXIMUM_STEP_CAPTURE_BYTES ||
    bytes.toString("base64") !== encoded ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new TypeError(
      `Real-build step capture must be a ${PNG_SIGNATURE.length}..${MAXIMUM_STEP_CAPTURE_BYTES}-byte canonical PNG.`,
    );
  }
  return bytes;
}

export function isNullableRealBuildPngCapture(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    decodeRealBuildPngCapture(value);
    return true;
  } catch {
    return false;
  }
}
