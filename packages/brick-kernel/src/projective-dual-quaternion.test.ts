import { describe, expect, it } from "vitest";

import {
  PROJECTIVE_DUAL_QUATERNION_LIMITS,
  PROJECTIVE_DUAL_QUATERNION_VERSION,
  ProjectiveDualQuaternionError,
  canonicalizeProjectiveDualQuaternion,
  composeProjectiveDualQuaternionChain,
  composeProjectiveDualQuaternions,
  createProjectiveDualQuaternion,
  extractProjectiveDualQuaternionTranslation,
  invertProjectiveDualQuaternion,
  type BigIntQuaternion,
  type BigIntVector3,
  type ProjectiveDualQuaternion,
  type ProjectiveDualQuaternionErrorCode,
} from "./projective-dual-quaternion.ts";
import {
  decodeProjectiveDualQuaternionJson,
  encodeProjectiveDualQuaternionJson,
  projectiveDualQuaternionToApproximateTransform,
  projectiveDualQuaternionToWire,
} from "./projective-dual-quaternion-codec.ts";
import { createExperimentalProjectiveDualQuaternionFromDecimalAffineJson } from "./projective-dual-quaternion-ingress.ts";
import {
  composeProjectiveMatrices,
  dualQuaternionToProjectiveMatrix,
} from "./projective-dual-quaternion.test-oracle.ts";

function canonical(real: BigIntQuaternion, dual: BigIntQuaternion): ProjectiveDualQuaternion {
  return canonicalizeProjectiveDualQuaternion(...real, ...dual);
}

function createTransform(
  rotation: BigIntQuaternion,
  position: BigIntVector3,
): ProjectiveDualQuaternion {
  return createProjectiveDualQuaternion(...rotation, ...position);
}

function decodeWire(value: unknown): ProjectiveDualQuaternion {
  return decodeProjectiveDualQuaternionJson(JSON.stringify(value));
}

const C = canonical(
  [307_960n, 127_561n, 0n, 0n],
  [-1_291_555_125_000n, 3_118_095_000_000n, 1_347_967_875_000n, 6_792_901_562_500n],
);
const F = canonical([1n, 0n, 1n, 0n], [3_500_000n, -8_000_000n, -3_500_000n, 21_000_000n]);
const EXPECTED_F_INVERSE = Object.freeze({
  real: [1n, 0n, -1n, 0n],
  dual: [3_500_000n, 8_000_000n, 3_500_000n, -21_000_000n],
});
const EXPECTED_C_F = Object.freeze({
  real: [307_960n, 127_561n, 307_960n, 127_561n],
  dual: [-541_175_000_000n, -5_692_023_062_500n, -3_700_228_250_000n, 15_931_693_062_500n],
});
const GOLDEN_F_JSON =
  '{"schemaVersion":"lego.experimental-projective-dual-quaternion/1","real":["1","0","1","0"],"dual":["3500000","-8000000","-3500000","21000000"]}';
const GOLDEN_F_INVERSE_JSON =
  '{"schemaVersion":"lego.experimental-projective-dual-quaternion/1","real":["1","0","-1","0"],"dual":["3500000","8000000","3500000","-21000000"]}';

function captureProjectiveError(action: () => unknown): ProjectiveDualQuaternionError {
  try {
    action();
  } catch (error) {
    if (error instanceof ProjectiveDualQuaternionError) return error;
    throw error;
  }
  throw new Error("expected ProjectiveDualQuaternionError");
}

function expectProjectiveError(
  action: () => unknown,
  code: ProjectiveDualQuaternionErrorCode,
): void {
  const error = captureProjectiveError(action);
  expect(error.code).toBe(code);
  expect(error.message).toMatch(/.+: .+; .+/);
}

function transformKey(transform: ProjectiveDualQuaternion): string {
  return [...transform.real, ...transform.dual].join(",");
}

function fixedPointRound(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  let quotient = magnitude / denominator;
  const doubledRemainder = 2n * (magnitude % denominator);
  if (
    doubledRemainder > denominator ||
    (doubledRemainder === denominator && quotient % 2n !== 0n)
  ) {
    quotient += 1n;
  }
  return sign * quotient;
}

function composeRoundedMatrix(left: readonly bigint[], right: readonly bigint[]): bigint[] {
  const scale = 1_000_000_000n;
  const result: bigint[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let value = 0n;
      for (let axis = 0; axis < 3; axis += 1) {
        value += left[row * 3 + axis]! * right[axis * 3 + column]!;
      }
      result.push(fixedPointRound(value, scale));
    }
  }
  return result;
}

