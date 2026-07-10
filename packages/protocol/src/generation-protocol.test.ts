import { describe, expect, it } from "vitest";

import {
  validateAcceptanceAuthorizationV1,
  validateActorObservationV1,
  validateArtifactRefV1,
  validateAttemptTranscriptV1,
  validateBuildBriefV1,
  validateCandidateProgramSubmissionV1,
  validateCandidateRecordV1,
  validateGenerationJobRecordV1,
  validateMakerObservationV1,
  validateNativeSealedRunManifestV1,
  validatePresentedPatchEnvelopeV1,
  validateProviderCapabilitiesV1,
  validateRenderPacketV1,
  validateRunEventV1,
  type AcceptanceAuthorizationV1,
  type ActorObservationV1,
  type ArtifactRefV1,
  type AttemptTranscriptV1,
  type BuildBriefV1,
  type CandidateProgramSubmissionV1,
  type CandidateRecordV1,
  type GenerationJobRecordV1,
  type MakerObservationV1,
  type NativeSealedRunManifestV1,
  type PresentedPatchEnvelopeV1,
  type ProviderCapabilitiesV1,
  type RenderPacketV1,
  type RunEventV1,
} from "./index.js";

const HASH = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const SIGNATURE = "A".repeat(86);

const artifact = {
  artifactId: "artifact-1",
  kind: "render",
  mediaType: "image/png",
  sha256: HASH,
  byteLength: 128,
  casKey: HASH,
} satisfies ArtifactRefV1;

const budgets = {
  maxCandidates: 4,
  maxRepairs: 2,
  maxProviderCalls: 4,
  maxTokens: 4096,
  maxCostMicros: 1_000_000,
  maxWallTimeMs: 60_000,
  maxRenders: 64,
  maxStoredBytes: 16_777_216,
} as const;

const brief = {
  schemaVersion: "lego.build-brief/1",
  mode: "full",
  prompt: "Build a small red and yellow tower.",
  referenceArtifactIds: [],
  baseRevision: "revision-1",
  baseDocumentHash: HASH,
  allowedCatalogPartIds: ["builtin:brick-1x2"],
  allowedColorIds: ["builtin:red", "builtin:yellow"],
  pieceBudget: 24,
  semanticRequirements: ["one connected tower"],
  styleTags: ["simple"],
  budgets,
  consent: {
    policyVersion: "consent-1",
    providerTransmission: "none",
    retainRunArtifacts: true,
    knowledgeUse: false,
    benchmarkUse: false,
    trainingUse: false,
  },
} satisfies BuildBriefV1;

const report = {
  schemaVersion: "lego.validation-report/1",
  targetDocumentHash: HASH,
  truthSnapshotHash: HASH,
  validatorSetHash: HASH,
  patchValid: true,
  documentGloballyValid: true,
  issues: [],
} as const;

const renderPacket = {
  schemaVersion: "lego.render-packet/1",
  documentHash: HASH,
  validationReportHash: HASH,
  rendererSnapshotHash: HASH,
  cameraSnapshotHash: HASH,
  capturePolicyHash: HASH,
  browserBuildHash: HASH,
  views: ["isometric", "front", "back", "left", "right", "top", "underside"].map(
    (viewId, index) => ({
      viewId,
      pass: "beauty" as const,
      artifact: { ...artifact, artifactId: `render-${index}` },
      width: 512,
      height: 512,
      devicePixelRatio: 1,
    }),
  ),
} satisfies RenderPacketV1;

const actorObservation = {
  schemaVersion: "lego.actor-observation/1",
  observationHash: HASH,
  runId: "run-1",
  sequence: 1,
  screenshotArtifact: artifact,
  visibleTextHash: HASH,
  offeredControls: [
    {
      controlId: "preview-candidate",
      label: "Preview candidate",
      state: "enabled",
      bounds: { x: 0, y: 0, width: 120, height: 32 },
      actionCategories: ["preview"],
    },
  ],
  viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
  cameraSnapshotHash: HASH,
  renderConfigHash: HASH,
  applicationBuildHash: HASH,
  documentRevision: "revision-1",
  documentHash: HASH,
  activeJobId: "job-1",
} satisfies ActorObservationV1;

const makerObservation = {
  schemaVersion: "lego.maker-observation/1",
  observationHash: HASH,
  jobId: "job-1",
  attemptId: "attempt-1",
  consentPolicyHash: HASH,
  scopePolicyHash: HASH,
  baseRevision: "revision-1",
  baseDocumentHash: HASH,
  brief,
  scope: {
    mutablePartIds: [],
    readOnlyBoundaryPartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-400, -400, -400], maxLdu: [400, 400, 400] },
    allowedCatalogPartIds: brief.allowedCatalogPartIds,
    allowedColorIds: brief.allowedColorIds,
    budgets: { maxAddedParts: 24, maxRemovedParts: 0, maxOperations: 72 },
  },
  documentSummary: {
    partCount: 0,
    connectionCount: 0,
    componentCount: 0,
    exposedPortCount: 0,
    semanticTags: [],
    boundsLdu: { minLdu: [0, 0, 0], maxLdu: [0, 0, 0] },
  },
  validationSummary: report,
  renderPacket,
  referenceArtifacts: [],
  templateSnapshotHashes: [],
  lessonSnapshotHashes: [],
  remainingBudgets: budgets,
} satisfies MakerObservationV1;

