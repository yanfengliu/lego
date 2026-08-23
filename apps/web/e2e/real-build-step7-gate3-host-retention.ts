import {
  REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
  REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
} from "./real-build-production-policy";
import {
  STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
} from "./real-build-step7-gate3-diagnostic-browser";
import {
  retainStep7Gate3DiagnosticOutput,
  retainStep7Gate3UnverifiedFailureEnvelope,
} from "./real-build-step7-gate3-diagnostic-output";
import {
  canonicalTraceDigest,
  EXPECTED,
  OUTPUT_ROOT,
  sha256,
} from "./real-build-step7-gate3-diagnostic-fixture";
import {
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_BLANK_RUNNER_HTML,
} from "./real-build-step7-gate3-diagnostic-source";
import type {
  ExecutedStep7Gate3HostRun,
  UnverifiedStep7Gate3HostExecution,
} from "./real-build-step7-gate3-host-execution";
import type { PreparedStep7Gate3HostRun } from "./real-build-step7-gate3-host-preparation";
import type { VerifiedStep7Gate3HostRun } from "./real-build-step7-gate3-host-verification";

export interface Step7Gate3RetainableTerminalObservation {
  readonly failure: string | null;
  readonly cleanupFailures: readonly string[];
  readonly fullWorkloadComplete: boolean;
  readonly parentAttempts: number;
  readonly narrowingRefused: boolean;
  readonly candidateRefused: boolean;
  readonly productionFrontierAdmitted: boolean;
  readonly documentsPublished: boolean;
  readonly inputFrozen: boolean;
  readonly inputMutation: boolean;
  readonly browserInputDigestBefore: string | null;
  readonly browserInputDigestAfter: string | null;
  readonly inputDocumentFrozen: boolean;
  readonly inputDocumentMutation: boolean;
}

export function assertStep7Gate3RetainableTerminal(
  result: Step7Gate3RetainableTerminalObservation,
  expectedBrowserInputDigest: string,
): void {
  if (result.failure !== null) {
    throw new TypeError(`Gate-3 terminal carries browser failure: ${result.failure}.`);
  }
  if (result.cleanupFailures.length !== 0) {
    throw new TypeError(
      `Gate-3 terminal carries ${result.cleanupFailures.length} cleanup failures; none may be retained as complete.`,
    );
  }
  if (!result.fullWorkloadComplete || result.parentAttempts !== 4) {
    throw new TypeError(
      `Gate-3 terminal completed=${result.fullWorkloadComplete} after ${result.parentAttempts} parents; exact completion requires true after 4.`,
    );
  }
  if (result.narrowingRefused || result.candidateRefused) {
    throw new TypeError(
      `Gate-3 diagnostic ledgers refused narrowing=${result.narrowingRefused}, candidate=${result.candidateRefused}; complete retention requires both false.`,
    );
  }
  if (result.productionFrontierAdmitted || result.documentsPublished) {
    throw new TypeError(
      `Gate-3 authority boundary reported productionFrontierAdmitted=${result.productionFrontierAdmitted}, documentsPublished=${result.documentsPublished}; diagnostic retention requires both false.`,
    );
  }
  if (
    !result.inputFrozen ||
    result.inputMutation ||
    result.browserInputDigestBefore !== expectedBrowserInputDigest ||
    result.browserInputDigestAfter !== expectedBrowserInputDigest
  ) {
    throw new TypeError(
      "Gate-3 complete retention requires a frozen, unmutated browser input with exact host/before/after digest equality.",
    );
  }
  if (!result.inputDocumentFrozen || result.inputDocumentMutation) {
    throw new TypeError(
      "Gate-3 complete retention requires a frozen, unmutated input document closure.",
    );
  }
}

export type Step7Gate3HostFailureStage =
  "preparation" | "execution" | "terminal-admission" | "verification" | "publication";

interface Step7Gate3HostFailureCounterevidenceInput {
  readonly prepared: PreparedStep7Gate3HostRun | null;
  readonly execution: ExecutedStep7Gate3HostRun | null;
  readonly unverifiedExecution: UnverifiedStep7Gate3HostExecution | null;
}

