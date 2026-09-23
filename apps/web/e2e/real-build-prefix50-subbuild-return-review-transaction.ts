import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type {
  RealBuildPrefix50Step44BlindBatchDispatchInput,
  RealBuildPrefix50Step44BlindBatchDispatchResult,
} from "./real-build-prefix50-subbuild-return-review-batch-dispatch.ts";
import {
  realBuildPrefix50Step44BrowserLifecycleError,
  runRealBuildPrefix50Step44BrowserLifecycle,
  type RealBuildPrefix50Step44BrowserLifecycleCleanup,
} from "./real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import {
  createRealBuildPrefix50Step44BlindDispatchPlan,
  sha256RealBuildPrefix50Step44BlindBytes,
  type RealBuildPrefix50Step44BlindDispatchPlan,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import { deriveRealBuildPrefix50Step44Page45CameraInstrument } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { captureRealBuildPrefix50Step44ReviewCandidate } from "./real-build-prefix50-subbuild-return-review-capture.ts";
import {
  createRealBuildPrefix50Step44ContactSheetReference,
  type RealBuildPrefix50Step44BatchCaptureRow,
} from "./real-build-prefix50-subbuild-return-review-contact-sheet.ts";
import {
  assertRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  captureRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  claimRealBuildPrefix50Step44ReviewOutputPublication,
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  type RealBuildPrefix50Step44ClaimedDirectoryIdentity,
  type RealBuildPrefix50Step44ReviewOutputPublication,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

const DISPATCH_PLAN_FILE = "real-build-prefix50-step44-blind-dispatch-plan.json";
export const REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE =
  "real-build-prefix50-step44-publication-complete.json";

export interface RealBuildPrefix50Step44CommittedJsonReceipt {
  readonly artifactFile: string;
  readonly byteDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44PublicationDirectories {
  readonly run: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly public: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly withheld: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
}

export type RealBuildPrefix50Step44TransactionCameraInstrument = Awaited<
  ReturnType<typeof deriveRealBuildPrefix50Step44Page45CameraInstrument>
>;

export type RealBuildPrefix50Step44TransactionReference = Awaited<
  ReturnType<typeof createRealBuildPrefix50Step44ContactSheetReference>
>;

export interface RealBuildPrefix50Step44TransactionComposeInput {
  readonly publicOutputPath: string;
  readonly withheldOutputPath: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly reference: RealBuildPrefix50Step44TransactionReference;
  readonly cameraInstrument: RealBuildPrefix50Step44TransactionCameraInstrument;
}

export interface RealBuildPrefix50Step44TransactionManifestContext<TContact> {
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly planBytes: Uint8Array;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly contact: TContact;
  readonly reference: RealBuildPrefix50Step44TransactionReference;
  readonly cameraInstrument: RealBuildPrefix50Step44TransactionCameraInstrument;
}

export interface RealBuildPrefix50Step44TransactionSuccessContext<
  TContact,
> extends RealBuildPrefix50Step44TransactionManifestContext<TContact> {
  readonly publicManifest: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly withheldManifest: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
}

export interface RealBuildPrefix50Step44TransactionCompleteContext<
  TContact,
> extends RealBuildPrefix50Step44TransactionSuccessContext<TContact> {
  readonly success: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly publicationDirectories: RealBuildPrefix50Step44PublicationDirectories;
}

type LifecycleRunner = typeof runRealBuildPrefix50Step44BrowserLifecycle;

export interface RealBuildPrefix50Step44TransactionDefinition<TContact> {
  readonly mode: "production-211" | "test-only-three-row";
  readonly captureCount: 3 | 211;
  readonly publicManifestFile: string;
  readonly withheldManifestFile: string;
  readonly successFile: string;
  readonly completeFile: typeof REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE;
  readonly deriveCamera: typeof deriveRealBuildPrefix50Step44Page45CameraInstrument;
  readonly dispatch: (
    input: RealBuildPrefix50Step44BlindBatchDispatchInput<TContact>,
  ) => Promise<RealBuildPrefix50Step44BlindBatchDispatchResult<TContact>>;
  readonly composeContact: (
    input: RealBuildPrefix50Step44TransactionComposeInput,
  ) => Promise<TContact>;
  readonly publicManifestBody: (
    input: RealBuildPrefix50Step44TransactionManifestContext<TContact>,
  ) => object;
  readonly withheldManifestBody: (
    input: RealBuildPrefix50Step44TransactionManifestContext<TContact> & {
      readonly publicManifest: RealBuildPrefix50Step44CommittedJsonReceipt;
    },
  ) => object;
  readonly successBody: (
    input: RealBuildPrefix50Step44TransactionSuccessContext<TContact>,
  ) => object;
  readonly completeBody: (
    input: RealBuildPrefix50Step44TransactionCompleteContext<TContact>,
  ) => object;
  readonly runLifecycle?: LifecycleRunner;
}

export interface RealBuildPrefix50Step44TransactionResult<TContact> {
  readonly outputPath: string;
  readonly publicRoot: string;
  readonly withheldRoot: string;
  readonly publicManifest: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly withheldManifest: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly success: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly complete: RealBuildPrefix50Step44CommittedJsonReceipt;
  readonly publicationDirectories: RealBuildPrefix50Step44PublicationDirectories;
  readonly contact: TContact;
  readonly capturedCandidateCount: number;
  readonly cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
}

async function writeCommittedJson(
  outputPath: string,
  artifactFile: string,
  body: object,
): Promise<RealBuildPrefix50Step44CommittedJsonReceipt> {
  const value = { ...body, commitment: canonicalDigest(body) };
  const bytes = Buffer.from(canonicalStringify(value));
  await writeFile(resolve(outputPath, artifactFile), bytes, { flag: "wx" });
  return {
    artifactFile,
    byteDigest: sha256RealBuildPrefix50Step44BlindBytes(bytes),
    commitment: value.commitment,
  };
}

function failureSummary(error: unknown): Readonly<{ name: string; message: string }> {
  const summary =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) };
  return {
    name: summary.name.slice(0, 128),
    message: summary.message.slice(0, 2_048),
  };
}

