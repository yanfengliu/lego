import type { Step44ClosureManifestEntry } from "./real-build-prefix50-step44-source-reader-closure-gate.ts";

export function parseStep44ClosureManifestRows(raw: string): readonly Step44ClosureManifestEntry[] {
  return raw
    .trim()
    .split("\n")
    .map((row) => {
      const [path, digest, bytesText, kind, ...unexpected] = row.split("|");
      if (
        path === undefined ||
        digest === undefined ||
        !/^sha256:[a-f0-9]{64}$/u.test(digest) ||
        bytesText === undefined ||
        !/^[1-9][0-9]*$/u.test(bytesText) ||
        (kind !== "typescript-source" &&
          kind !== "external-immutable-helper" &&
          kind !== "external-immutable-binary") ||
        unexpected.length !== 0
      )
        throw new TypeError("Exact Step-44 three-root manifest contains an invalid reviewed row.");
      const bytes = Number(bytesText);
      if (!Number.isSafeInteger(bytes))
        throw new TypeError("Exact Step-44 three-root manifest contains an invalid byte count.");
      return Object.freeze({
        path,
        digest: digest as `sha256:${string}`,
        bytes,
        kind,
      });
    });
}
