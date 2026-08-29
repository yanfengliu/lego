import { describe, expect, it } from "vitest";

import {
  closePrefix50OccurrenceCatalogBinding,
  resolvePrefix50OccurrenceCatalogBinding,
} from "./part-identification-prefix50-official-ldraw-world-proposal-occurrence.mjs";
import { PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS } from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const contextFromBinding = (binding) => ({
  stepNumber: binding.stepNumber,
  phaseSequence: binding.phaseSequence,
  member: {
    sourceBuilderIdentityOrdinal: binding.sourceBuilderIdentityOrdinal,
    builderBrickRef: binding.builderBrickRef,
    calloutIdentity: binding.calloutIdentity,
    designRevision: binding.designRevision,
  },
  callout: { catalogPartId: binding.publishedCatalogPartId },
  leaf: { ldrawFilename: binding.ldrawFilename },
});

describe("prefix-50 exact occurrence-scoped catalog binding", () => {
  it("retains eleven full first-50 bases, nine resolved corrections, and two moved roots", () => {
    expect(PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS).toHaveLength(11);
    expect(
      PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.filter(
        ({ bindingKind }) => bindingKind === "resolved-catalog-part-correction",
      ),
    ).toHaveLength(9);
    expect(
      PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.filter(
        ({ bindingKind }) => bindingKind === "identity-moved-root",
      ).map(({ sourceBuilderIdentityOrdinal, designRevision, movedRootProofId }) => ({
        sourceBuilderIdentityOrdinal,
        designRevision,
        movedRootProofId,
      })),
    ).toEqual([
      {
        sourceBuilderIdentityOrdinal: 25,
        designRevision: "41769;G",
        movedRootProofId: "41769.dat->41769a.dat",
      },
      {
        sourceBuilderIdentityOrdinal: 39,
        designRevision: "41770;H",
        movedRootProofId: "41770.dat->41770a.dat",
      },
    ]);
    expect(
      PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.every(
        ({ stepNumber, occurrenceScoped }) =>
          stepNumber >= 1 && stepNumber <= 50 && occurrenceScoped === true,
      ),
    ).toBe(true);
    expect(
      PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.filter(
        ({ catalogPartId, publishedCatalogPartId }) => catalogPartId !== publishedCatalogPartId,
      ),
    ).toHaveLength(9);
  });

  it("resolves only the exact ordinal/step/phase/brick/callout/design/published-part/root basis", () => {
    for (const expected of PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS) {
      const open = resolvePrefix50OccurrenceCatalogBinding(contextFromBinding(expected));
      expect(open).toBe(expected);
      expect(closePrefix50OccurrenceCatalogBinding(open, expected.catalogLdrawFilename)).toEqual(
        expected,
      );
    }
    const expected = PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS[0];
    const wrongOccurrence = contextFromBinding(expected);
    wrongOccurrence.member.builderBrickRef = "wrong-occurrence";
    expect(() => resolvePrefix50OccurrenceCatalogBinding(wrongOccurrence)).toThrow(
      /full step\/phase\/brick\/callout\/design\/published-part\/source-root basis/,
    );
    expect(() => closePrefix50OccurrenceCatalogBinding(expected, "41770a.dat")).toThrow(
      /requires catalog root 41769a\.dat/,
    );
  });

  it("leaves an unrelated published binding unchanged and rejects step 51", () => {
    const ordinary = resolvePrefix50OccurrenceCatalogBinding({
      stepNumber: 1,
      phaseSequence: 1,
      member: {
        sourceBuilderIdentityOrdinal: 1,
        builderBrickRef: "ordinary-brick",
        calloutIdentity: "ordinary-callout",
        designRevision: "3001;A",
      },
      callout: { catalogPartId: "builtin:brick-2x4" },
      leaf: { ldrawFilename: "3001.dat" },
    });
    expect(closePrefix50OccurrenceCatalogBinding(ordinary, "3001.dat")).toMatchObject({
      publishedCatalogPartId: "builtin:brick-2x4",
      catalogPartId: "builtin:brick-2x4",
      occurrenceScoped: false,
    });
    expect(() =>
      resolvePrefix50OccurrenceCatalogBinding({
        ...contextFromBinding(PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS[0]),
        stepNumber: 51,
      }),
    ).toThrow(/invalid bounded source basis/);
  });
});
