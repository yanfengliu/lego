import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import {
  resolveRealBuildPanelCameraBranches,
  type RealBuildPanelCameraPrefixInput,
} from "../e2e/real-build-panel-camera-resolver";

export const HASH = `sha256:${"a".repeat(64)}` as Sha256Digest;
export const OTHER_HASH = `sha256:${"b".repeat(64)}` as Sha256Digest;
export const BUILT_MASK = new Uint8Array([1, 1, 0, 0]);
export const WEAKER_MASK = new Uint8Array([1, 0, 0, 0]);

export type TestDocument = {
  parts: { id: string }[];
  metadata: { labels: string[] };
};

export const document = (partCount = 1): TestDocument => ({
  parts: Array.from({ length: partCount }, (_, index) => ({ id: `part-${index}` })),
  metadata: { labels: ["retained"] },
});

export const prefix = (
  overrides: Partial<RealBuildPanelCameraPrefixInput<TestDocument>> = {},
): RealBuildPanelCameraPrefixInput<TestDocument> => ({
  throughStepNumber: 5,
  parentLineageId: "step-004:parent",
  document: document(),
  documentHash: HASH,
  ...overrides,
});

export const observedInput = (
  overrides: Partial<Parameters<typeof resolveRealBuildPanelCameraBranches<TestDocument>>[0]> = {},
) => ({
  prefix: prefix(),
  registrationPanelStepNumber: 6,
  renderModelMask: ({
    hypothesis,
  }: {
    hypothesis: { latticeHand: string; turnDegrees: number };
  }) =>
    hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
      ? BUILT_MASK
      : WEAKER_MASK,
  builtMask: BUILT_MASK,
  excludedMask: null,
  widthPx: 2,
  heightPx: 2,
  ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
  hashDocument: () => HASH,
  ...overrides,
});
