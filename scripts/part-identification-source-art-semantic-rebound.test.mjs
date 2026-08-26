import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";
import {
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS,
  __testOnly as reboundTestOnly,
  bytesFromVerifiedPartIdentificationSourceArtSemanticRebound,
  compilePartIdentificationSourceArtSemanticRebound,
  encodePartIdentificationSourceArtSemanticRebound,
  inspectVerifiedPartIdentificationSourceArtSemanticRebound,
  verifyPartIdentificationSourceArtSemanticRebound,
} from "./part-identification-source-art-semantic-rebound.mjs";
import { exactSourceArtLabelCount } from "./part-identification-source-art-semantic-rebound-scan.mjs";
import {
  PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA,
  digestPdfSourceArtImageContribution,
} from "./part-identification-source-art-semantic-rebound-program.mjs";
import {
  SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
  __testOnly as sourceTestOnly,
  createSourceArtWorkLedger,
} from "./part-identification-source-art-semantic-rebound-source.mjs";

const SEMANTIC_PATH = "output/part-identification/legacy-recut-semantic.json";
const REQUIRED_PATHS = [
  CURRENT_LEGACY_RECUT_PINS.currentManifest.path,
  CURRENT_LEGACY_RECUT_PINS.legacyManifest.path,
  CURRENT_LEGACY_RECUT_PINS.truth.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path,
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path,
  SEMANTIC_PATH,
];
const realIt = REQUIRED_PATHS.every(existsSync) ? it : it.skip;
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function semanticInput() {
  return {
    calloutRoot: "output/callout-thumbnails",
    currentManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.currentManifest.path),
    legacyManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path),
    legacyRecutArtifactBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path),
    officialModelBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path),
    truthBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.truth.path),
  };
}

async function verifiedSemantic() {
  return verifyPartIdentificationLegacyRecutSemantic({
    ...semanticInput(),
    artifactBytes: readFileSync(SEMANTIC_PATH),
  });
}

function rawReboundInput() {
  return {
    manifestBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.manifest.path),
    officialModelBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.officialModel.path),
    pdfBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path),
  };
}

function proofRow(identity, pageNumber, element = null) {
  const decodedImage = {
    decodedPixelSha256: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    height: 9,
    kind: 2,
    linearTransformMilli: [12_000, 0, 0, 9_000],
    width: 12,
  };
  const normalizedProgram = {
    operations: [
      { operation: "save" },
      { operation: "save" },
      { operation: "clip" },
      {
        operation: "constructPath",
        path: {
          boundsMilliPt: [0, 0, 12_000, 9_000],
          segments: [
            [
              { coordinatesMilliPt: [0, 0], operation: 0 },
              { coordinatesMilliPt: [12_000, 9_000], operation: 1 },
            ],
          ],
        },
      },
      { operation: "save" },
      { matrixMilli: [12_000, 0, 0, 9_000, 0, 0], operation: "transform" },
      { operation: "dependency", terminalImageResource: true },
      { height: 9, operation: "paintImageXObject", width: 12 },
      { operation: "restore" },
      { operation: "restore" },
      { operation: "restore" },
    ],
    schemaVersion: PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA,
  };
  const normalizedProgramSha256 = digestPdfSourceArtImageContribution(normalizedProgram);
  const rgba = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
  return {
    broadClassDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    decodedImage,
    exactClassDigest: reboundTestOnly.exactClassDigest(decodedImage, normalizedProgramSha256),
    normalizedProgram,
    normalizedProgramSha256,
    proof: {
      fullImageSupportRgbaSha256: rgba,
      imageSupportInterferencePixels: 0,
      imageSupportMaskSha256:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      imageSupportPixels: 108,
      isolatedAndFullRenderProof: true,
      isolatedImageSupportRgbaSha256: rgba,
      operationClosureCount: 11,
      outsideImageDifferencePixels: 0,
    },
    row: {
      identity,
      pageNumber,
      quantity: 1,
      stepNumber: pageNumber,
      ...(element === null ? {} : element),
    },
  };
}

function candidate(identity, quantity = 1, stepNumber = 10) {
  return {
    elementId: "E1",
    exactClassDigest: proofRow("digest", 1).exactClassDigest,
    identity,
    officialDesignId: "D1",
    pageNumber: stepNumber,
    quantity,
    stepNumber,
  };
}

