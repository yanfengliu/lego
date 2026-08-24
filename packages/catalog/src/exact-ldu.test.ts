import { describe, expect, it } from "vitest";

import {
  addExactLdu,
  assertExactLdu,
  assertNumericBoundsContainExact,
  compareExactLdu,
  compareNumberToExactLdu,
  EXACT_LDU_SCALE_EXPONENT,
  exactLduBoundsToNumbers,
  exactLduEquals,
  exactLduFromDecimalString,
  exactLduFromNumber,
  exactLduToNumber,
  formatExactLdu,
  formatExactLduBounds,
  isExactLduRepresentableAsNumber,
  MAX_EXACT_LDU_MAGNITUDE,
  MAX_EXACT_LDU_SCALE_EXPONENT,
  parseExactLduBounds,
  subtractExactLdu,
} from "./exact-ldu.ts";
import type { ExactLduBoundsDeclaration } from "./exact-ldu.ts";

/**
 * The measured bounds of the eight audited set 6651557 source-pilot closures,
 * copied from `output/real-build/set-6651557-source-pilot.json`, plus 41682's
 * catalog-frame bound from the retained measured-part emission and scorecard.
 *
 * 93273 is the one this representation exists for: -16.00016098 is not a
 * float64, and it is one of the pilot identities that motivated this type.
 * 51739's +/-38.5 is a double and still has to survive the same path unchanged.
 */
const MEASURED_BOUND_FIXTURES: Readonly<Record<string, ExactLduBoundsDeclaration>> = {
  "5092": { min: ["-20", "0", "-10"], max: ["17", "8", "10"] },
  "2877": { min: ["-20", "-4", "-10"], max: ["20", "24", "10"] },
  "30357": { min: ["-10", "-4", "-10"], max: ["50", "8", "50"] },
  "35480": { min: ["-20", "-4", "-10"], max: ["20", "8", "10"] },
  "51739": { min: ["-38.5", "-4", "-20"], max: ["38.5", "8", "20"] },
  "77844": { min: ["-10", "-4", "-10"], max: ["50", "8", "50"] },
  "93273": { min: ["-10", "-16.00016098", "-40"], max: ["10", "0", "40"] },
  "15254": { min: ["-60", "-4", "-10"], max: ["60", "48", "10"] },
  "41682": { min: ["-20", "-14", "-20"], max: ["20", "14", "20"] },
};

