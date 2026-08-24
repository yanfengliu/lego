import type { SourceArtBindingRow } from "../../../scripts/part-identification-source-art-binding.mjs";
import type { CalloutTarget } from "./callout-types";

const PAGE_18_BOX = {
  minXPt: Number("14.673049926757812"),
  maxXPt: 166.74395751953125,
  minYPt: 459.14593505859375,
  maxYPt: 529.5791015625,
};
const PAGE_20_BOX = {
  minXPt: 14.673139572143555,
  maxXPt: Number("166.74392700195312"),
  minYPt: 419.5710144042969,
  maxYPt: 529.5792236328125,
};

function target(
  pageNumber: number,
  stepNumber: number,
  identity: string,
  xPt: number,
  yPt: number,
  box: typeof PAGE_18_BOX,
): CalloutTarget {
  return {
    identity,
    pageNumber,
    stepNumber,
    quantity: 1,
    xPt,
    yPt,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
  };
}

export const PAGE_18_TARGETS = [
  target(18, 14, "p18|q1|x29.480|y468.911", 29.4803, 468.9108, PAGE_18_BOX),
  target(18, 14, "p18|q1|x29.480|y498.751", 29.4803, 498.75079, PAGE_18_BOX),
  target(18, 14, "p18|q1|x84.580|y468.911", 84.5798, 468.9108, PAGE_18_BOX),
] as const;
export const PAGE_20_TARGETS = [
  target(20, 16, "p20|q1|x124.274|y430.691", 124.274, 430.6908, PAGE_20_BOX),
  target(20, 16, "p20|q1|x36.320|y430.691", 36.32, 430.6908, PAGE_20_BOX),
  target(20, 16, "p20|q1|x36.320|y477.691", 36.32, 477.69089, PAGE_20_BOX),
  target(20, 16, "p20|q1|x82.697|y430.691", 82.697, 430.6908, PAGE_20_BOX),
  target(20, 16, "p20|q1|x82.697|y477.691", 82.697, 477.69089, PAGE_20_BOX),
] as const;

export const SOURCE_IDENTITY = "p18|q1|x29.480|y498.751";
export const TARGET_3023_IDENTITY = "p20|q1|x36.320|y477.691";
export const TARGET_35480_IDENTITY = "p20|q1|x124.274|y430.691";

export const SOURCE_ART_ROWS = [
  {
    key: "3023-source",
    identity: SOURCE_IDENTITY,
    pageNumber: 18,
    stepNumber: 14,
    quantity: 1,
    xPt: 29.4803,
    yPt: 498.75079,
    heightPt: 8,
    expectedOperatorIndex: 22,
    expectedCropSha256: "sha256:a400f346b48bc7905df1ecac9bdc90d9aa4dbfe86839ea1acb7053c745d60090",
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 236, top: 181, right: 421, bottom: 303 },
      foregroundPixels: 13_592,
      rawComponentCount: 1,
      absoluteForegroundSha256:
        "sha256:a45e976b90c70071eabb9aa322eb52d8051406be8f3d7c5e3f2285191c160fb2",
    },
  },
  {
    key: "3023-target",
    identity: TARGET_3023_IDENTITY,
    pageNumber: 20,
    stepNumber: 16,
    quantity: 1,
    xPt: 36.32,
    yPt: 477.69089,
    heightPt: 8,
    expectedOperatorIndex: 22,
    expectedCropSha256: "sha256:b873b5125f50292da5ff8078b04b9873d21dba3bc0957b534838ec6ecb399a01",
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 290, top: 350, right: 476, bottom: 466 },
      foregroundPixels: 13_648,
      rawComponentCount: 1,
      absoluteForegroundSha256:
        "sha256:d24217d593579b507737a84f519b1a04121a252e532f7c77f576c108052dd655",
    },
  },
  {
    key: "35480-target",
    identity: TARGET_35480_IDENTITY,
    pageNumber: 20,
    stepNumber: 16,
    quantity: 1,
    xPt: 124.274,
    yPt: 430.6908,
    heightPt: 8,
    expectedOperatorIndex: 86,
    expectedCropSha256: "sha256:771c2fa0e72e28fadde82562630a6f837d719e4b244ab99004f58aee6fddf826",
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 995, top: 737, right: 1149, bottom: 844 },
      foregroundPixels: 11_866,
      rawComponentCount: 1,
      absoluteForegroundSha256:
        "sha256:b8831d0e1a3e7b0a580e1d881bc9a5686d84d20765bf52f5be1e93602932e878",
    },
  },
] as const satisfies readonly SourceArtBindingRow[];

export const IMAGE_WITNESSES = SOURCE_ART_ROWS.map(
  ({ key, identity, pageNumber, quantity, xPt, yPt, expectedOperatorIndex, sourceComponent }) => ({
    key,
    identity,
    pageNumber,
    quantity,
    xPt,
    yPt,
    expectedOperatorIndex,
    componentBoundsPxAtScale8: sourceComponent.boundsPx,
  }),
);