describe("projective integer dual-quaternion algebra", () => {
  it("matches the supplied composition and inverse regression vectors exactly", () => {
    const inverse = invertProjectiveDualQuaternion(F);
    const composed = composeProjectiveDualQuaternions(C, F);

    expect(inverse).toEqual(EXPECTED_F_INVERSE);
    expect(composed).toEqual(EXPECTED_C_F);
    expect(composeProjectiveDualQuaternions(composed, inverse)).toEqual(C);
    expect(composeProjectiveDualQuaternions(inverse, F)).toEqual(
      createTransform([1n, 0n, 0n, 0n], [0n, 0n, 0n]),
    );
  });

  it("extracts exact rational translation and converts to finite rendering numbers", () => {
    expect(extractProjectiveDualQuaternionTranslation(F)).toEqual({
      numerator: [13_000_000n, -7_000_000n, 29_000_000n],
      denominator: 1n,
    });
    const approximate = projectiveDualQuaternionToApproximateTransform(F);
    expect(approximate.positionMicroLdu).toEqual([13_000_000, -7_000_000, 29_000_000]);
    expect(approximate.rotationMatrix[2]).toBeCloseTo(1, 12);
    expect(approximate.rotationMatrix[4]).toBeCloseTo(1, 12);
    expect(approximate.rotationMatrix[6]).toBeCloseTo(-1, 12);
    for (const index of [0, 1, 3, 5, 7, 8]) {
      expect(approximate.rotationMatrix[index]).toBe(0);
    }
    expect(approximate.rotationMatrix.every(Number.isFinite)).toBe(true);
  });

  it("reduces a common gcd and canonicalizes the projective sign", () => {
    expect(canonical([-2n, 0n, 0n, 0n], [0n, -4n, 0n, 0n])).toEqual({
      real: [1n, 0n, 0n, 0n],
      dual: [0n, 2n, 0n, 0n],
    });
  });

  it("enforces Study, position, component, intermediate, and actual chain limits", () => {
    expectProjectiveError(
      () => canonical([1n, 0n, 0n, 0n], [1n, 0n, 0n, 0n]),
      "STUDY_CONDITION_FAILED",
    );
    expectProjectiveError(
      () =>
        createTransform(
          [1n, 0n, 0n, 0n],
          [PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu + 1n, 0n, 0n],
        ),
      "POSITION_LIMIT_EXCEEDED",
    );
    expectProjectiveError(
      () => canonical([1n << 3200n, 1n, 0n, 0n], [0n, 0n, 0n, 0n]),
      "TRANSFORM_COMPLEXITY_EXCEEDED",
    );
    const identity = createTransform([1n, 0n, 0n, 0n], [0n, 0n, 0n]);
    expectProjectiveError(
      () => composeProjectiveDualQuaternionChain(...Array(33).fill(identity)),
      "COMPOSITION_CHAIN_LIMIT_EXCEEDED",
    );
    expect(() => composeProjectiveDualQuaternionChain(...Array(32).fill(identity))).not.toThrow();
    expect(() =>
      createTransform(
        [1n, 0n, 0n, 0n],
        [PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu, 0n, 0n],
      ),
    ).not.toThrow();
    const huge = createTransform([1n << 1023n, 1n, 0n, 0n], [0n, 0n, 0n]);
    expectProjectiveError(
      () => composeProjectiveDualQuaternions(huge, huge),
      "COMPONENT_LIMIT_EXCEEDED",
    );
  });

  it("keeps the supplied rounded-matrix counterexample out of the canonical algebra", () => {
    const b = [
      -707_106_781n,
      0n,
      707_106_781n,
      707_106_781n,
      0n,
      707_106_781n,
      0n,
      1_000_000_000n,
      0n,
    ];
    const c = [
      -707_107_281n,
      0n,
      -707_106_281n,
      -707_106_281n,
      0n,
      707_107_281n,
      0n,
      1_000_000_000n,
      0n,
    ];
    const roundedLeft = composeRoundedMatrix(composeRoundedMatrix(b, b), c);
    const roundedRight = composeRoundedMatrix(b, composeRoundedMatrix(b, c));
    expect(roundedLeft).not.toEqual(roundedRight);
    expect(
      Math.max(
        ...roundedLeft.map((value, index) =>
          Number(
            value < roundedRight[index]!
              ? roundedRight[index]! - value
              : value - roundedRight[index]!,
          ),
        ),
      ),
    ).toBe(1);

    const asInput = (matrix: readonly bigint[]) => ({
      rotationMatrix: matrix.map((value) =>
        (Number(value) / 1_000_000_000).toString(),
      ) as unknown as [string, string, string, string, string, string, string, string, string],
      positionLdu: ["0", "0", "0"] as const,
    });
    const exactB = createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(
      JSON.stringify(asInput(b)),
    );
    const exactC = createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(
      JSON.stringify(asInput(c)),
    );
    expect(
      composeProjectiveDualQuaternions(composeProjectiveDualQuaternions(exactB, exactB), exactC),
    ).toEqual(
      composeProjectiveDualQuaternions(exactB, composeProjectiveDualQuaternions(exactB, exactC)),
    );
  });

  it("passes 10,000 seeded triples against associativity, inverses, and a rational matrix oracle", () => {
    let state = 0x6651557;
    const next = (): number => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    };
    const signed = (radius: number): bigint => BigInt((next() % (2 * radius + 1)) - radius);
    const randomTransform = (): {
      transform: ProjectiveDualQuaternion;
      position: BigIntVector3;
    } => {
      let rotation: BigIntQuaternion;
      do {
        rotation = [signed(1_000), signed(1_000), signed(1_000), signed(1_000)];
      } while (rotation.every((component) => component === 0n));
      const position: BigIntVector3 = [signed(1_000_000), signed(1_000_000), signed(1_000_000)];
      return { transform: createTransform(rotation, position), position };
    };
    const identity = createTransform([1n, 0n, 0n, 0n], [0n, 0n, 0n]);

    for (let index = 0; index < 10_000; index += 1) {
      const a = randomTransform();
      const b = randomTransform();
      const c = randomTransform();
      const ab = composeProjectiveDualQuaternions(a.transform, b.transform);
      const left = composeProjectiveDualQuaternions(ab, c.transform);
      const right = composeProjectiveDualQuaternions(
        a.transform,
        composeProjectiveDualQuaternions(b.transform, c.transform),
      );
      if (transformKey(left) !== transformKey(right))
        throw new Error(`seeded associativity failure at triple ${index}`);
      const oracleAb = composeProjectiveMatrices(
        dualQuaternionToProjectiveMatrix(a.transform),
        dualQuaternionToProjectiveMatrix(b.transform),
      );
      if (oracleAb.join(",") !== dualQuaternionToProjectiveMatrix(ab).join(","))
        throw new Error(`rational matrix oracle mismatch at triple ${index}`);
      const inverse = invertProjectiveDualQuaternion(a.transform);
      if (
        transformKey(composeProjectiveDualQuaternions(a.transform, inverse)) !==
          transformKey(identity) ||
        transformKey(composeProjectiveDualQuaternions(inverse, a.transform)) !==
          transformKey(identity)
      )
        throw new Error(`inverse failure at triple ${index}`);
      const extracted = extractProjectiveDualQuaternionTranslation(a.transform);
      if (
        extracted.denominator !== 1n ||
        extracted.numerator.some((value, axis) => value !== a.position[axis])
      )
        throw new Error(`translation failure at triple ${index}`);
    }
  }, 30_000);
});