function assertDefinition<TContact>(
  definition: RealBuildPrefix50Step44TransactionDefinition<TContact>,
): void {
  if (
    (definition.mode === "production-211" && definition.captureCount !== 211) ||
    (definition.mode === "test-only-three-row" &&
      (definition.captureCount !== 3 || process.env.NODE_ENV !== "test")) ||
    definition.completeFile !== REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE
  )
    throw new TypeError("Step-44 transaction mode and its immutable capture bound disagree.");
}

function requireCompleteCleanup(cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup): void {
  if (!cleanup.browserClosed || !cleanup.browserProcessTreeClosed || !cleanup.serverClosed)
    throw new TypeError(
      "Step-44 transaction cannot commit publication before browser and server cleanup is exact and complete.",
    );
}

function incompleteBody(input: {
  readonly mode: RealBuildPrefix50Step44TransactionDefinition<unknown>["mode"];
  readonly capturedCandidateCount: number;
  readonly cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
  readonly error: unknown;
}): object {
  const common = {
    authority: "none" as const,
    status: "incomplete" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    capturedCandidateCount: input.capturedCandidateCount,
    cleanup: input.cleanup,
    failure: failureSummary(input.error),
  };
  return input.mode === "production-211"
    ? {
        schemaVersion: "lego.real-build-prefix50-step44-harness-incomplete/1" as const,
        ...common,
        candidateCount: 211 as const,
      }
    : {
        schemaVersion:
          "lego.real-build-prefix50-step44-three-row-headless-smoke-incomplete/1" as const,
        ...common,
        sourceBatchCandidateCount: 211 as const,
        expectedCapturedCandidateCount: 3 as const,
        promotionAuthority: false as const,
      };
}

function incompleteFile(
  mode: RealBuildPrefix50Step44TransactionDefinition<unknown>["mode"],
): string {
  return mode === "production-211"
    ? "real-build-prefix50-step44-harness-incomplete.json"
    : "real-build-prefix50-step44-three-row-smoke-incomplete.json";
}

async function recoverIncompletePublication(input: {
  readonly publication: RealBuildPrefix50Step44ReviewOutputPublication;
  readonly outputPathTrusted: boolean;
  readonly mode: RealBuildPrefix50Step44TransactionDefinition<unknown>["mode"];
  readonly capturedCandidateCount: number;
  readonly cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
  readonly error: unknown;
}): Promise<Readonly<{ markerWriteSkipped: boolean; errors: readonly unknown[] }>> {
  const markerWriteSkipped = !input.outputPathTrusted;
  const errors: unknown[] = [];
  if (input.outputPathTrusted)
    try {
      await writeCommittedJson(
        input.publication.outputPath,
        incompleteFile(input.mode),
        incompleteBody({
          mode: input.mode,
          capturedCandidateCount: input.capturedCandidateCount,
          cleanup: input.cleanup,
          error: input.error,
        }),
      );
    } catch (markerError) {
      errors.push(markerError);
    }
  return { markerWriteSkipped, errors };
}