const programSubmission = {
  schemaVersion: "lego.candidate-program-submission/1",
  jobId: "job-1",
  attemptId: "attempt-1",
  observationHash: HASH,
  program: {
    schemaVersion: "lego.build-program/1",
    operations: [
      {
        kind: "placePart",
        operationId: "place-1",
        localPartId: "part-1",
        catalogPartId: "builtin:brick-1x2",
        colorId: "builtin:red",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: ["tower"],
      },
    ],
  },
} satisfies CandidateProgramSubmissionV1;

const attempt = {
  schemaVersion: "lego.attempt-transcript/1",
  runId: "run-1",
  attemptId: "attempt-1",
  sequence: 2,
  kind: "maker",
  observationHash: HASH,
  inputArtifactHashes: [HASH],
  deadlineMs: 30_000,
  startedEventHash: HASH,
  terminalEventHash: HASH_B,
  terminal: {
    status: "staleObservation",
    proposedDecisionArtifactHash: HASH,
    reasonCode: "observation-stale",
    preDocumentHash: HASH,
    postDocumentHash: HASH,
  },
} satisfies AttemptTranscriptV1;

const job = {
  schemaVersion: "lego.generation-job/1",
  namespace: "test",
  jobId: "job-1",
  idempotencyKey: "job-request-1",
  state: "running",
  baseRevision: "revision-1",
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  scopeCapabilityId: "scope-1",
  scopeDigest: HASH,
  briefHash: HASH,
  budgets,
  cancellationGeneration: 0,
  candidateIds: ["candidate-1"],
  eventSequence: 2,
} satisfies GenerationJobRecordV1;

const candidate = {
  schemaVersion: "lego.candidate-record/1",
  jobId: "job-1",
  candidateId: "candidate-1",
  cancellationGeneration: 0,
  state: "received",
  programArtifact: { ...artifact, artifactId: "program-1", kind: "program" },
  metrics: {
    partCount: 1,
    operationCount: 1,
    blockingIssueCount: 0,
    advisoryIssueCount: 0,
  },
  failureCodes: [],
} satisfies CandidateRecordV1;

const patch = {
  schemaVersion: "lego.assembly-patch/1",
  baseRevision: "revision-1",
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  scopeCapabilityId: "scope-1",
  scopeDigest: HASH,
  operations: [
    {
      kind: "addPart",
      operationId: "operation-1",
      part: {
        id: "part-1",
        catalogPartId: "builtin:brick-1x2",
        colorId: "builtin:red",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: ["tower"],
        provenance: { source: "ai", sourceId: "candidate-1" },
      },
      semanticRegionIds: [],
    },
  ],
  provenance: {
    jobId: "job-1",
    candidateId: "candidate-1",
    compilerSnapshotHash: HASH,
    buildProgramHash: HASH,
  },
} as const;

const seal = {
  algorithm: "Ed25519",
  keyId: "test-key-1",
  keyEpoch: 1,
  signature: SIGNATURE,
} as const;

const envelope = {
  schemaVersion: "lego.presented-patch-envelope/1",
  namespace: "test",
  jobId: "job-1",
  candidateId: "candidate-1",
  cancellationGeneration: 0,
  compilerSnapshotHash: HASH,
  buildProgramHash: HASH,
  validationReportHash: HASH,
  candidateState: "presented",
  patch,
  issuedAt: "2026-07-09T12:00:00Z",
  seal,
} satisfies PresentedPatchEnvelopeV1;

const authorization = {
  schemaVersion: "lego.acceptance-authorization/1",
  namespace: "production",
  authorizationId: "authorization-1",
  transactionId: "transaction-1",
  envelopeHash: HASH,
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  browserDeviceKeyId: "device-key-1",
  cancellationGeneration: 0,
  issuedEventSequence: 12,
  issuedEventRoot: HASH,
  seal: { ...seal, keyId: "production-key-1" },
} satisfies AcceptanceAuthorizationV1;

const runEvent = {
  schemaVersion: "lego.run-event/1",
  runId: "run-1",
  sequence: 1,
  previousEventHash: HASH,
  actorId: "broker-1",
  transition: "run-created",
  idempotencyKey: "event-1",
  artifactHashes: [HASH],
  eventHash: HASH_B,
} satisfies RunEventV1;

