import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import {
  resolveRealBuildPanelCameraFrontier,
  type RealBuildPanelCameraFrontierResolution,
} from "../e2e/real-build-panel-camera-frontier";
import type { RealBuildPanelCameraPrefixInput } from "../e2e/real-build-panel-camera-resolver";

export const HASH_A = `sha256:${"a".repeat(64)}` as Sha256Digest;
export const HASH_B = `sha256:${"b".repeat(64)}` as Sha256Digest;
export const BUILT_MASK = new Uint8Array([1, 1, 0, 0]);
export const WEAKER_MASK = new Uint8Array([1, 0, 0, 0]);

export type FrontierDocument = {
  parts: { id: string }[];
  metadata: { name: "a" | "b"; labels: string[] };
};

export const frontierDocument = (name: "a" | "b"): FrontierDocument => ({
  parts: [{ id: `part-${name}` }],
  metadata: { name, labels: ["retained"] },
});

export const frontierPrefix = (
  parentLineageId: string,
  name: "a" | "b" = "a",
  overrides: Partial<RealBuildPanelCameraPrefixInput<FrontierDocument>> = {},
): RealBuildPanelCameraPrefixInput<FrontierDocument> => ({
  throughStepNumber: 5,
  parentLineageId,
  document: frontierDocument(name),
  documentHash: name === "a" ? HASH_A : HASH_B,
  ...overrides,
});

type FrontierInput = Parameters<typeof resolveRealBuildPanelCameraFrontier<FrontierDocument>>[0];

export const frontierInput = (overrides: Partial<FrontierInput> = {}): FrontierInput => ({
  prefixes: [
    frontierPrefix("root-a-0"),
    frontierPrefix("root-a-1"),
    frontierPrefix("root-b-0", "b"),
  ],
  registrationPanelStepNumber: 6,
  renderModelMask: ({ hypothesis }) =>
    hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
      ? BUILT_MASK
      : WEAKER_MASK,
  builtMask: BUILT_MASK,
  excludedMask: null,
  widthPx: 2,
  heightPx: 2,
  ledger: createRealBuildPanelCameraBranchBudgetLedger(24),
  hashDocument: (document) => (document.metadata.name === "a" ? HASH_A : HASH_B),
  ...overrides,
});

export type FrontierResult = RealBuildPanelCameraFrontierResolution<FrontierDocument>;