describe("projective dual-quaternion codec", () => {
  it("round-trips the exact versioned decimal-string wire form", () => {
    const wire = projectiveDualQuaternionToWire(F);
    expect(wire.real).toEqual(["1", "0", "1", "0"]);
    expect(decodeWire(wire)).toEqual(F);
    const json = encodeProjectiveDualQuaternionJson(F);
    expect(json).toBe(GOLDEN_F_JSON);
    expect(encodeProjectiveDualQuaternionJson(invertProjectiveDualQuaternion(F))).toBe(
      GOLDEN_F_INVERSE_JSON,
    );
    expect(decodeProjectiveDualQuaternionJson(json)).toEqual(F);
    const padded = `${" ".repeat(PROJECTIVE_DUAL_QUATERNION_LIMITS.maxWireJsonBytes - json.length)}${json}`;
    expect(new TextEncoder().encode(padded)).toHaveLength(
      PROJECTIVE_DUAL_QUATERNION_LIMITS.maxWireJsonBytes,
    );
    expect(decodeProjectiveDualQuaternionJson(padded)).toEqual(F);
  });

  it.each(["-0", "+1", "01", "1e2", " 1", "1 ", "1.0"])(
    "rejects non-canonical integer component %s",
    (component) => {
      const wire = projectiveDualQuaternionToWire(F);
      expectProjectiveError(
        () => decodeWire({ ...wire, real: [component, "0", "1", "0"] }),
        "NON_CANONICAL_INTEGER",
      );
    },
  );

  it("rejects shape, version, zero, gcd, sign, Study, position, and cap bombs", () => {
    const version = PROJECTIVE_DUAL_QUATERNION_VERSION;
    expectProjectiveError(() => decodeWire([]), "MALFORMED_WIRE");
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["1", "0", "0", "0"],
          dual: ["0", "0", "0", "0"],
          extra: true,
        }),
      "MALFORMED_WIRE",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: "future",
          real: ["1", "0", "0", "0"],
          dual: ["0", "0", "0", "0"],
        }),
      "MALFORMED_WIRE",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["0", "0", "0", "0"],
          dual: ["0", "0", "0", "0"],
        }),
      "ZERO_ROTATION",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["2", "0", "0", "0"],
          dual: ["0", "2", "0", "0"],
        }),
      "NON_PRIMITIVE_TRANSFORM",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["-1", "0", "0", "0"],
          dual: ["0", "0", "0", "0"],
        }),
      "NON_CANONICAL_SIGN",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["1", "0", "0", "0"],
          dual: ["1", "0", "0", "0"],
        }),
      "STUDY_CONDITION_FAILED",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["1", "0", "0", "0"],
          dual: ["0", String(PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu), "0", "0"],
        }),
      "POSITION_LIMIT_EXCEEDED",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: [(1n << 1024n).toString(), "1", "0", "0"],
          dual: ["0", "0", "0", "0"],
        }),
      "COMPONENT_LIMIT_EXCEEDED",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["1", "0", "0", "0"],
          dual: ["0", (1n << 1088n).toString(), "0", "0"],
        }),
      "COMPONENT_LIMIT_EXCEEDED",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: [
            "9".repeat(PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentCharacters + 1),
            "0",
            "0",
            "0",
          ],
          dual: ["0", "0", "0", "0"],
        }),
      "COMPONENT_LIMIT_EXCEEDED",
    );
    expectProjectiveError(
      () =>
        decodeWire({
          schemaVersion: version,
          real: ["1", "0", "0", "0"],
          dual: [
            "0",
            "9".repeat(PROJECTIVE_DUAL_QUATERNION_LIMITS.maxDualComponentCharacters + 1),
            "0",
            "0",
          ],
        }),
      "COMPONENT_LIMIT_EXCEEDED",
    );
    expectProjectiveError(() => decodeProjectiveDualQuaternionJson("{"), "MALFORMED_WIRE");
    expectProjectiveError(
      () =>
        decodeProjectiveDualQuaternionJson(
          " ".repeat(PROJECTIVE_DUAL_QUATERNION_LIMITS.maxWireJsonBytes + 1),
        ),
      "MALFORMED_WIRE",
    );
    expectProjectiveError(
      () => decodeProjectiveDualQuaternionJson("é".repeat(4_097)),
      "MALFORMED_WIRE",
    );
  });

  it("rejects forged, accessor-backed, proxied, and non-string public values without late reads", () => {
    let getterCalls = 0;
    const forged = {
      get real() {
        getterCalls += 1;
        return [1n, 0n, 1n, 0n];
      },
      dual: [3_500_000n, -8_000_000n, -3_500_000n, 21_000_000n],
    } as unknown as ProjectiveDualQuaternion;
    expectProjectiveError(() => encodeProjectiveDualQuaternionJson(forged), "MALFORMED_VALUE");
    expect(getterCalls).toBe(0);

    let proxyReads = 0;
    const proxy = new Proxy(F, {
      get: (target, key, receiver) => {
        proxyReads += 1;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    expectProjectiveError(() => projectiveDualQuaternionToWire(proxy), "MALFORMED_VALUE");
    expect(proxyReads).toBe(0);
    expectProjectiveError(
      () => decodeProjectiveDualQuaternionJson(1 as unknown as string),
      "MALFORMED_WIRE",
    );
  });

  it("accepts the real-component bit cap exactly", () => {
    const negativeBoundary = `-${((1n << 1024n) - 1n).toString()}`;
    expect(negativeBoundary).toHaveLength(
      PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentCharacters,
    );
    const boundary = decodeWire({
      schemaVersion: PROJECTIVE_DUAL_QUATERNION_VERSION,
      real: ["1", negativeBoundary, "0", "0"],
      dual: ["0", "0", "0", "0"],
    });
    expect((-boundary.real[1]).toString(2)).toHaveLength(1024);
    const matrix = projectiveDualQuaternionToApproximateTransform(boundary).rotationMatrix;
    expect(matrix.every(Number.isFinite)).toBe(true);
  });
});
