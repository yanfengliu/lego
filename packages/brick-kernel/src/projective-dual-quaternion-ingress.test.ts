import { describe, expect, it } from "vitest";

import {
  composeProjectiveDualQuaternions,
  extractProjectiveDualQuaternionTranslation,
  invertProjectiveDualQuaternion,
} from "./projective-dual-quaternion.ts";
import {
  DecimalRigidTransformIngressError,
  createExperimentalProjectiveDualQuaternionFromDecimalAffineJson,
  type DecimalRigidTransformIngressErrorCode,
  type ExperimentalDecimalRigidTransformInput,
} from "./projective-dual-quaternion-ingress.ts";

const IDENTITY_MATRIX = ["1", "0", "0", "0", "1", "0", "0", "0", "1"] as const;

function input(
  rotationMatrix: ExperimentalDecimalRigidTransformInput["rotationMatrix"] = IDENTITY_MATRIX,
  positionLdu: ExperimentalDecimalRigidTransformInput["positionLdu"] = ["0", "0", "0"],
): ExperimentalDecimalRigidTransformInput {
  return { rotationMatrix, positionLdu };
}

function convert(value: unknown) {
  return createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(JSON.stringify(value));
}

function expectIngressError(
  action: () => unknown,
  code: DecimalRigidTransformIngressErrorCode,
): void {
  let captured: unknown;
  try {
    action();
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(DecimalRigidTransformIngressError);
  expect(captured).toMatchObject({ code });
  expect((captured as Error).message).toMatch(/.+: .+; .+/);
}

describe("experimental approximate decimal rigid-transform ingress", () => {
  it("converts exact identity and exact ties-to-even LDU positions", () => {
    const transform = convert(input(IDENTITY_MATRIX, ["0.0000005", "0.0000015", "-0.0000005"]));

    expect(transform.real).toEqual([1n, 0n, 0n, 0n]);
    expect(extractProjectiveDualQuaternionTranslation(transform)).toEqual({
      numerator: [0n, 2n, 0n],
      denominator: 1n,
    });
  });

  it.each([
    [IDENTITY_MATRIX, [1n, 0n, 0n, 0n]],
    [
      ["1", "0", "0", "0", "-1", "0", "0", "0", "-1"],
      [0n, 1n, 0n, 0n],
    ],
    [
      ["-1", "0", "0", "0", "1", "0", "0", "0", "-1"],
      [0n, 0n, 1n, 0n],
    ],
    [
      ["-1", "0", "0", "0", "-1", "0", "0", "0", "1"],
      [0n, 0n, 0n, 1n],
    ],
  ] as const)("covers each matrix-to-quaternion branch %#", (matrix, expected) => {
    expect(convert(input(matrix)).real).toEqual(expected);
  });

  it("treats a row-major transpose as the inverse rotation", () => {
    const forward = convert(input(["0", "-1", "0", "1", "0", "0", "0", "0", "1"]));
    const transposed = convert(input(["0", "1", "0", "-1", "0", "0", "0", "0", "1"]));

    expect(transposed).toEqual(invertProjectiveDualQuaternion(forward));
    expect(composeProjectiveDualQuaternions(forward, transposed).real).toEqual([1n, 0n, 0n, 0n]);
  });

  it("rejects a quaternion half-quantum instead of making a runtime-sensitive tie choice", () => {
    expectIngressError(
      () =>
        convert(
          input([
            "1",
            "0",
            "0",
            "0",
            "0.9999999999995",
            "-0.000000999999999999875",
            "0",
            "0.000000999999999999875",
            "0.9999999999995",
          ]),
        ),
      "AMBIGUOUS_QUANTIZATION",
    );
  });

  it("projects a bounded printed rotation but makes no authoritative persistence claim", () => {
    const transform = convert(
      input(["-0.707106781", "0", "0.707106781", "0.707106781", "0", "0.707106781", "0", "1", "0"]),
    );

    expect(transform.real.some((component) => component !== 0n)).toBe(true);
    expect(transform.dual).toEqual([0n, 0n, 0n, 0n]);
  });

  it("rejects reflections and exact singular matrices before projection", () => {
    expectIngressError(
      () => convert(input(["-1", "0", "0", "0", "1", "0", "0", "0", "1"])),
      "REFLECTION_MATRIX",
    );
    expectIngressError(
      () => convert(input(["1", "0", "0", "0", "0", "0", "0", "0", "1"])),
      "SINGULAR_MATRIX",
    );
  });

  it("rejects shear, nonuniform scale, and excessive projection movement", () => {
    expectIngressError(
      () => convert(input(["1", "0.0001", "0", "0", "1", "0", "0", "0", "1"])),
      "NON_RIGID_MATRIX",
    );
    expectIngressError(
      () => convert(input(["1.0001", "0", "0", "0", "1", "0", "0", "0", "0.9999"])),
      "NON_RIGID_MATRIX",
    );
    expectIngressError(
      () => convert(input(["1.0021", "0", "0", "0", "1", "0", "0", "0", "1"])),
      "PROJECTION_SHIFT_EXCEEDED",
    );
  });

  it.each(["NaN", "Infinity", "0x1", "01", " 1", "1 ", "1_0"])(
    "rejects hostile decimal syntax %s",
    (value) => {
      const matrix: string[] = [...IDENTITY_MATRIX];
      matrix[0] = value;
      expectIngressError(
        () =>
          convert(
            input(matrix as unknown as ExperimentalDecimalRigidTransformInput["rotationMatrix"]),
          ),
        "MALFORMED_DECIMAL",
      );
    },
  );

  it("bounds decimal characters, mantissa, exponent, magnitude, and exact position", () => {
    for (const value of ["1".repeat(97), "1".repeat(33), "1e65"]) {
      const matrix: string[] = [...IDENTITY_MATRIX];
      matrix[0] = value;
      expectIngressError(
        () =>
          convert(
            input(matrix as unknown as ExperimentalDecimalRigidTransformInput["rotationMatrix"]),
          ),
        "DECIMAL_LIMIT_EXCEEDED",
      );
    }
    expectIngressError(
      () => convert(input(["3", "0", "0", "0", "1", "0", "0", "0", "1"])),
      "DECIMAL_LIMIT_EXCEEDED",
    );
    expectIngressError(
      () => convert(input(IDENTITY_MATRIX, ["10000000.0000001", "0", "0"])),
      "DECIMAL_LIMIT_EXCEEDED",
    );
  });

  it("rejects malformed, oversized, multibyte, and proxied public payloads before late reads", () => {
    expectIngressError(
      () =>
        convert({
          rotationMatrix: ["1"],
          positionLdu: ["0", "0", "0"],
        }),
      "MALFORMED_DECIMAL",
    );
    expectIngressError(
      () => createExperimentalProjectiveDualQuaternionFromDecimalAffineJson("{"),
      "MALFORMED_DECIMAL",
    );
    expectIngressError(
      () => createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(" ".repeat(4_097)),
      "DECIMAL_LIMIT_EXCEEDED",
    );
    expectIngressError(
      () => createExperimentalProjectiveDualQuaternionFromDecimalAffineJson("é".repeat(2_049)),
      "DECIMAL_LIMIT_EXCEEDED",
    );
    let proxyReads = 0;
    const proxy = new Proxy(
      {},
      {
        get: () => {
          proxyReads += 1;
          return "{}";
        },
      },
    );
    expectIngressError(
      () =>
        createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(proxy as unknown as string),
      "MALFORMED_DECIMAL",
    );
    expect(proxyReads).toBe(0);
  });
});
