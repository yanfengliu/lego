import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildCandidateDocumentSnapshot,
  requireRealBuildCandidateDocumentSnapshot,
  requireRealBuildCandidateDocumentSnapshotValue,
} from "../e2e/real-build-candidate-document-snapshot";

describe("real-build candidate document snapshots", () => {
  it("parses exact kernel-canonical bytes into a detached deeply frozen document", () => {
    const source = createEmptyBrickDocument({ id: "snapshot-source", name: "Snapshot source" });
    const canonicalDocument = canonicalBrickDocument(source);
    const documentHash = documentStructuralHash(source);
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument,
      expectedDocumentHash: documentHash,
    });

    (source.constraints.allowedColorIds as string[]).push("attacker:late-alias");
    expect(snapshot.canonicalBytes).toBe(canonicalDocument);
    expect(snapshot.document.constraints.allowedColorIds).not.toContain("attacker:late-alias");
    expect(Object.isFrozen(snapshot.document.constraints.allowedColorIds)).toBe(true);
    expect(requireRealBuildCandidateDocumentSnapshot(snapshot, { documentHash })).toBe(snapshot);
    expect(requireRealBuildCandidateDocumentSnapshotValue(snapshot)).toBe(snapshot);
  });

  it("refuses noncanonical bytes, a caller-selected hash, and hostile accessors", () => {
    const source = createEmptyBrickDocument({ id: "snapshot-refusal", name: "Refusal" });
    const canonicalDocument = canonicalBrickDocument(source);
    const documentHash = documentStructuralHash(source);

    expect(() =>
      createRealBuildCandidateDocumentSnapshot({
        canonicalDocument: JSON.stringify(source, null, 2),
        expectedDocumentHash: documentHash,
      }),
    ).toThrow(/exact kernel canonical JSON/u);
    expect(() =>
      createRealBuildCandidateDocumentSnapshot({
        canonicalDocument,
        expectedDocumentHash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/structural hash does not match/u);

    let invoked = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "canonicalDocument", {
      enumerable: true,
      get() {
        invoked += 1;
        throw new Error("must remain inert");
      },
    });
    Object.defineProperty(hostile, "expectedDocumentHash", {
      enumerable: true,
      value: documentHash,
    });
    expect(() => createRealBuildCandidateDocumentSnapshot(hostile as never)).toThrow(
      /own data property/u,
    );
    expect(invoked).toBe(0);

    let snapshotFieldRead = 0;
    const forgedSnapshot = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(forgedSnapshot, "documentHash", {
      get() {
        snapshotFieldRead += 1;
        throw new Error("must remain inert");
      },
    });
    expect(() => requireRealBuildCandidateDocumentSnapshotValue(forgedSnapshot)).toThrow(
      /exact immutable snapshot/u,
    );
    expect(snapshotFieldRead).toBe(0);
  });

  it("bounds canonical JSON nesting and expansion before parsing", () => {
    expect(() =>
      createRealBuildCandidateDocumentSnapshot({
        canonicalDocument: "[".repeat(129),
        expectedDocumentHash: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/depth limit/u);

    expect(() =>
      createRealBuildCandidateDocumentSnapshot({
        canonicalDocument: `[${"0,".repeat(1_000_000)}0]`,
        expectedDocumentHash: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/exceeds 1000000 structural values.*before parsing/u);
  });
});
