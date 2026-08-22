import { existsSync } from "node:fs";
import { join } from "node:path";

import { readContainedFile, writeContainedFile } from "./part-identification-io.mjs";

/** Non-replacing content-addressed publication; identical bytes may be reused. */
export function publishImmutableContainedBytes(out, path, bytes, options) {
  const payload = Buffer.from(bytes);
  const target = join(out, ...path.split("/"));
  const read = () =>
    readContainedFile(out, path, {
      label: options.label,
      pathLabel: options.pathLabel,
      maxBytes: options.maxBytes,
    });
  if (existsSync(target)) {
    const existing = read();
    if (!existing.equals(payload)) {
      throw new Error(
        `${options.label} target ${path} already exists with different bytes; immutable publication did not replace it.`,
      );
    }
    return existing;
  }
  try {
    writeContainedFile(out, path, payload, {
      label: options.label,
      pathLabel: options.pathLabel,
      maxBytes: options.maxBytes,
      exclusive: true,
    });
  } catch (cause) {
    if (!existsSync(target)) throw cause;
    const raced = read();
    if (!raced.equals(payload)) {
      throw new Error(
        `${options.label} target ${path} raced with different bytes; immutable publication did not replace it.`,
        { cause },
      );
    }
  }
  const retained = read();
  if (!retained.equals(payload)) {
    throw new Error(`${options.label} did not reopen as the exact published bytes.`);
  }
  return retained;
}
