import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  deriveBrickScene,
  instructionViewFrame,
  type OrthographicViewFrame,
} from "@lego-studio/rendering";
import type { Page } from "playwright";
import { Box3, Vector3 } from "three";

import {
  renderRealBuildPrefix50Step44SemanticColorMaskInApp,
  renderRealBuildPrefix50Step44SharedParentInApp,
  seedRealBuildPrefix50DocumentInApp,
} from "./real-build-prefix50-subbuild-return-review-camera-app.ts";
import {
  recordRealBuildPrefix50Step44RealDomainObservation,
  requireRealBuildPrefix50Step44RealDomainPredecessorCase,
  type RealBuildPrefix50Step44RealDomainObservation,
  type RealBuildPrefix50Step44RealDomainPredecessorCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import {
  RealBuildPrefix50Step44CameraSearchRefusalError,
  requireRealBuildPrefix50LiveCameraSearchAttemptEvidence,
  searchRealBuildPrefix50Step44ParentCamera,
  type RealBuildPrefix50Step44CameraSearchAttemptEvidence,
  type RealBuildPrefix50Step44CameraSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import { deriveRealBuildPrefix50Step44PreregisteredCameraBranches } from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import {
  deriveRealBuildPrefix50RealDomainSemanticColorPolicy,
  type RealBuildPrefix50SemanticColorPolicy,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";

interface RuntimeSnapshot {
  readonly partCount: number;
  readonly structuralHash: string;
  readonly documentGloballyValid: boolean;
}

export interface RealBuildPrefix50Step44BrowserCaptureCapability {
  readonly panelStep: 41 | 42 | 43;
  readonly sourceCaseCommitment: `sha256:${string}`;
  readonly predecessorCaseCommitment: `sha256:${string}`;
  readonly attemptCommitment: `sha256:${string}`;
  readonly runtimeCaptureCount: number;
  readonly commitment: `sha256:${string}`;
}

const browserCaptureCapabilityBrands = new WeakSet<object>();
const capturedCaseBrands = new WeakSet<object>();

export function requireRealBuildPrefix50Step44BrowserCaptureCapability(
  value: RealBuildPrefix50Step44BrowserCaptureCapability,
): RealBuildPrefix50Step44BrowserCaptureCapability {
  const { commitment, ...body } = value;
  if (!browserCaptureCapabilityBrands.has(value) || commitment !== canonicalDigest(body))
    throw new TypeError(
      "Real-domain observation requires the opaque capability minted after actual in-app snapshots and render captures.",
    );
  return value;
}

export interface RealBuildPrefix50Step44RealDomainCapturedCase {
  readonly panelStep: 41 | 42 | 43;
  readonly status: "resolved" | "refused";
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly semanticPolicy: RealBuildPrefix50SemanticColorPolicy;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
  readonly attemptEvidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence;
  readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
  readonly runtimeCaptureCount: number;
  readonly scaleSeedCommitment: `sha256:${string}`;
  readonly runtimeStateCommitment: `sha256:${string}`;
}

function binaryMaskBounds(mask: Uint8Array): {
  readonly widthPx: number;
  readonly heightPx: number;
} {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== 720 * 470)
    throw new TypeError("Real-domain scale seed requires the exact 720x470 parent target mask.");
  let minX = 720;
  let minY = 470;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % 720;
    const y = Math.floor(index / 720);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY)
    throw new TypeError("Real-domain scale seed cannot fit an empty source parent target.");
  return { widthPx: maxX - minX + 1, heightPx: maxY - minY + 1 };
}

function projectedBoundsAtUnitScale(input: {
  readonly bounds: Box3;
  readonly frame: OrthographicViewFrame;
  readonly parameters: ReturnType<
    typeof deriveRealBuildPrefix50Step44PreregisteredCameraBranches
  >[number]["parameters"];
}): { readonly widthPx: number; readonly heightPx: number } {
  if (input.bounds.isEmpty())
    throw new TypeError("Real-domain scale seed cannot project empty predecessor bounds.");
  const camera = createOrthographicViewCamera(
    { ...input.parameters, pixelsPerUnit: 1 },
    input.frame,
  );
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const x of [input.bounds.min.x, input.bounds.max.x])
    for (const y of [input.bounds.min.y, input.bounds.max.y])
      for (const z of [input.bounds.min.z, input.bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        const pixelX = ((projected.x + 1) * input.frame.widthPx) / 2;
        const pixelY = ((1 - projected.y) * input.frame.heightPx) / 2;
        minX = Math.min(minX, pixelX);
        minY = Math.min(minY, pixelY);
        maxX = Math.max(maxX, pixelX);
        maxY = Math.max(maxY, pixelY);
      }
  const widthPx = maxX - minX;
  const heightPx = maxY - minY;
  if (!(widthPx > 0) || !(heightPx > 0) || !Number.isFinite(widthPx + heightPx))
    throw new TypeError("Real-domain predecessor projection has no finite two-dimensional extent.");
  return { widthPx, heightPx };
}

function sourceSeededBranches(input: {
  readonly source: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly bounds: Box3;
  readonly frame: OrthographicViewFrame;
}) {
  const target = binaryMaskBounds(input.source.parentOnlyForegroundMask);
  return deriveRealBuildPrefix50Step44PreregisteredCameraBranches(
    input.source.latticeFit.solution,
  ).map((branch) => {
    const projected = projectedBoundsAtUnitScale({
      bounds: input.bounds,
      frame: input.frame,
      parameters: branch.parameters,
    });
    const pixelsPerUnit = Math.min(
      target.widthPx / projected.widthPx,
      target.heightPx / projected.heightPx,
    );
    if (!(pixelsPerUnit > 0) || !Number.isFinite(pixelsPerUnit))
      throw new TypeError(
        `Real-domain branch ${branch.branchKey} has no finite source-derived scale.`,
      );
    return Object.freeze({
      ...branch,
      parameters: Object.freeze({ ...branch.parameters, pixelsPerUnit }),
    });
  });
}

async function snapshot(page: Page): Promise<RuntimeSnapshot> {
  return page.evaluate(() => window.get_model_snapshot!()) as Promise<RuntimeSnapshot>;
}

function requireExactSnapshot(
  value: RuntimeSnapshot,
  predecessor: RealBuildPrefix50Step44RealDomainPredecessorCase,
  phase: string,
): void {
  if (
    value.partCount !== predecessor.activeChildPredecessor.partCount ||
    value.structuralHash !== predecessor.activeChildPredecessor.documentHash ||
    value.documentGloballyValid !== true
  )
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} ${phase} browser state was not its exact hard-valid active child predecessor.`,
    );
}

export async function captureRealBuildPrefix50Step44RealDomainCaseInApp(input: {
  readonly page: Page;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly attemptSink?: (
    evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
  ) => Promise<void> | void;
}): Promise<RealBuildPrefix50Step44RealDomainCapturedCase> {
  const predecessor = requireRealBuildPrefix50Step44RealDomainPredecessorCase(
    input.predecessorCase,
  );
  const source = requireRealBuildPrefix50Step44RealDomainSourceCase(input.sourceCase);
  if (source.panelStep !== predecessor.panelStep || source.splitRole !== predecessor.splitRole)
    throw new TypeError(
      "Real-domain browser capture requires the same runtime-branded source and predecessor panel.",
    );
  const semanticPolicy = deriveRealBuildPrefix50RealDomainSemanticColorPolicy(
    predecessor.activeChildDocument,
  );
  if (
    semanticPolicy.parentDocumentHash !== predecessor.activeChildPredecessor.documentHash ||
    semanticPolicy.parentDocumentCommitment !==
      predecessor.activeChildPredecessor.documentCommitment ||
    semanticPolicy.classificationCommitment !== predecessor.semanticClassificationCommitment
  )
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} semantic policy drifted from the exact branded predecessor roster.`,
    );
  await seedRealBuildPrefix50DocumentInApp(
    input.page,
    predecessor.activeChildDocument,
    predecessor.activeChildPredecessor.partCount,
    `Step-${predecessor.predecessorThroughStep} active child predecessor`,
  );
  requireExactSnapshot(await snapshot(input.page), predecessor, "seeded");
  const scene = deriveBrickScene(predecessor.activeChildDocument, { finish: "instruction" });
  const frame = instructionViewFrame(scene.bounds, 720, 470);
  const branches = sourceSeededBranches({ source, bounds: scene.bounds, frame });
  const scaleSeedCommitment = canonicalDigest(
    branches.map(({ branchKey, parameters: { pixelsPerUnit } }) => ({
      branchKey,
      pixelsPerUnit,
    })),
  );
  scene.dispose();
  let attemptEvidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
  let runtimeCaptureCount = 0;
  const checkedCapture = async <T>(capture: () => Promise<T>): Promise<T> => {
    requireExactSnapshot(await snapshot(input.page), predecessor, "pre-capture");
    const result = await capture();
    requireExactSnapshot(await snapshot(input.page), predecessor, "post-capture");
    runtimeCaptureCount += 1;
    return result;
  };
  let refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[] = [];
  try {
    await searchRealBuildPrefix50Step44ParentCamera({
      branches,
      expectedPanelFace: "studs-up",
      sourceRgba: source.rgba,
      frame,
      parentOnlyTargetMask: source.parentOnlyForegroundMask,
      eligibleMask: source.eligibleMask,
      render: (parameters, renderFrame) =>
        checkedCapture(() =>
          renderRealBuildPrefix50Step44SharedParentInApp(input.page, parameters, renderFrame),
        ),
      semanticPolicy,
      renderSemantic: (parameters, renderFrame, policy) =>
        checkedCapture(() =>
          renderRealBuildPrefix50Step44SemanticColorMaskInApp(
            input.page,
            parameters,
            renderFrame,
            policy,
          ),
        ),
      attemptSink: async (evidence) => {
        attemptEvidence = evidence;
        await input.attemptSink?.(evidence);
      },
    });
  } catch (error) {
    if (!(error instanceof RealBuildPrefix50Step44CameraSearchRefusalError)) throw error;
    refusalReasons = error.refusalReasons;
  }
  if (attemptEvidence === undefined)
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} search ended without its mandatory live attempt evidence.`,
    );
  requireExactSnapshot(await snapshot(input.page), predecessor, "finished");
  if (runtimeCaptureCount !== attemptEvidence.attempt.totalCaptureCount)
    throw new TypeError(
      `Real-domain panel ${predecessor.panelStep} browser observed ${runtimeCaptureCount} captures, not the attempt's ${attemptEvidence.attempt.totalCaptureCount}.`,
    );
  const captureCapabilityBody = {
    panelStep: predecessor.panelStep,
    sourceCaseCommitment: source.commitment,
    predecessorCaseCommitment: predecessor.commitment,
    attemptCommitment: attemptEvidence.attempt.commitment,
    runtimeCaptureCount,
  };
  const browserCaptureCapability = Object.freeze({
    ...captureCapabilityBody,
    commitment: canonicalDigest(captureCapabilityBody),
  });
  browserCaptureCapabilityBrands.add(browserCaptureCapability);
  const observation = recordRealBuildPrefix50Step44RealDomainObservation({
    browserCaptureCapability,
    predecessorCase: predecessor,
    sourceCase: source,
    semanticPolicyCommitment: semanticPolicy.commitment,
    evidence: attemptEvidence,
  });
  const runtimeStateCommitment = canonicalDigest({
    panelStep: predecessor.panelStep,
    documentHash: predecessor.activeChildPredecessor.documentHash,
    documentCommitment: predecessor.activeChildPredecessor.documentCommitment,
    semanticPolicyCommitment: semanticPolicy.commitment,
    attemptCommitment: attemptEvidence.attempt.commitment,
    observationCommitment: observation.observationCommitment,
    scaleSeedCommitment,
    runtimeCaptureCount,
  });
  const captured = Object.freeze({
    panelStep: predecessor.panelStep,
    status: attemptEvidence.attempt.status,
    predecessorCase: predecessor,
    sourceCase: source,
    semanticPolicy,
    observation,
    attemptEvidence,
    refusalReasons,
    runtimeCaptureCount,
    scaleSeedCommitment,
    runtimeStateCommitment,
  });
  capturedCaseBrands.add(captured);
  return captured;
}

export function requireRealBuildPrefix50Step44RealDomainCapturedCase(
  value: RealBuildPrefix50Step44RealDomainCapturedCase,
): RealBuildPrefix50Step44RealDomainCapturedCase {
  if (!capturedCaseBrands.has(value))
    throw new TypeError(
      "Real-domain camera evidence must originate from captureRealBuildPrefix50Step44RealDomainCaseInApp.",
    );
  requireRealBuildPrefix50Step44RealDomainSourceCase(value.sourceCase);
  requireRealBuildPrefix50Step44RealDomainPredecessorCase(value.predecessorCase);
  requireRealBuildPrefix50LiveCameraSearchAttemptEvidence(value.attemptEvidence);
  return value;
}