describe("first-50 source-art semantic rebound primitives", () => {
  it("binds exact RGB24 pixels, dimensions, kind, and linear CTM", () => {
    const operator = { transform: [12, 0, 0, 9, 100, 200] };
    const base = reboundTestOnly.classImage(
      {
        decodedPixelSha256:
          "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        height: 9,
        kind: 2,
        width: 12,
      },
      operator,
    );
    const baseDigest = reboundTestOnly.broadClassDigest(base);
    for (const mutation of [
      { ...base, decodedPixelSha256: base.decodedPixelSha256.replace("1", "2") },
      { ...base, height: 10 },
      { ...base, kind: 1 },
      { ...base, width: 13 },
      { ...base, linearTransformMilli: [12_001, 0, 0, 9_000] },
    ]) {
      expect(reboundTestOnly.broadClassDigest(mutation)).not.toBe(baseDigest);
    }
    expect(() => reboundTestOnly.linearTransformMilli([12, 0, 0, Number.NaN, 0, 0])).toThrow(
      /finite/u,
    );
  });

  it("measures exact label coordinates and independently captures isolated/full pixels", () => {
    const row = { quantity: 2, xPt: 10, yPt: 20 };
    const item = { str: "2x", transform: [1, 0, 0, 1, 10, 20] };
    expect(exactSourceArtLabelCount({ items: [item] }, row)).toBe(1);
    expect(exactSourceArtLabelCount({ items: [{ ...item, str: "1x" }] }, row)).toBe(0);
    expect(
      exactSourceArtLabelCount(
        { items: [item, { ...item, transform: [1, 0, 0, 1, 10.0009, 20] }] },
        row,
      ),
    ).toBe(2);

    const full = Buffer.from([255, 0, 0, 255, 1, 2, 3, 255]);
    const isolated = Buffer.from([255, 0, 0, 255, 0x89, 0x90, 0x93, 0xff]);
    const control = Buffer.from([255, 0, 0, 255, 0x10, 0x20, 0x30, 0xff]);
    const proof = sourceTestOnly.imageOnlyProof(full, isolated, control, "synthetic");
    expect(proof).toMatchObject({
      imageSupportInterferencePixels: 0,
      imageSupportPixels: 1,
      isolatedAndFullRenderProof: true,
      outsideImageDifferencePixels: 1,
    });
    const interfered = Buffer.from(full);
    interfered[0] = 0;
    expect(sourceTestOnly.imageOnlyProof(interfered, isolated, control, "synthetic")).toMatchObject(
      { imageSupportInterferencePixels: 1 },
    );
  });

  it("refuses conflicting anchors and atomically rejects whole official-capacity groups", () => {
    const anchor = proofRow("anchor", 1);
    const member = proofRow("member", 10);
    const semantic = new Map([
      [
        "anchor",
        {
          elementId: "E1",
          identity: "anchor",
          officialDesignId: "D1",
          pageNumber: 1,
          quantity: 1,
          stepNumber: 1,
        },
      ],
    ]);
    expect(reboundTestOnly.classifyExactClasses([member, anchor], semantic).candidates).toEqual([
      candidate("member"),
    ]);
    const conflict = new Map(semantic);
    conflict.set("member", {
      elementId: "E2",
      identity: "member",
      officialDesignId: "D2",
      pageNumber: 10,
      quantity: 1,
      stepNumber: 10,
    });
    expect(() => reboundTestOnly.classifyExactClasses([anchor, member], conflict)).toThrow(
      /conflicting anchors/u,
    );

    const candidates = [candidate("a"), candidate("b")];
    const insufficient = new Map([["10\0E1", { designId: "D1", quantity: 1 }]]);
    const refusal = reboundTestOnly.applyOfficialCapacity(candidates, [], insufficient);
    expect(refusal.accepted).toEqual([]);
    expect(refusal.refused.map(({ identity }) => identity)).toEqual(["a", "b"]);
    expect(
      refusal.refused.every(({ candidateGroupQuantity }) => candidateGroupQuantity === 2),
    ).toBe(true);
    expect(
      reboundTestOnly.applyOfficialCapacity([...candidates].reverse(), [], insufficient),
    ).toEqual(refusal);
    const wrongDesign = new Map([["10\0E1", { designId: "D2", quantity: 2 }]]);
    expect(
      reboundTestOnly.applyOfficialCapacity(candidates, [], wrongDesign).refused[0].refusalReason,
    ).toBe("official-step-element-design-conflict");
  });

  it("uses source-closure equivalence with per-member raster integrity", () => {
    const anchor = proofRow("anchor", 1);
    const semantic = new Map([
      ["anchor", { ...anchor.row, elementId: "E1", officialDesignId: "D1" }],
    ]);
    const closureOrderMutation = proofRow("closure-order-mutation", 2);
    [
      closureOrderMutation.normalizedProgram.operations[1],
      closureOrderMutation.normalizedProgram.operations[6],
    ] = [
      closureOrderMutation.normalizedProgram.operations[6],
      closureOrderMutation.normalizedProgram.operations[1],
    ];
    closureOrderMutation.normalizedProgramSha256 = digestPdfSourceArtImageContribution(
      closureOrderMutation.normalizedProgram,
    );
    closureOrderMutation.exactClassDigest = reboundTestOnly.exactClassDigest(
      closureOrderMutation.decodedImage,
      closureOrderMutation.normalizedProgramSha256,
    );
    expect(
      reboundTestOnly.classifyExactClasses([anchor, closureOrderMutation], semantic).candidates,
    ).toEqual([]);

    const interfered = proofRow("interfered", 2);
    interfered.proof.fullImageSupportRgbaSha256 =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    interfered.proof.imageSupportInterferencePixels = 1;
    expect(reboundTestOnly.classifyExactClasses([anchor, interfered], semantic).candidates).toEqual(
      [],
    );

    const inconsistentRgba = proofRow("inconsistent-rgba", 2);
    inconsistentRgba.proof.fullImageSupportRgbaSha256 =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(
      reboundTestOnly.classifyExactClasses([anchor, inconsistentRgba], semantic).candidates,
    ).toEqual([]);

    const rasterPhaseVariation = proofRow("raster-phase-variation", 2);
    rasterPhaseVariation.proof.imageSupportMaskSha256 =
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    rasterPhaseVariation.proof.fullImageSupportRgbaSha256 =
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    rasterPhaseVariation.proof.isolatedImageSupportRgbaSha256 =
      rasterPhaseVariation.proof.fullImageSupportRgbaSha256;
    expect(
      reboundTestOnly.classifyExactClasses([anchor, rasterPhaseVariation], semantic).candidates,
    ).toEqual([candidate("raster-phase-variation", 1, 2)]);
  });

  it("enforces cumulative decoded and component work ceilings", () => {
    const decoded = createSourceArtWorkLedger();
    decoded.chargeDecoded(
      SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
      1,
      SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
      "exact cap",
    );
    expect(() => decoded.chargeDecoded(1, 1, 3, "over cap")).toThrow(/fixed aggregate/u);
    const components = createSourceArtWorkLedger();
    for (let index = 0; index < 16; index += 1) {
      components.chargeComponent(1_024, 1_024, `component ${index}`);
    }
    expect(components.inspection().componentPixels).toBe(
      SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
    );
    expect(() => components.chargeComponent(1, 1, "over cap")).toThrow(/aggregate limits/u);
  });
});

