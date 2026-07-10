import { createHash } from "node:crypto";

import type { ArtifactRefV1 } from "@lego-studio/protocol";

import { RunLedgerError, type ArtifactResolver, type RunLedgerLimits } from "./run-ledger-types.ts";

const UINT8_ARRAY_SET = Uint8Array.prototype.set;

function intrinsicByteLength(bytes: Uint8Array): number {
  try {
    const length = Reflect.get(
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!,
      "get",
    ) as (this: Uint8Array) => number;
    return Reflect.apply(length, bytes, []) as number;
  } catch (error) {
    throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact resolver returned invalid bytes", {
      cause: error,
    });
  }
}

export async function verifyArtifactReferences(
  artifactResolver: ArtifactResolver,
  references: readonly ArtifactRefV1[],
  limits: RunLedgerLimits,
  scope: "event" | "run",
): Promise<void> {
  const maxReferences =
    scope === "event" ? limits.maxArtifactRefsPerEvent : limits.maxArtifactRefsPerRun;
  const maxBytes =
    scope === "event" ? limits.maxReferencedBytesPerEvent : limits.maxReferencedBytesPerRun;
  if (references.length > maxReferences) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Event has too many artifact references");
  }
  const totalBytes = references.reduce((sum, { byteLength }) => sum + byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > maxBytes) {
    throw new RunLedgerError(
      "LEDGER_LIMIT_EXCEEDED",
      "Event artifact references exceed their byte budget",
    );
  }
  for (const reference of references) {
    let resolved: Uint8Array;
    try {
      resolved = await artifactResolver.read(reference);
    } catch (error) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Artifact reference could not be resolved: ${reference.artifactId}`,
        { cause: error },
      );
    }
    if (!(resolved instanceof Uint8Array)) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact resolver returned invalid bytes");
    }
    if (typeof SharedArrayBuffer !== "undefined" && resolved.buffer instanceof SharedArrayBuffer) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        "Shared artifact bytes are outside local CAS policy",
      );
    }
    const byteLength = intrinsicByteLength(resolved);
    if (byteLength !== reference.byteLength || byteLength > maxBytes) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Resolved artifact size violates its reference: ${reference.artifactId}`,
      );
    }
    const snapshot = Buffer.alloc(byteLength);
    try {
      Reflect.apply(UINT8_ARRAY_SET, snapshot, [resolved]);
    } catch (error) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes could not be snapshotted", {
        cause: error,
      });
    }
    if (intrinsicByteLength(resolved) !== byteLength) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes changed during snapshot");
    }
    let actualHash: string;
    try {
      actualHash = `sha256:${createHash("sha256").update(snapshot).digest("hex")}`;
    } catch (error) {
      throw new RunLedgerError("ARTIFACT_UNRESOLVED", "Artifact bytes could not be hashed", {
        cause: error,
      });
    }
    if (actualHash !== reference.sha256) {
      throw new RunLedgerError(
        "ARTIFACT_UNRESOLVED",
        `Resolved artifact does not match its reference: ${reference.artifactId}`,
      );
    }
  }
}