describe("exact LDU round trips", () => {
  it("round-trips every retained pilot and the 41682 emission bound exactly", () => {
    for (const [designId, declaration] of Object.entries(MEASURED_BOUND_FIXTURES)) {
      const parsed = parseExactLduBounds(declaration, `${designId} bodyBoundsLdu`);
      expect(formatExactLduBounds(parsed), designId).toEqual(declaration);
    }
  });

  it("carries 93273's -16.00016098, which float64 loses", () => {
    const exact = exactLduFromDecimalString("-16.00016098", "93273 min y");

    expect(exact).toEqual({ units: -16_000_160_980, scaleExponent: EXACT_LDU_SCALE_EXPONENT });
    expect(formatExactLdu(exact)).toBe("-16.00016098");
    // The double is a different number, and this is the measurement that ruled
    // float64 out: its exact expansion is not the value that was measured.
    expect(isExactLduRepresentableAsNumber(exact)).toBe(false);
    expect((-16.00016098).toFixed(20)).toBe("-16.00016098000000042134");
    expect(compareNumberToExactLdu(-16.00016098, exact, "93273 min y")).toBe(-1);
  });

  it("carries 51739's +/-38.5, which float64 keeps", () => {
    const low = exactLduFromDecimalString("-38.5", "51739 min x");
    const high = exactLduFromDecimalString("38.5", "51739 max x");

    expect(low.units).toBe(-38_500_000_000);
    expect(isExactLduRepresentableAsNumber(low)).toBe(true);
    expect(isExactLduRepresentableAsNumber(high)).toBe(true);
    expect(exactLduToNumber(high)).toBe(38.5);
    expect(compareNumberToExactLdu(38.5, high, "51739 max x")).toBe(0);
  });

  it("projects every retained measured bound to a float64 that never shrinks the exact solid", () => {
    for (const [designId, declaration] of Object.entries(MEASURED_BOUND_FIXTURES)) {
      const exact = parseExactLduBounds(declaration, designId);
      const numeric = exactLduBoundsToNumbers(exact);

      expect(() =>
        assertNumericBoundsContainExact(numeric, exact, `${designId} bodyBoundsLdu`),
      ).not.toThrow();
    }
  });

  it("recovers an authored double through its shortest round-trip decimal", () => {
    expect(exactLduFromNumber(38.5, "half").units).toBe(38_500_000_000);
    expect(exactLduFromNumber(-19.5, "axle").units).toBe(-19_500_000_000);
    // The staircase heights the catalog already carries are two-decimal
    // literals no double holds; the shortest decimal recovers what was written.
    expect(formatExactLdu(exactLduFromNumber(15.14, "curved slope step"))).toBe("15.14");
    expect(formatExactLdu(exactLduFromNumber(8.99, "curved slope step"))).toBe("8.99");
    expect(formatExactLdu(exactLduFromNumber(-0, "zero"))).toBe("0");
  });

  it("compares and combines exactly at the 10^-9 scale", () => {
    const low = exactLduFromDecimalString("-16.00016098", "low");
    const overhang = exactLduFromDecimalString("4", "stud overhang");

    expect(formatExactLdu(subtractExactLdu(low, overhang, "visual min"))).toBe("-20.00016098");
    expect(formatExactLdu(addExactLdu(low, overhang, "visual min"))).toBe("-12.00016098");
    expect(compareExactLdu(low, overhang)).toBe(-1);
    expect(compareExactLdu(overhang, low)).toBe(1);
    expect(exactLduEquals(low, exactLduFromDecimalString("-16.00016098", "again"))).toBe(true);
    expect(formatExactLdu(exactLduFromDecimalString("0.000000001", "one unit"))).toBe(
      "0.000000001",
    );
  });

  it("round-trips text and units over the whole representable range", () => {
    // Formatting splits units into a whole and a fraction through float64
    // division, so the carry at every multiple of 10^9 is where it would break.
    // A fixed 32-bit generator keeps this a property check rather than a
    // lottery, and draws the whole and the fraction separately so the carry is
    // exercised across the range rather than only where a scaled random lands.
    let state = 0x5eed_1557;
    const next32 = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };
    const nextUnits = (): number => {
      const whole = next32() % 9_007_200;
      const fraction = next32() % 1_000_000_000;
      const magnitude = Math.min(whole * 1_000_000_000 + fraction, Number.MAX_SAFE_INTEGER);
      return next32() % 2 === 0 ? magnitude : -magnitude;
    };
    const boundaries = [
      0,
      1,
      -1,
      999_999_999,
      1_000_000_000,
      1_000_000_001,
      -1_000_000_000,
      -1_000_000_001,
      16_000_160_980,
      -16_000_160_980,
      38_500_000_000,
      9_007_199_000_000_000,
      9_007_199_254_740_990,
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
    ];
    const units = [...boundaries, ...Array.from({ length: 200_000 }, nextUnits)];

    let mismatches = 0;
    for (const value of units) {
      const text = formatExactLdu({ units: value, scaleExponent: EXACT_LDU_SCALE_EXPONENT });
      if (exactLduFromDecimalString(text, "sweep").units !== value) mismatches += 1;
    }
    expect({ checked: units.length, distinct: new Set(units).size, mismatches }).toEqual({
      checked: 200_015,
      distinct: 200_015,
      mismatches: 0,
    });
  });

  it("compares exactly at both ends of the representable range", () => {
    // One unit is the smallest quantity there is and the ceiling is the
    // largest; neither is a double, and the comparison still resolves which
    // side its nearest double fell on. The smallest one is the case the
    // hundred-digit expansion has to cover — 1e-9 needs 82 fractional digits.
    const sides: Readonly<Record<string, -1 | 1>> = {
      "0.000000001": 1,
      "-0.000000001": -1,
      "9007199.254740991": -1,
      "-9007199.254740991": 1,
    };

    for (const [text, side] of Object.entries(sides)) {
      const exact = exactLduFromDecimalString(text, `extreme ${text}`);

      expect(formatExactLdu(exact), text).toBe(text);
      expect(isExactLduRepresentableAsNumber(exact), text).toBe(false);
      expect(compareNumberToExactLdu(exactLduToNumber(exact), exact, text), text).toBe(side);
    }
  });
});

