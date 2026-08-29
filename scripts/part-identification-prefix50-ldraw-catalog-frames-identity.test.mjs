import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { openExactLdrawArchive } from "./part-identification-prefix50-ldraw-catalog-frames-archive.mjs";
import { verifyPrefix50OccurrenceIdentityMovedRoot } from "./part-identification-prefix50-ldraw-catalog-frames-identity.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS,
  PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";
import { PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS } from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const archivePresent = existsSync(PREFIX50_LDRAW_CATALOG_FRAMES_PINS.officialArchive.path);

describe.runIf(archivePresent)("prefix-50 exact occurrence-scoped identity moved roots", () => {
  const archive = openExactLdrawArchive(
    readFileSync(PREFIX50_LDRAW_CATALOG_FRAMES_PINS.officialArchive.path),
  );
  const occurrences = PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.filter(
    ({ bindingKind }) => bindingKind === "identity-moved-root",
  );

  it("proves each source is one pinned same-hand identity redirect with equal expanded geometry", () => {
    const proofs = PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS.map((expectation) =>
      verifyPrefix50OccurrenceIdentityMovedRoot({
        archive,
        expectation,
        occurrence: occurrences.find(
          ({ movedRootProofId }) => movedRootProofId === expectation.proofId,
        ),
      }),
    );
    expect(proofs).toHaveLength(2);
    expect(
      proofs.map(({ proofId, source, target, sameExpandedGeometry, globalAliasClaimed }) => ({
        proofId,
        sourceTriangles: source.expandedTriangleCount,
        targetTriangles: target.expandedTriangleCount,
        sameExpandedGeometry,
        globalAliasClaimed,
      })),
    ).toEqual([
      {
        proofId: "41769.dat->41769a.dat",
        sourceTriangles: 521,
        targetTriangles: 521,
        sameExpandedGeometry: true,
        globalAliasClaimed: false,
      },
      {
        proofId: "41770.dat->41770a.dat",
        sourceTriangles: 521,
        targetTriangles: 521,
        sameExpandedGeometry: true,
        globalAliasClaimed: false,
      },
    ]);
  });

  it("rejects cross-hand substitution and a wrong occurrence", () => {
    const right = PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS[0];
    const left = PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS[1];
    const rightOccurrence = occurrences.find(
      ({ movedRootProofId }) => movedRootProofId === right.proofId,
    );
    expect(() =>
      verifyPrefix50OccurrenceIdentityMovedRoot({
        archive,
        expectation: { ...right, targetRoot: left.targetRoot },
        occurrence: { ...rightOccurrence, catalogLdrawFilename: left.targetRoot.filename },
      }),
    ).toThrow(/identity-matrix reference to same-hand target|must be the exact/);
    expect(() =>
      verifyPrefix50OccurrenceIdentityMovedRoot({
        archive,
        expectation: right,
        occurrence: { ...rightOccurrence, sourceBuilderIdentityOrdinal: 26 },
      }),
    ).toThrow(/exact occurrence-scoped ordinal/);
  });
});
