import { deepFreeze } from "@lego-studio/brick-kernel";

/** Human-reviewed page evidence; it narrows source-frame labels and grants no placement authority. */
export const REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step42-43-panel-fixture/1" as const,
  sourceSetId: "6651557" as const,
  sourcePdfDigest:
    "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  physicalPageNumber: 44 as const,
  lookaheadPhysicalPageNumber: 45 as const,
  sourceToPanelFaceQuarterTurn: [1, 0, 0, 0, 0, -1, 0, 1, 0] as const,
  step42: {
    printedStepNumber: 42 as const,
    occurrenceOrdinals: [275, 276] as const,
    reviewedDisposition: "black-tile-1x2-and-plate-1x4-span-repaired-azure-studs" as const,
    callouts: [
      {
        identity: "p44|q1|x23.093|y227.599" as const,
        cropDigest:
          "sha256:e36b9ab01afb0a3b0957c5d5bb4eafa9364ec4f609d2d9d6a22c32210204d1b2" as const,
      },
      {
        identity: "p44|q1|x53.989|y227.599" as const,
        cropDigest:
          "sha256:423a1d955c5941b3bba19f40f6bdbc37c59f21058fe8bc768e3b202c698e19da" as const,
      },
    ],
  },
  step43: {
    printedStepNumber: 43 as const,
    occurrenceOrdinals: [277, 278, 279, 280] as const,
    reviewedDisposition: "white-plate-base-two-inward-high-face-slopes-and-one-top-tile" as const,
    callouts: [
      {
        identity: "p44|q1|x443.424|y491.335" as const,
        cropDigest:
          "sha256:7c11659b8932d0ebff783ca81ff62e5679d1661fc67eaa92eb6adef015fc3ccd" as const,
      },
      {
        identity: "p44|q2|x499.460|y491.335" as const,
        cropDigest:
          "sha256:8767244e717898c11168f2e809e6f152c7ae5ede4cfb60b0cd595952d829884e" as const,
      },
      {
        identity: "p44|q1|x404.189|y491.335" as const,
        cropDigest:
          "sha256:33dec679457449a212fdb3f60ce9196662af4e1c444bf3724fd4dcde9dc2da9c" as const,
      },
    ],
  },
  canonicalOrientationByOrdinal: {
    275: "proper-m-00n0n0n00",
    276: "proper-m-00n0n0n00",
    277: "proper-m-00n0n0n00",
    278: "proper-m-00n0n0n00",
    279: "proper-m-00p0n0p00",
    280: "proper-m-00n0n0n00",
  } as const,
  lookaheadDisposition:
    "step-44-rigid-return-shows-the-complete-step-43-child-with-opposed-slope-high-faces" as const,
  authority: "none" as const,
});

export type RealBuildPrefix50Step42_43PanelFixture =
  typeof REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE;