describe("exact LDU rejections", () => {
  it("rejects a scale finer than the measured maximum, naming the value and the bound", () => {
    expect(() => exactLduFromDecimalString("-16.0001609812", "93273 min y")).toThrow(
      /is "-16\.0001609812", carrying 10 fractional digits \("0001609812"\); the exact LDU scale is 10\^-9, so at most 9 are representable/,
    );
    expect(() => assertExactLdu({ units: 1, scaleExponent: 12 }, "hand-built value")).toThrow(
      /declares scaleExponent 12, finer than the measured maximum 9/,
    );
    expect(() => assertExactLdu({ units: 1, scaleExponent: -1 }, "hand-built value")).toThrow(
      /needs a whole scaleExponent between 0 and 9/,
    );
    // Inside the admissible range but not the one stored scale: still refused,
    // so two spellings of the same bound cannot reach one digest.
    expect(() => assertExactLdu({ units: 385, scaleExponent: 1 }, "hand-built value")).toThrow(
      /declares 385 units at scaleExponent 1; catalog-stored exact LDU is normalized to the single fixed scale 9/,
    );
    expect(MAX_EXACT_LDU_SCALE_EXPONENT).toBe(9);
  });

  it("rejects units outside the safe-integer range, naming the value and the limit", () => {
    expect(() => exactLduFromDecimalString("9007200", "oversized bound")).toThrow(
      /is "9007200", which is 9007200000000000 units of 10\^-9 LDU and outside the safe-integer range \+\/-9007199254740991/,
    );
    expect(() => exactLduFromDecimalString("-9007200", "oversized bound")).toThrow(
      /outside the safe-integer range/,
    );
    expect(() => assertExactLdu({ units: 1.5, scaleExponent: 9 }, "fractional units")).toThrow(
      /declares units 1\.5; exact LDU units must be a safe integer count of 10\^-9 LDU/,
    );
    expect(() =>
      assertExactLdu({ units: Number.MAX_SAFE_INTEGER + 2, scaleExponent: 9 }, "huge units"),
    ).toThrow(/must be a safe integer count/);
    expect(MAX_EXACT_LDU_MAGNITUDE).toBe(9007199.254740991);
  });

  it("rejects arithmetic that leaves the safe-integer range", () => {
    const near = exactLduFromDecimalString("9007199", "near the ceiling");

    expect(() => addExactLdu(near, near, "doubled bound")).toThrow(
      /produced 18014398000000000 units of 10\^-9 LDU from 9007199 and 9007199, leaving the safe-integer range/,
    );
  });

  it("rejects spellings a measured decimal never produces", () => {
    for (const text of ["+5", "5.", ".5", "1e3", " 5", "5 ", "", "0x10", "NaN", "1,5"]) {
      expect(() => exactLduFromDecimalString(text, "bound"), text).toThrow(
        /must be a plain signed decimal/,
      );
    }
    expect(() => exactLduFromDecimalString("38.50", "bound")).toThrow(
      /is "38\.50", which is not the canonical spelling of that value; declare it as "38\.5"/,
    );
    expect(() => exactLduFromDecimalString("-0", "bound")).toThrow(/declare it as "0"/);
    expect(() => exactLduFromDecimalString("007", "bound")).toThrow(/declare it as "7"/);
    expect(() => exactLduFromDecimalString(-16.00016098 as unknown as string, "bound")).toThrow(
      /must be a decimal string such as "-16\.00016098"; received -16\.00016098 of type number/,
    );
  });

  it("rejects a double the shortest decimal cannot state plainly", () => {
    expect(() => exactLduFromNumber(1e-7, "tiny")).toThrow(
      /is the number 1e-7, whose shortest round-trip decimal uses exponent notation/,
    );
    expect(() => exactLduFromNumber(1 / 3, "third")).toThrow(
      /carrying 16 fractional digits \("3333333333333333"\)/,
    );
    expect(() => exactLduFromNumber(Number.NaN, "not a number")).toThrow(
      /must be a finite number to become an exact LDU coordinate; received NaN/,
    );
    expect(() => exactLduFromNumber(Number.POSITIVE_INFINITY, "infinite")).toThrow(
      /received Infinity/,
    );
  });

  it("rejects an inverted bound and a malformed vector", () => {
    expect(() =>
      parseExactLduBounds({ min: ["0", "5", "0"], max: ["0", "-5", "0"] }, "inverted"),
    ).toThrow(/y runs from min 5 to max -5; a bound needs min no greater than max on every axis/);
    expect(() =>
      parseExactLduBounds(
        { min: ["0", "0"] as unknown as ExactLduBoundsDeclaration["min"], max: ["0", "0", "0"] },
        "short",
      ),
    ).toThrow(/must be exactly three decimal strings, one per axis/);
  });

  it("refuses a float64 projection that would shrink the exact solid", () => {
    const exact = parseExactLduBounds(MEASURED_BOUND_FIXTURES["93273"]!, "93273");
    const shrunkMin = { ...exactLduBoundsToNumbers(exact) };
    const shrunk = { min: [shrunkMin.min[0], -16, shrunkMin.min[2]] as const, max: shrunkMin.max };

    expect(() => assertNumericBoundsContainExact(shrunk, exact, "93273 bodyBoundsLdu")).toThrow(
      /min y projects exact -16\.00016098 LDU to the float64 -16, which lies inside the exact bound and shrinks the modelled solid/,
    );

    const shortMax = { min: shrunkMin.min, max: [10, -0.5, 40] as const };
    expect(() => assertNumericBoundsContainExact(shortMax, exact, "93273 bodyBoundsLdu")).toThrow(
      /max y projects exact 0 LDU to the float64 -0\.5, which lies inside the exact bound/,
    );
  });

  it("rejects a non-finite number in an exact comparison", () => {
    const exact = exactLduFromDecimalString("1", "one");

    expect(() => compareNumberToExactLdu(Number.NaN, exact, "probe")).toThrow(
      /must be a finite number to compare against exact 1 LDU; received NaN/,
    );
  });
});