const manifest = {
  schemaVersion: "lego.native-run-manifest/1",
  namespace: "test",
  runId: "run-1",
  terminalState: "succeeded",
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  applicationBuildHash: HASH,
  brokerBuildHash: HASH,
  harnessBuildHash: HASH,
  lockfileHash: HASH,
  runtimeHash: HASH,
  briefHash: HASH,
  scopeDigest: HASH,
  budgets,
  candidateIds: ["candidate-1"],
  eventCount: 2,
  eventRoot: HASH,
  artifacts: [artifact],
  replayClosure: {
    sealedReplayLevel: "downstream-only",
    earliestRetainedBoundary: "program",
    artifactRoot: HASH,
    requiredArtifactHashes: [HASH],
    verifierVersion: "closure-verifier-1",
  },
  finalizedAt: "2026-07-09T12:00:00Z",
  seal,
} satisfies NativeSealedRunManifestV1;

const providerCapabilities = {
  schemaVersion: "lego.provider-capabilities/1",
  providerId: "local-template",
  policyVersion: "policy-1",
  supportedProtocolVersions: ["lego.protocol/1"],
  supportedCatalogHashes: [HASH],
  inputKinds: ["text"],
  supportsTools: false,
  supportsStreaming: false,
  cancellation: "real",
  seedBehavior: "deterministic",
  maxInputBytes: 65_536,
  maxOutputBytes: 1_048_576,
  maxTokens: 4096,
  execution: "local",
  retention: "none",
  training: "prohibited",
  acceptedConsentClasses: ["none"],
} satisfies ProviderCapabilitiesV1;

describe("generation and authority protocol validators", () => {
  it("accepts the bounded Gate 0 generation and evidence contracts", () => {
    expect(validateArtifactRefV1(artifact)).toBe(true);
    expect(validateBuildBriefV1(brief)).toBe(true);
    expect(validateProviderCapabilitiesV1(providerCapabilities)).toBe(true);
    expect(validateRenderPacketV1(renderPacket)).toBe(true);
    expect(validateActorObservationV1(actorObservation)).toBe(true);
    expect(validateMakerObservationV1(makerObservation)).toBe(true);
    expect(validateCandidateProgramSubmissionV1(programSubmission)).toBe(true);
    expect(validateAttemptTranscriptV1(attempt)).toBe(true);
    expect(validateGenerationJobRecordV1(job)).toBe(true);
    expect(validateCandidateRecordV1(candidate)).toBe(true);
    expect(validatePresentedPatchEnvelopeV1(envelope)).toBe(true);
    expect(validateAcceptanceAuthorizationV1(authorization)).toBe(true);
    expect(validateRunEventV1(runEvent)).toBe(true);
    expect(validateNativeSealedRunManifestV1(manifest)).toBe(true);
  });

  it("rejects worker-authored authority fields on candidate submissions", () => {
    expect(
      validateCandidateProgramSubmissionV1({ ...programSubmission, scope: makerObservation.scope }),
    ).toBe(false);
    expect(validateCandidateProgramSubmissionV1({ ...programSubmission, patch })).toBe(false);
    expect(
      validateCandidateProgramSubmissionV1({ ...programSubmission, provenance: patch.provenance }),
    ).toBe(false);
  });

  it("keeps locked-region details out of model-facing maker scope", () => {
    expect(
      validateMakerObservationV1({
        ...makerObservation,
        scope: { ...makerObservation.scope, frozenPartIds: ["secret-locked-part"] },
      }),
    ).toBe(false);
  });

  it("rejects executed actions and command transactions for no-mutation terminals", () => {
    expect(
      validateAttemptTranscriptV1({
        ...attempt,
        terminal: { ...attempt.terminal, executedActionArtifactHash: HASH },
      }),
    ).toBe(false);
    expect(
      validateAttemptTranscriptV1({
        ...attempt,
        terminal: { ...attempt.terminal, commandTransactionHash: HASH },
      }),
    ).toBe(false);
    expect(
      validateAttemptTranscriptV1({
        ...attempt,
        terminal: { ...attempt.terminal, postDocumentHash: HASH_B },
      }),
    ).toBe(false);
  });

  it("keeps acceptance production-only while allowing test-namespace preview envelopes", () => {
    expect(validatePresentedPatchEnvelopeV1(envelope)).toBe(true);
    expect(validateAcceptanceAuthorizationV1({ ...authorization, namespace: "test" })).toBe(false);
    expect(validatePresentedPatchEnvelopeV1({ ...envelope, candidateState: "ranked" })).toBe(false);
    expect(
      validatePresentedPatchEnvelopeV1({ ...envelope, candidateId: "different-candidate" }),
    ).toBe(false);
  });

  it("rejects unbounded artifacts, render packets, and manifests", () => {
    expect(validateArtifactRefV1({ ...artifact, byteLength: 1_073_741_825 })).toBe(false);
    expect(validateArtifactRefV1({ ...artifact, casKey: HASH_B })).toBe(false);
    expect(validateRenderPacketV1({ ...renderPacket, views: renderPacket.views.slice(0, 6) })).toBe(
      false,
    );
    expect(validateNativeSealedRunManifestV1({ ...manifest, extraRoot: HASH })).toBe(false);
  });
});