async function createClaimedOutputDirectories(
  publication: RealBuildPrefix50Step44ReviewOutputPublication,
  run: RealBuildPrefix50Step44ClaimedDirectoryIdentity,
): Promise<RealBuildPrefix50Step44PublicationDirectories> {
  const publicOutputPath = resolve(publication.outputPath, "public");
  const withheldOutputPath = resolve(publication.outputPath, "withheld");
  await mkdir(publicOutputPath, { recursive: false });
  const publicDirectory = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    publicOutputPath,
    run.realPath,
  );
  await mkdir(withheldOutputPath, { recursive: false });
  const withheldDirectory = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    withheldOutputPath,
    run.realPath,
  );
  return { run, public: publicDirectory, withheld: withheldDirectory };
}

async function assertPublicationDirectories(
  expected: RealBuildPrefix50Step44PublicationDirectories,
): Promise<void> {
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(expected.run);
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(expected.public);
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(expected.withheld);
}

export const realBuildPrefix50Step44TransactionTestOnly = Object.freeze({
  recoverClaimedThreeRowOutput: async (
    publication: RealBuildPrefix50Step44ReviewOutputPublication,
  ): Promise<void> => {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 claimed-output recovery probe is test-only.");
    const recovery = await recoverIncompletePublication({
      publication,
      outputPathTrusted: true,
      mode: "test-only-three-row",
      capturedCandidateCount: 0,
      cleanup: {
        browserClosed: true,
        browserProcessTreeClosed: true,
        serverClosed: true,
      },
      error: new Error("Injected Step-44 claimed-output recovery probe."),
    });
    if (recovery.markerWriteSkipped || recovery.errors.length > 0)
      throw new AggregateError(recovery.errors, "Step-44 claimed-output recovery probe failed.");
  },
  createClaimedOutputDirectories,
  assertPublicationDirectories: async (
    expected: RealBuildPrefix50Step44PublicationDirectories,
  ): Promise<void> => {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 publication-directory assertion probe is test-only.");
    await assertPublicationDirectories(expected);
  },
});