describe("first-50 source-art semantic rebound raw closure", () => {
  it("rejects proxies and semantic-handle lookalikes before source work", async () => {
    await expect(
      compilePartIdentificationSourceArtSemanticRebound(new Proxy({}, {})),
    ).rejects.toThrow(/may not be a Proxy/u);
    await expect(
      compilePartIdentificationSourceArtSemanticRebound({
        manifestBytes: Buffer.from([1]),
        officialModelBytes: Buffer.from([1]),
        pdfBytes: Buffer.from([1]),
        semantic: {},
      }),
    ).rejects.toThrow(/opaque result/u);
  });

  realIt(
    "reproduces the pinned exact-class rosters and authority absence",
    async () => {
      const semantic = await verifiedSemantic();
      const mutable = rawReboundInput();
      const compiling = compilePartIdentificationSourceArtSemanticRebound({
        ...mutable,
        semantic,
      });
      mutable.manifestBytes[0] ^= 1;
      mutable.officialModelBytes[0] ^= 1;
      mutable.pdfBytes[0] ^= 1;
      const value = await compiling;
      const artifactBytes = encodePartIdentificationSourceArtSemanticRebound(value);
      expect(artifactBytes.length).toBe(
        CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.expectedArtifact.bytes,
      );
      expect(digest(artifactBytes)).toBe(
        CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.expectedArtifact.digest,
      );

      const verifierArtifact = Buffer.from(artifactBytes);
      const verifying = verifyPartIdentificationSourceArtSemanticRebound({
        ...rawReboundInput(),
        artifactBytes: verifierArtifact,
        semantic,
      });
      verifierArtifact[0] ^= 1;
      const verified = await verifying;
      const inspection = inspectVerifiedPartIdentificationSourceArtSemanticRebound(verified);
      expect(inspection.digest).toBe(
        "sha256:4be7bd77d386a7a656019affe9c995e77135080a7aa90df19e43a6f2167ab721",
      );
      expect(inspection.artifact.accounting).toEqual(
        CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.expectedAccounting,
      );
      expect(inspection.artifact.commitments).toEqual(
        CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.expectedCommitments,
      );
      expect(inspection.artifact).toMatchObject({
        schemaVersion: "lego.part-identification-source-art-semantic-rebound/2",
        proofProtocol: {
          crossMemberRasterMaskOrRgbaEqualityRequired: false,
          crossMemberSemanticEquivalence:
            "exact-decoded-rgb24-digest-dimensions-kind-plus-milli-quantized-alpha-renamed-normalized-ordered-source-closure",
          numericNormalization:
            "transform-and-path-coordinate-operands-use-nearest-milli-unit-including-linear-ctm;path-opcodes-and-image-dimensions-remain-exact-integers",
          pageTranslationRasterPhaseMayDiffer: true,
          perMemberRasterEligibility:
            "nonempty-support-mask-with-internal-isolated-full-rgba-equality-and-zero-on-support-interference",
          resourceNormalization:
            "dependency-and-terminal-resource-must-match-exactly-before-alpha-renaming-to-terminal-image-resource",
        },
      });
      const proofByIdentity = new Map(
        inspection.artifact.rosters.exactClassProofs.map((row) => [row.identity, row]),
      );
      const classByDigest = new Map(
        inspection.artifact.exactClasses.map((row) => [row.exactClassDigest, row]),
      );
      const rasterPhaseRelations = inspection.artifact.rosters.candidateSourceArt.map((row) => {
        const member = proofByIdentity.get(row.identity);
        const anchors = classByDigest
          .get(row.exactClassDigest)
          .anchorIdentities.map((identity) => proofByIdentity.get(identity));
        return {
          maskDiffers: anchors.every(
            (anchor) => anchor.imageSupportMaskSha256 !== member.imageSupportMaskSha256,
          ),
          rgbaDiffers: anchors.every(
            (anchor) => anchor.fullImageSupportRgbaSha256 !== member.fullImageSupportRgbaSha256,
          ),
        };
      });
      expect(rasterPhaseRelations).toHaveLength(16);
      expect(rasterPhaseRelations.every(({ rgbaDiffers }) => rgbaDiffers)).toBe(true);
      expect(rasterPhaseRelations.filter(({ maskDiffers }) => maskDiffers)).toHaveLength(14);
      expect(inspection.artifact.rosters.refusedSourceArt).toEqual([]);
      expect(inspection.artifact.rosters.safeIdentity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            elementId: "4283046",
            evidenceMethod: "exact-source-art-semantic-rebound",
            identity: "p13|q1|x44.551|y434.390",
            officialDesignId: "54383",
            stepNumber: 7,
          }),
          expect.objectContaining({
            elementId: "6403899",
            evidenceMethod: "exact-source-art-semantic-rebound",
            identity: "p53|q2|x45.157|y454.591",
            quantity: 2,
            stepNumber: 50,
          }),
        ]),
      );
      expect(inspection.artifact.rosters.residual).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ identity: "p11|q1|x90.511|y212.112" }),
          expect.objectContaining({ identity: "p20|q1|x36.320|y430.691" }),
          expect.objectContaining({ identity: "p43|q3|x477.787|y491.335" }),
        ]),
      );
      expect(inspection.artifact.authority).toEqual({
        kind: "local-diagnostic",
        authenticated: false,
        answerArtifactsConsumed: false,
        sourceExecution: false,
        preparedRun: false,
        physicalFrame: false,
        semanticIdentity: true,
        coverageTrust: false,
        coveragePublication: false,
        catalogAdmission: false,
        assignmentAuthority: false,
        documentMutation: false,
        placement: false,
        acceptedDocument: false,
        completion: false,
      });
      expect(inspection.artifact.sourceIndex).toMatchObject({
        calloutRows: 881,
        expectedPrintedSteps: 359,
        partArtRows: 859,
        suffixStepsReconstructed: false,
      });
      expect(inspection.artifact.work).toMatchObject({
        componentPixels: 9_875_324,
        decodedBytes: 2_769_897,
        decodedPixels: 923_299,
        pdfFetchRenderDisposeDestroyCycles: 1,
      });
      reboundTestOnly.assertAuthorityAndRowKeys(inspection.artifact);
      const authorityMutation = structuredClone(inspection.artifact);
      authorityMutation.authority.placement = true;
      expect(() => reboundTestOnly.assertAuthorityAndRowKeys(authorityMutation)).toThrow(
        /closed object/u,
      );
      const rowMutation = structuredClone(inspection.artifact);
      rowMutation.rosters.safeIdentity[0].placement = {};
      expect(() => reboundTestOnly.assertAuthorityAndRowKeys(rowMutation)).toThrow(/placement/u);
      expect(bytesFromVerifiedPartIdentificationSourceArtSemanticRebound(verified)).toEqual(
        artifactBytes,
      );
      expect(() => inspectVerifiedPartIdentificationSourceArtSemanticRebound(value)).toThrow(
        /opaque result/u,
      );
    },
    120_000,
  );
});
