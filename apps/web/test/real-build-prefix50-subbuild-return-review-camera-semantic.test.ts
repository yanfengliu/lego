import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  SEMANTIC_COLOR_MASK_OTHER_HEX,
  SEMANTIC_COLOR_MASK_TARGET_HEX,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";
import type { Page } from "playwright";

import { REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH } from "../e2e/real-build-prefix50-step44-camera-only-gate-contract.ts";
import { renderRealBuildPrefix50Step44SemanticColorMaskInApp } from "../e2e/real-build-prefix50-subbuild-return-review-camera-app.ts";
import { exactParent } from "../e2e/real-build-prefix50-subbuild-return-review-camera.ts";
import {
  deriveRealBuildPrefix50Step44SemanticColorPolicy,
  requireRealBuildPrefix50Step44SemanticColorPolicy,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_PART_IDS,
  type RealBuildPrefix50Step44SemanticColorRenderEvidence,
  type RealBuildPrefix50Step44SemanticColorPolicy,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import semanticColorPolicyFixture from "./fixtures/real-build-prefix50-step44-semantic-color-policy.json";

const hasPinnedBatch = existsSync(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH);

function currentParent() {
  const batch = JSON.parse(
    readFileSync(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH, "utf8"),
  );
  return exactParent({
    reviewReplayBaseDocument: batch.reviewReplayBaseDocument,
    childPartIds: batch.enumerationReceipt.childPartIds,
    sourceDocumentHash: batch.sourceDocumentHash,
  }).parentDocument;
}

const parameters: OrthographicViewParameters = {
  azimuthDegrees: 35,
  elevationDegrees: 25,
  pixelsPerUnit: 12,
  centerXPx: 360,
  centerYPx: 235,
  upSign: 1,
};
const frame: OrthographicViewFrame = {
  widthPx: 720,
  heightPx: 470,
  target: [0, 0, 0],
  sceneRadius: 20,
};
const matrix = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function semanticPngDataUrl(): string {
  const rgba = new Uint8Array(720 * 470 * 4);
  for (let index = 0; index < 720 * 470; index += 1) {
    const offset = index * 4;
    const hex = index < 11_000 ? SEMANTIC_COLOR_MASK_TARGET_HEX : SEMANTIC_COLOR_MASK_OTHER_HEX;
    rgba[offset] = (hex >> 16) & 0xff;
    rgba[offset + 1] = (hex >> 8) & 0xff;
    rgba[offset + 2] = hex & 0xff;
    rgba[offset + 3] = 0xff;
  }
  const bytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: 720, height: 470, rgba });
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("Step-44 committed semantic policy fixture", () => {
  it("reproduces the exact policy without depending on ignored output", () => {
    const policy = requireRealBuildPrefix50Step44SemanticColorPolicy(
      semanticColorPolicyFixture as unknown as RealBuildPrefix50Step44SemanticColorPolicy,
    );
    expect(policy.commitment).toBe(REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT);
    expect(policy.classificationCommitment).toBe(
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
    );
    expect(policy.classification.targetPartIds).toHaveLength(11);
    expect(policy.classification.otherPartIds).toHaveLength(246);
    expect(policy.grayNegativeControls.partIds).toHaveLength(49);
  });
});

describe.runIf(hasPinnedBatch)("Step-44 exact semantic parent-color policy", () => {
  it("freezes the exact 11 blue targets and 49 gray negative controls", () => {
    const parent = currentParent();
    const policy = deriveRealBuildPrefix50Step44SemanticColorPolicy(parent);

    expect(policy).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step44-semantic-color-policy/1",
      authority: "none",
      parentPartCount: 257,
      parentDocumentHash: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH,
      parentDocumentCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT,
      targetColorIds: ["builtin:blue", "builtin:dark-blue"],
      absentTargetColorIds: ["builtin:dark-azure", "builtin:medium-azure"],
      targetHex: SEMANTIC_COLOR_MASK_TARGET_HEX,
      otherHex: SEMANTIC_COLOR_MASK_OTHER_HEX,
    });
    expect(policy.classification.targetPartIds).toEqual(
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_PART_IDS,
    );
    expect(policy.classification.targetPartIds).toHaveLength(11);
    expect(policy.classification.otherPartIds).toHaveLength(246);
    expect(policy.grayNegativeControls.colorIds).toEqual(
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS,
    );
    expect(policy.grayNegativeControls.partIds).toHaveLength(49);
    expect(
      policy.grayNegativeControls.partIds.every((id) =>
        policy.classification.otherPartIds.includes(id),
      ),
    ).toBe(true);
    expect(policy.classificationCommitment).toBe(canonicalDigest(policy.classification));
    expect(policy.classificationCommitment).toBe(
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT,
    );
    expect(policy.commitment).toBe(REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT);
    expect(policy.commitment).toBe(
      canonicalDigest(
        Object.fromEntries(Object.entries(policy).filter(([key]) => key !== "commitment")),
      ),
    );
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.classification.targetPartIds)).toBe(true);
  });

  it("rejects a different document even when it retains 257 parts", () => {
    const parent = structuredClone(currentParent());
    (parent.parts[0]! as { colorId: string }).colorId = "builtin:blue";
    expect(() => deriveRealBuildPrefix50Step44SemanticColorPolicy(parent)).toThrow(
      /exact hard-valid 257-part shared Step-43 parent/u,
    );
  });

  it("captures a policy-bound real-app semantic mask and rejects classification drift", async () => {
    const policy = deriveRealBuildPrefix50Step44SemanticColorPolicy(currentParent());
    const pngDataUrl = semanticPngDataUrl();
    const evaluate = vi.fn(async (_callback: unknown, request: Record<string, unknown>) => ({
      scene: "model-only" as const,
      renderMode: "semantic-color-id-mask" as const,
      semanticColorMask: policy.classification,
      backgroundHex: request.backgroundHex,
      width: 720,
      height: 470,
      pngDataUrl,
      parameters: request.parameters,
      frame: request.frame,
      projectionMatrix: matrix,
      matrixWorldInverse: matrix,
    }));
    const page = { evaluate } as unknown as Page;
    const evidence: RealBuildPrefix50Step44SemanticColorRenderEvidence =
      await renderRealBuildPrefix50Step44SemanticColorMaskInApp(page, parameters, frame, policy);

    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate.mock.calls[0]![1]).toMatchObject({
      scene: "model-only",
      renderMode: "semantic-color-id-mask",
      targetColorIds: ["builtin:blue", "builtin:dark-blue"],
    });
    expect(evidence.policyCommitment).toBe(policy.commitment);
    expect(evidence.classification).toEqual(policy.classification);
    expect(evidence.classificationCommitment).toBe(policy.classificationCommitment);
    expect(evidence.projectionMatrix).toEqual(matrix);
    expect(evidence.matrixWorldInverse).toEqual(matrix);
    expect(evidence.pngDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(evidence.pixelDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);

    evaluate.mockResolvedValueOnce({
      scene: "model-only",
      renderMode: "semantic-color-id-mask",
      semanticColorMask: {
        ...policy.classification,
        targetPartIds: policy.classification.targetPartIds.slice(1),
      },
      backgroundHex: 0x899093,
      width: 720,
      height: 470,
      pngDataUrl,
      parameters,
      frame,
      projectionMatrix: matrix,
      matrixWorldInverse: matrix,
    });
    await expect(
      renderRealBuildPrefix50Step44SemanticColorMaskInApp(page, parameters, frame, policy),
    ).rejects.toThrow(/misclassified Step-44 semantic color evidence/u);
  });
});