export async function runRealBuildPrefix50Step44ReviewTransaction<TContact>(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly realDomainQualification?: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly definition: RealBuildPrefix50Step44TransactionDefinition<TContact>;
}): Promise<RealBuildPrefix50Step44TransactionResult<TContact>> {
  const { batch, definition } = input;
  assertDefinition(definition);
  if (definition.mode === "production-211" && input.realDomainQualification === undefined)
    throw new TypeError(
      "Step-44 production transaction requires the runtime-branded real-domain qualification binding before camera execution.",
    );
  if (batch.candidateCount !== 211 || batch.candidates.length !== 211)
    throw new TypeError(
      "Step-44 review transaction requires one exact 211-candidate source batch.",
    );
  const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(input.outputPath);
  const publicOutputPath = resolve(publication.outputPath, "public");
  const withheldOutputPath = resolve(publication.outputPath, "withheld");
  let capturedCandidateCount = 0;
  let cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup = {
    browserClosed: true,
    browserProcessTreeClosed: true,
    serverClosed: true,
  };
  let runDirectoryIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity | undefined;
  let publicationDirectories: RealBuildPrefix50Step44PublicationDirectories | undefined;
  try {
    runDirectoryIdentity = await claimRealBuildPrefix50Step44ReviewOutputPublication(publication);
    publicationDirectories = await createClaimedOutputDirectories(
      publication,
      runDirectoryIdentity,
    );
    const plan = createRealBuildPrefix50Step44BlindDispatchPlan(batch);
    const planBytes = Buffer.from(canonicalStringify(plan));
    await writeFile(resolve(withheldOutputPath, DISPATCH_PLAN_FILE), planBytes, { flag: "wx" });
    const runLifecycle = definition.runLifecycle ?? runRealBuildPrefix50Step44BrowserLifecycle;
    const lifecycle = await runLifecycle({
      serverLogPath: resolve(withheldOutputPath, "static-app.log"),
      execute: async ({ page, browser, appUrl }) => {
        const reference = await createRealBuildPrefix50Step44ContactSheetReference({
          repositoryRoot: input.repositoryRoot,
          outputPath: publicOutputPath,
          realDomainQualification: input.realDomainQualification!,
        });
        const cameraInstrument = await definition.deriveCamera({
          page,
          repositoryRoot: input.repositoryRoot,
          outputPath: withheldOutputPath,
          reviewBatch: batch,
          realDomainQualification: input.realDomainQualification!,
        });
        const dispatched = await definition.dispatch({
          batch,
          plan,
          capture: async ({ artifactDirectory, envelope }) => {
            const candidateOutputPath = resolve(withheldOutputPath, artifactDirectory);
            await mkdir(candidateOutputPath, { recursive: false });
            const capture = await captureRealBuildPrefix50Step44ReviewCandidate({
              page,
              browser,
              appUrl,
              outputPath: candidateOutputPath,
              inputBytesHash: input.inputBytesHash,
              envelope,
              page45CameraReceipt: cameraInstrument.receipt,
              fixedCameraBaseline: cameraInstrument.fixedCameraBaseline,
              fixedCameraBaselineArtifact: cameraInstrument.fixedCameraBaselineArtifact,
            });
            capturedCandidateCount += 1;
            return capture;
          },
          compose: ({ plan: exactPlan, captures }) =>
            definition.composeContact({
              publicOutputPath,
              withheldOutputPath,
              batch,
              plan: exactPlan,
              captures,
              reference,
              cameraInstrument,
            }),
        });
        if (
          capturedCandidateCount !== definition.captureCount ||
          dispatched.captures.length !== definition.captureCount
        )
          throw new TypeError(
            `Step-44 ${definition.mode} transaction captured ${capturedCandidateCount} candidates but requires exactly ${definition.captureCount}.`,
          );
        const context = {
          inputBytesHash: input.inputBytesHash,
          batch,
          plan,
          planBytes,
          captures: dispatched.captures,
          contact: dispatched.composed,
          reference,
          cameraInstrument,
        };
        const publicManifest = await writeCommittedJson(
          publicOutputPath,
          definition.publicManifestFile,
          definition.publicManifestBody(context),
        );
        const withheldManifest = await writeCommittedJson(
          withheldOutputPath,
          definition.withheldManifestFile,
          definition.withheldManifestBody({ ...context, publicManifest }),
        );
        return { ...context, publicManifest, withheldManifest };
      },
    });
    cleanup = lifecycle.cleanup;
    if (lifecycle.status === "failed")
      throw realBuildPrefix50Step44BrowserLifecycleError(lifecycle);
    requireCompleteCleanup(cleanup);
    const success = await writeCommittedJson(
      publicOutputPath,
      definition.successFile,
      definition.successBody({ ...lifecycle.value, cleanup }),
    );
    await assertPublicationDirectories(publicationDirectories);
    const complete = await writeCommittedJson(
      publication.outputPath,
      definition.completeFile,
      definition.completeBody({
        ...lifecycle.value,
        success,
        cleanup,
        publicationDirectories,
      }),
    );
    return {
      outputPath: publication.outputPath,
      publicRoot: publicOutputPath,
      withheldRoot: withheldOutputPath,
      publicManifest: lifecycle.value.publicManifest,
      withheldManifest: lifecycle.value.withheldManifest,
      success,
      complete,
      publicationDirectories,
      contact: lifecycle.value.contact,
      capturedCandidateCount,
      cleanup,
    };
  } catch (error) {
    let outputPathTrusted = false;
    const identityErrors: unknown[] = [];
    if (runDirectoryIdentity !== undefined)
      try {
        await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(runDirectoryIdentity);
        outputPathTrusted = true;
      } catch (identityError) {
        identityErrors.push(identityError);
      }
    const recovery = await recoverIncompletePublication({
      publication,
      outputPathTrusted,
      mode: definition.mode,
      capturedCandidateCount,
      cleanup,
      error,
    });
    if (recovery.markerWriteSkipped || identityErrors.length > 0 || recovery.errors.length > 0)
      throw new AggregateError(
        [error, ...identityErrors, ...recovery.errors],
        runDirectoryIdentity === undefined
          ? `Step-44 output claim failed; the existing target remains untouched at ${publication.outputPath}.`
          : identityErrors.length > 0
            ? `Step-44 output identity changed; no COMPLETE or recovery marker was written through the displaced path ${publication.outputPath}.`
            : `Step-44 transaction failed without a COMPLETE receipt; claimed output remains recoverable at ${publication.outputPath}.`,
        { cause: error },
      );
    throw error;
  }
}