export function buildStep7Gate3UnverifiedHostFailureCounterevidence(
  input: Step7Gate3HostFailureCounterevidenceInput,
) {
  const preparedCounterevidence =
    input.prepared === null
      ? null
      : Object.freeze({
          browserInputDigest: input.prepared.browserInputDigest,
          bootstrapSourceManifestDigest: input.prepared.bootstrapBefore.manifestDigest,
          sourceRunId: input.prepared.artifactManifest.runId,
          sourceBaseDocumentHash: input.prepared.exactBrowserInput.baseDocumentHash,
          orderedSourceParentIds: input.prepared.origins.map(({ candidateId }) => candidateId),
        });
  const executionCounterevidence =
    input.execution !== null
      ? Object.freeze({
          kind: "completed-host-execution-counterevidence" as const,
          browserResult: input.execution.result,
          blankRunnerBefore: input.execution.blankRunnerBefore,
          blankRunnerAfter: input.execution.blankRunnerAfter,
          sourceExecution: input.execution.sourceExecution,
          servedJavaScript: input.execution.servedJavaScript,
          executionPolicyControl: input.execution.executionPolicyControl,
          viteOrigin: input.execution.viteOrigin,
        })
      : input.unverifiedExecution === null
        ? null
        : Object.freeze({
            kind: "partial-host-execution-counterevidence" as const,
            schemaVersion: input.unverifiedExecution.schemaVersion,
            verification: input.unverifiedExecution.verification,
            browserResult: input.unverifiedExecution.result,
            blankRunnerBefore: input.unverifiedExecution.blankRunnerBefore,
            blankRunnerAfter: input.unverifiedExecution.blankRunnerAfter,
            sourceExecution: input.unverifiedExecution.sourceExecution,
            servedJavaScript: input.unverifiedExecution.servedJavaScript,
            sourceExecutionPartial: input.unverifiedExecution.sourceExecutionPartial,
            servedJavaScriptPartial: input.unverifiedExecution.servedJavaScriptPartial,
            executionPolicyControl: input.unverifiedExecution.executionPolicyControl,
            viteOrigin: input.unverifiedExecution.viteOrigin,
          });
  return Object.freeze({
    verification: "unverified-raw-counterevidence" as const,
    completeRun: false as const,
    prepared: preparedCounterevidence,
    execution: executionCounterevidence,
  });
}

export function retainUnverifiedStep7Gate3HostFailure(input: {
  readonly stage: Step7Gate3HostFailureStage;
  readonly failure: unknown;
  readonly prepared: PreparedStep7Gate3HostRun | null;
  readonly execution: ExecutedStep7Gate3HostRun | null;
  readonly unverifiedExecution: UnverifiedStep7Gate3HostExecution | null;
}) {
  return retainStep7Gate3UnverifiedFailureEnvelope({
    outputRoot: OUTPUT_ROOT,
    stage: input.stage,
    failure: input.failure,
    counterevidence: buildStep7Gate3UnverifiedHostFailureCounterevidence(input),
  });
}

