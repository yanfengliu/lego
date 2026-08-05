const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

/** Decodes JSON without accepting replacement characters for malformed UTF-8. */
export function parseFatalUtf8Json<T>(bytes: Uint8Array, label: string): T {
  let text: string;
  try {
    text = fatalUtf8Decoder.decode(bytes);
  } catch (error) {
    throw new TypeError(
      `${label} is not canonical UTF-8; malformed byte sequences are rejected instead of replaced: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new TypeError(
      `${label} is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}
