import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EXACT_LDU_SCALE_EXPONENT, formatExactLduBounds } from "./exact-ldu.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { makePartDefinition } from "./part-factory.ts";

/**
 * A synthetic blueprint, not an admission. It carries 93273's measured
 * -16.00016098 through the whole declaration path so the contract is exercised
 * before any part depends on it; the real part still needs its frame,
 * connectors and collision decided.
 */
const exactBlueprint = (
  overrides: Partial<PartBlueprint> = {},
): PartBlueprint & {
  readonly exactBodyBoundsLdu: NonNullable<PartBlueprint["exactBodyBoundsLdu"]>;
} =>
  ({
    family: "tile",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "exact-bounds-probe.dat",
    withoutClutches: true,
    exactBodyBoundsLdu: {
      min: ["-10", "-16.00016098", "-40"],
      max: ["10", "0", "40"],
    },
    geometrySha256: "0".repeat(64),
    ...overrides,
  }) as PartBlueprint & {
    readonly exactBodyBoundsLdu: NonNullable<PartBlueprint["exactBodyBoundsLdu"]>;
  };

describe("exact body bounds through the part factory", () => {
  it("stores the measured decimal as truth and the double as the derived projection", () => {
    const part = makePartDefinition(exactBlueprint());

    expect(part.exactBodyBoundsLdu).toEqual({
      min: [
        { units: -10_000_000_000, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
        { units: -16_000_160_980, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
        { units: -40_000_000_000, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
      ],
      max: [
        { units: 10_000_000_000, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
        { units: 0, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
        { units: 40_000_000_000, scaleExponent: EXACT_LDU_SCALE_EXPONENT },
      ],
    });
    expect(formatExactLduBounds(part.exactBodyBoundsLdu!)).toEqual({
      min: ["-10", "-16.00016098", "-40"],
      max: ["10", "0", "40"],
    });
    expect(part.bodyBoundsLdu).toEqual({ min: [-10, -16.00016098, -40], max: [10, 0, 40] });
    // A tile carries no studs, so nothing stands proud of the body and the two
    // bounds coincide; the exact pair still travels alongside the double pair.
    expect(part.boundsLdu).toEqual(part.bodyBoundsLdu);
    expect(part.exactBoundsLdu).toEqual(part.exactBodyBoundsLdu);
  });

  it("subtracts the stud overhang exactly rather than through the double", () => {
    const part = makePartDefinition(exactBlueprint({ family: "plate", withoutClutches: true }));

    expect(formatExactLduBounds(part.exactBoundsLdu!).min[1]).toBe("-20.00016098");
    expect(part.boundsLdu.min[1]).toBe(-20.00016098);
    expect(part.exactBodyBoundsLdu).not.toEqual(part.exactBoundsLdu);
  });

  it("binds the exact decimal into the geometry digest, not the double", () => {
    const part = makePartDefinition(exactBlueprint());
    const digest = JSON.parse(part.geometry.digestInput) as Record<string, unknown>;

    expect(digest["bodyBoundsMode"]).toBe(`exact-decimal/${EXACT_LDU_SCALE_EXPONENT}`);
    expect(digest["exactBodyBoundsLdu"]).toEqual({
      min: ["-10", "-16.00016098", "-40"],
      max: ["10", "0", "40"],
    });
    expect(part.geometry.digestInput).not.toContain("-16.000160980000000");

    // One unit — 10^-9 LDU — is a different part, and the digest says so.
    const nudged = makePartDefinition(
      exactBlueprint({
        exactBodyBoundsLdu: {
          min: ["-10", "-16.000160981", "-40"],
          max: ["10", "0", "40"],
        },
      }),
    );
    expect(nudged.geometry.digestInput).not.toBe(part.geometry.digestInput);
    expect(createHash("sha256").update(nudged.geometry.digestInput).digest("hex")).not.toBe(
      createHash("sha256").update(part.geometry.digestInput).digest("hex"),
    );
  });

  it("keeps the digest text of a part that declares no exact bounds unchanged", () => {
    const plain = makePartDefinition({
      family: "tile",
      widthStuds: 1,
      lengthStuds: 4,
      ldrawId: "plain-bounds-probe.dat",
      withoutClutches: true,
      bodyBoundsLdu: { min: [-10, -4, -40], max: [10, 4, 40] },
      geometrySha256: "0".repeat(64),
    });

    expect(plain.geometry.digestInput).not.toContain("exactBodyBoundsLdu");
    expect(plain.geometry.digestInput).not.toContain("bodyBoundsMode");
    expect(Object.hasOwn(plain, "exactBodyBoundsLdu")).toBe(false);
    expect(Object.hasOwn(plain, "exactBoundsLdu")).toBe(false);
  });

  it("refuses a part that states its body extents twice", () => {
    expect(() =>
      makePartDefinition(
        exactBlueprint({ bodyBoundsLdu: { min: [-10, -16, -40], max: [10, 0, 40] } }),
      ),
    ).toThrow(
      /declares body extents twice, as bodyBoundsLdu .* and as exactBodyBoundsLdu .*; a part states its body extents once/,
    );
  });

  it("names the part and the offending coordinate when an exact bound is malformed", () => {
    expect(() =>
      makePartDefinition(
        exactBlueprint({
          exactBodyBoundsLdu: { min: ["-10", "-16.0001609812", "-40"], max: ["10", "0", "40"] },
        }),
      ),
    ).toThrow(
      /exact-bounds-probe\.dat exactBodyBoundsLdu min y is "-16\.0001609812", carrying 10 fractional digits/,
    );
    expect(() =>
      makePartDefinition(
        exactBlueprint({
          exactBodyBoundsLdu: { min: ["-10", "-16.00", "-40"], max: ["10", "0", "40"] },
        }),
      ),
    ).toThrow(/exactBodyBoundsLdu min y is "-16\.00", .* declare it as "-16"/);
  });
});