export function retainVerifiedStep7Gate3HostRun(
  prepared: PreparedStep7Gate3HostRun,
  execution: ExecutedStep7Gate3HostRun,
  verification: VerifiedStep7Gate3HostRun,
) {
  const { artifactManifest, browserInputDigest, bootstrapBefore } = prepared;
  const {
    result,
    blankRunnerBefore,
    blankRunnerAfter,
    sourceExecution,
    servedJavaScript,
    executionPolicyControl,
  } = execution;
  const {
    nodeReplay,
    batchesByParent,
    browserTrace,
    depthCompositionEstimate,
    controlComparison,
    panelPngBytes,
    outputPanel,
  } = verification;
  assertStep7Gate3RetainableTerminal(result, browserInputDigest);
  const traceBase = {
    schemaVersion: "lego.step7-gate3-diagnostic-trace/1" as const,
    authority: "local-diagnostic" as const,
    fullWorkloadComplete: result.fullWorkloadComplete,
    source: {
      executionClass: "current-source-with-explicit-reviewed-additive-truth-migration",
      retainedSourceExecuted: false,
      runId: artifactManifest.runId,
      artifactManifestDigest: EXPECTED.artifactManifest.digest,
      scoreDigest: EXPECTED.score.digest,
      diagnosticPrefixDigest: EXPECTED.diagnosticPrefix.digest,
      replayClosureDigest: EXPECTED.replayClosure.digest,
      replayManifestDigest: EXPECTED.replayClosure.manifestDigest,
      preparedOptionsDigest: EXPECTED.preparedOptions.digest,
      pdfDigest: EXPECTED.pdf.digest,
      browserInputDigest,
      bootstrapSourceManifestDigest: bootstrapBefore.manifestDigest,
      bootstrapSourceFiles: bootstrapBefore.files.length,
      bootstrapSourceManifest: bootstrapBefore,
      sourceExecution,
      servedJavaScript,
      blankRunner: {
        htmlDigest: sha256(STEP7_GATE3_BLANK_RUNNER_HTML),
        contentSecurityPolicy: STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
        executionPolicyControl,
        before: blankRunnerBefore,
        after: blankRunnerAfter,
        storageUnchanged: true,
      },
    },
    policy: {
      printedStepNumber: 7,
      productionNarrowingLimit: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
      diagnosticNarrowingLimit: STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
      productionCandidateLimit: REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
      productionLimitChanged:
        STEP7_GATE3_PRODUCTION_NARROWING_LIMIT !==
        REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
      officialExpectedTransformsProvidedToBrowser: false,
      retainedReplayExecutable: false,
      currentServedJavaScriptBound: true,
      exactServedOriginBound: true,
      allBrowserContextRequestsAllowlisted: true,
      allExecutableResponsesByteDigestedAfterMaterialization: true,
      hostileExecutableResponseMemoryBoundProved: false,
      servedResponseBodyRetention: "digest-only-post-materialization",
      pdfContentLengthPreflightWhenCanonicalHeaderPresent: true,
      pdfPostMaterializationByteBound: true,
      hostilePdfResponseMemoryBoundProved: false,
      redirectsFollowed: false,
      blobDataEvalOrExternalExecutionAdmitted: false,
      depthCompositionImplemented: false,
      depthCompositionParityProved: false,
      exactPartitionIdentityProved: false,
      equalDepthTieCount: null,
      productionFrontierAdmitted: result.productionFrontierAdmitted,
      documentsPublished: result.documentsPublished,
      inputFrozen: result.inputFrozen,
      inputMutation: result.inputMutation,
      browserInputDigestBefore: result.browserInputDigestBefore,
      browserInputDigestAfter: result.browserInputDigestAfter,
      inputDocumentFrozen: result.inputDocumentFrozen,
      inputDocumentMutation: result.inputDocumentMutation,
      blankRunnerStorageNetMutation: false,
    },
    controlComparison,
    depthCompositionEstimate,
    nodeReplay,
    outputPanel,
    batchesByParent,
    renderRowsDigest: canonicalTraceDigest(result.renders),
    candidateRecordsDigest: canonicalTraceDigest(
      result.parents.flatMap(({ completeLeaves }) => completeLeaves),
    ),
    browser: browserTrace,
  };
  const trace = Object.freeze({ ...traceBase, traceDigest: canonicalTraceDigest(traceBase) });
  const retained = retainStep7Gate3DiagnosticOutput({
    outputRoot: OUTPUT_ROOT,
    trace,
    panelPngBytes,
    summary: {
      schemaVersion: "lego.step7-gate3-diagnostic-summary/1",
      status: result.status,
      fullWorkloadComplete: result.fullWorkloadComplete,
      orderedParentIds: result.orderedParentIds,
      parentAttempts: result.parentAttempts,
      allSourceParentHashesVerified: result.parentMigrations.every(
        ({ sourceHashVerified }) => sourceHashVerified,
      ),
      allActiveParentHashesVerified: result.parents.every(
        (parent) =>
          parent.reconstructedDocumentHash === parent.hashAfterRasterPreparation &&
          parent.reconstructedDocumentHash === parent.hashAfterExpansion,
      ),
      allParentsCompleted: result.parents.length === 4,
      orderedSourceParentIds: result.orderedSourceParentIds,
      orderedCurrentParentIds: result.orderedParentIds,
      migrationReport: result.migrationReport,
      migrationPartsPreserved: result.migrationPartsPreserved,
      parentMigrations: result.parentMigrations,
      parentStarts: result.parentStarts,
      parentTerminals: result.parentTerminals,
      narrowingRefused: result.narrowingRefused,
      candidateRefused: result.candidateRefused,
      productionFrontierAdmitted: result.productionFrontierAdmitted,
      documentsPublished: result.documentsPublished,
      inputFrozen: result.inputFrozen,
      inputMutation: result.inputMutation,
      browserInputDigestBefore: result.browserInputDigestBefore,
      browserInputDigestAfter: result.browserInputDigestAfter,
      inputDocumentFrozen: result.inputDocumentFrozen,
      inputDocumentMutation: result.inputDocumentMutation,
      sharedRenderDemand: result.sharedRenderDemand,
      production8192ShadowRefusal: result.production8192ShadowRefusal,
      controlComparison,
      depthCompositionEstimate,
      nodeReplay,
      browserInputDigest,
      bootstrapSourceManifestDigest: bootstrapBefore.manifestDigest,
      sourceExecutionManifestDigest: sourceExecution.manifestDigest,
      servedJavaScriptManifestDigest: servedJavaScript.manifestDigest,
      blankRunnerHtmlDigest: sha256(STEP7_GATE3_BLANK_RUNNER_HTML),
      blankRunnerContentSecurityPolicyDigest: sha256(
        STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
      ),
      blankRunnerStorageNetMutation: false,
    },
  });
  console.log(`gate3-step7-diagnostic: ${JSON.stringify(retained)}`);
  return retained;
}
