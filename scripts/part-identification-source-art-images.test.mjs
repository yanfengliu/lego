import { describe, expect, it } from "vitest";

import {
  __testOnly,
  containingPdfSourceArtImageOperators,
  enumeratePdfSourceArtImageOperators,
  resolveDecodedPdfSourceArtImage,
} from "./part-identification-source-art-images.mjs";

const {
  assertDecodedImage,
  assertWitnesses,
  embeddedSourceArtDigest,
  enumerateImageOperators,
  projectedBounds,
  selectImageOperator,
} = __testOnly;

const witness = (changes = {}) => ({
  key: "source",
  identity: "p18|q1|x29.480|y498.751",
  pageNumber: 18,
  quantity: 1,
  xPt: 29.4803,
  yPt: 498.75079,
  expectedOperatorIndex: 22,
  componentBoundsPxAtScale8: { left: 236, top: 181, right: 421, bottom: 303 },
  ...changes,
});

const pdfjs = {
  OPS: { save: 1, restore: 2, transform: 3, paintImageXObject: 4 },
  Util: {
    transform: (left, right) => [
      left[0] * right[0] + left[2] * right[1],
      left[1] * right[0] + left[3] * right[1],
      left[0] * right[2] + left[2] * right[3],
      left[1] * right[2] + left[3] * right[3],
      left[0] * right[4] + left[2] * right[5] + left[4],
      left[1] * right[4] + left[3] * right[5] + left[5],
    ],
  },
};

describe("embedded PDF source-art measurement controls", () => {
  it("requires exact canonical identities and unique page/operator pins", () => {
    expect(assertWitnesses([witness()])).toHaveLength(1);
    expect(() => assertWitnesses([witness({ identity: "p18|q1|x29.481|y498.751" })])).toThrow(
      /exact one-based PDF identity/,
    );
    expect(() =>
      assertWitnesses([
        witness(),
        witness({
          key: "other",
          identity: "p18|q1|x30.480|y498.751",
          xPt: 30.4803,
        }),
      ]),
    ).toThrow(/page\/operator pin/);
  });

  it("tracks nested save/restore transforms before selecting by geometry", () => {
    const images = enumerateImageOperators(
      pdfjs,
      {
        fnArray: [1, 3, 1, 3, 4, 2, 4, 2],
        argsArray: [
          [],
          [2, 0, 0, 3, 10, 20],
          [],
          [1, 0, 0, 1, 5, 7],
          ["nested"],
          [],
          ["outer"],
          [],
        ],
      },
      100,
      "nested-control",
    );
    expect(images).toEqual([
      {
        objectId: "nested",
        operatorIndex: 4,
        projectedBoundsPxAtScale8: { left: 160, top: 448, right: 175, bottom: 471 },
        transform: [2, 0, 0, 3, 20, 41],
      },
      {
        objectId: "outer",
        operatorIndex: 6,
        projectedBoundsPxAtScale8: { left: 80, top: 616, right: 95, bottom: 639 },
        transform: [2, 0, 0, 3, 10, 20],
      },
    ]);
    expect(
      selectImageOperator(images, {
        key: "nested-control",
        expectedOperatorIndex: 4,
        componentBoundsPxAtScale8: { left: 162, top: 450, right: 170, bottom: 465 },
      }),
    ).toEqual(images[0]);
  });

  it("refuses ambiguous geometry and a moved operator pin", () => {
    const image = {
      objectId: "a",
      operatorIndex: 4,
      projectedBoundsPxAtScale8: { left: 0, top: 0, right: 20, bottom: 20 },
      transform: [1, 0, 0, 1, 0, 0],
    };
    const target = {
      key: "target",
      expectedOperatorIndex: 4,
      componentBoundsPxAtScale8: { left: 5, top: 5, right: 10, bottom: 10 },
    };
    expect(() => selectImageOperator([image, { ...image, operatorIndex: 5 }], target)).toThrow(
      /selected 2 image paints/,
    );
    expect(() => selectImageOperator([image], { ...target, expectedOperatorIndex: 5 })).toThrow(
      /not pinned control/,
    );
  });

  it("hashes decoded RGB24 art and linear CTM without translation", () => {
    const measured = {
      decodedBytes: 6,
      decodedPixelSha256: `sha256:${"1".repeat(64)}`,
      width: 2,
      height: 1,
      kind: 2,
      transform: [2, 0, 0, 3, 10, 20],
    };
    const digest = embeddedSourceArtDigest(measured);
    expect(embeddedSourceArtDigest({ ...measured, transform: [2, 0, 0, 3, 90, 40] })).toBe(digest);
    expect(embeddedSourceArtDigest({ ...measured, transform: [2.01, 0, 0, 3, 10, 20] })).not.toBe(
      digest,
    );
    expect(
      embeddedSourceArtDigest({
        ...measured,
        decodedPixelSha256: `sha256:${"2".repeat(64)}`,
      }),
    ).not.toBe(digest);
    expect(embeddedSourceArtDigest({ ...measured, width: 3 })).not.toBe(digest);
  });

  it("requires exact RGB24 kind and stride", () => {
    expect(
      assertDecodedImage({ width: 2, height: 1, kind: 2, data: new Uint8Array(6) }, "ok"),
    ).toMatchObject({ width: 2, height: 1, kind: 2 });
    expect(() =>
      assertDecodedImage({ width: 2, height: 1, kind: 2, data: new Uint8Array(5) }, "short"),
    ).toThrow(/kind\/stride/);
    expect(() =>
      assertDecodedImage({ width: 2, height: 1, kind: 3, data: new Uint8Array(8) }, "rgba"),
    ).toThrow(/kind\/stride/);
  });

  it("projects only positive axis-aligned transforms", () => {
    expect(projectedBounds([2, 0, 0, 3, 10, 20], 100)).toEqual({
      left: 80,
      top: 616,
      right: 95,
      bottom: 639,
    });
    expect(projectedBounds([2, 0.1, 0, 3, 10, 20], 100)).toBeNull();
  });

  it("exposes bounded containment without choosing an ambiguous candidate", () => {
    const images = enumeratePdfSourceArtImageOperators(
      pdfjs,
      {
        fnArray: [1, 3, 4, 4, 2],
        argsArray: [[], [20, 0, 0, 20, 0, 0], ["a"], ["b"], []],
      },
      100,
      "public-helper",
    );
    expect(
      containingPdfSourceArtImageOperators(images, {
        left: 10,
        top: 650,
        right: 20,
        bottom: 700,
      }),
    ).toHaveLength(2);
  });

  it("resolves and owns exact decoded RGB bytes through the public helper", async () => {
    const source = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const page = {
      commonObjs: { has: () => false, get: () => undefined },
      objs: {
        has: (key) => key === "image",
        get: () => ({ data: source, height: 1, kind: 2, width: 2 }),
      },
    };
    const decoded = await resolveDecodedPdfSourceArtImage(
      page,
      { objectId: "image", operatorIndex: 1 },
      "public-resolve",
    );
    source[0] = 99;
    expect([...decoded.data]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(decoded.decodedPixelSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
