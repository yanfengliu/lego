import type { TestInfo } from "@playwright/test";
import {
  canonicalDigest,
  canonicalStringify,
  type BuildPlaybackTraceTransitionV1,
} from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50StateCommitment } from "./real-build-prefix50-exact-compiler-contract";
import type {
  Prefix50Step44ModelOnlyEvidence,
  Prefix50Step44VisualDelta,
} from "./real-build-prefix50-step44-visual-evidence";
import type { PlaybackCommitment } from "./real-build-prefix50-ui-replay-support";

export interface Prefix50Step44CaptureBinding {
  readonly position: 43 | 44;
  readonly previewDocumentHash: string;
  readonly rendererDocumentHash: string;
}

interface ReceiptStep {
  readonly stateCommitment: RealBuildPrefix50StateCommitment;
  readonly playbackCommitment: PlaybackCommitment;
  readonly captureBinding: Prefix50Step44CaptureBinding;
  readonly evidence: Prefix50Step44ModelOnlyEvidence;
}

export async function attachPrefix50Step43To44VisualReceipt(input: {
  readonly testInfo: TestInfo;
  readonly traceCommitment: `sha256:${string}`;
  readonly step43: ReceiptStep;
  readonly step44: ReceiptStep;
  readonly transition: BuildPlaybackTraceTransitionV1;
  readonly visualDelta: Prefix50Step44VisualDelta;
}): Promise<void> {
  const body = {
    schemaVersion: "lego.prefix50-step43-44-playback-visual-evidence/1",
    authority: "none",
    traceCommitment: input.traceCommitment,
    step43: input.step43,
    step44: input.step44,
    transition43To44: {
      transitionCommitment: input.transition.transitionCommitment,
      operationGroupCommitments: input.transition.operationGroups.map((group) =>
        canonicalDigest(group),
      ),
    },
    visualDelta: input.visualDelta,
  } as const;
  const receipt = { ...body, commitment: canonicalDigest(body) } as const;
  await input.testInfo.attach("prefix50-playback-step43-44-visual-receipt.json", {
    body: Buffer.from(canonicalStringify(receipt), "utf8"),
    contentType: "application/json",
  });
}
