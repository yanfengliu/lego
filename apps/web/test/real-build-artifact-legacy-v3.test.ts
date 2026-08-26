import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";
import { readContainedBoundedRegularFile } from "../e2e/bounded-file-read";
import { verifyLegacyRealBuildArtifactScoreV4 } from "../e2e/real-build-artifact-legacy-score-verification";
import { inspectFrozenLegacyBrowserOutputV2 } from "../e2e/real-build-artifact-legacy-browser-v2";
import { decodeFrozenLegacyPngCaptureV2 } from "../e2e/real-build-artifact-legacy-browser-v2-values";
import { projectLegacyRealBuildCompletionFailuresV4 } from "../e2e/real-build-artifact-legacy-completion-projection";
import {
  assertFrozenLegacyAdditiveCatalogV2,
  createFrozenLegacyAdditiveCatalogBasisV26,
} from "../e2e/real-build-artifact-legacy-document-v2";
import { assertFrozenLegacyIdentityProjectionV2 } from "../e2e/real-build-artifact-legacy-identity-predicates";
import { verifyRealBuildArtifactManifest } from "../e2e/real-build-artifact-current-verification";
import { inspectLegacyRealBuildArtifactManifestV3 } from "../e2e/real-build-artifact-legacy-v3";
import type { LegacyRealBuildArtifactInspectionV3 } from "../e2e/real-build-artifact-legacy-v3";
import type { RealBuildPublicationVerification } from "../e2e/real-build-artifact-publication";
import { sha256Digest } from "../e2e/real-build-artifact-policy";
import { createRealBuildDiagnosticPrefix } from "../e2e/real-build-diagnostic-prefix";
import { LOCAL_REAL_BUILD_AUTHORITY } from "../e2e/real-build-authority";
import { realBuildFartherCapturePath } from "../e2e/real-build-score";
import type { LegacyRealBuildRunContractV2 } from "../e2e/real-build-run-contract";
import { legacyDiagnosticReplayBrowserOutput, replayOptions } from "./real-build-replay-fixture";
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";

const RETAINED_PRODUCTION_RUN = join(
  process.cwd(),
  "output",
  "direct-origin-k-production",
  "runs",
  "2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367",
);
const RETAINED_PRODUCTION_REPLAY_CLOSURE = {
  bytes: 725_460,
  digest: "sha256:a8562c9ae06569f54e8df4ac7b3ec28d6975466ea77a8e662116e70da61b88ef",
  manifestDigest: "sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c",
} as const;
const RETAINED_PRODUCTION_DIAGNOSTIC_PREFIX = {
  bytes: 14_896,
  digest: "sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f",
} as const;
const RETAINED_PRODUCTION_REPLAY_ROLES = {
  "prepared-options": {
    bytes: 1_339_294,
    digest: "sha256:030482e93f29014965157ff014a20a5ac88b1b5e58b001c9305e61593fa3980b",
  },
  "browser-output": {
    bytes: 1_668_298,
    digest: "sha256:3ffd64b43ad2464e660cbfc487f65e0fa348861d4dcc3b4c0a36314a87f3a10c",
  },
} as const;
const FROZEN_SYNTHETIC_DOCUMENT_HASH =
  "sha256:b64567a9a3fab7206ca8fbe723ec95f256107af0f790eaa94309a4fbee95d382";
const FROZEN_SYNTHETIC_DOCUMENT_BYTES_DIGEST =
  "sha256:40deb90d6e390dce650200e77b9ddf826ac7a87910997df118df79c373335ae9";

function retainedCasPath(digest: string): string {
  const hex = digest.slice("sha256:".length);
  return `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
}

interface MutableLegacyDocument {
  connections: unknown[];
  submodels: { partIds: string[] }[];
  semanticRegions: { id: string; label: string; partIds: string[] }[];
  parts: {
    catalogPartId: string;
    transform: { orientationId: string; positionLdu: [number, number, number] };
  }[];
}
interface MutableCatalogCompatibilityBasis {
  truth: BrickDocumentV1["truth"];
  constraints: {
    allowedCatalogPartIds: string[];
    allowedColorIds: string[];
  };
  validatorSemanticsHash: string;
}
interface MutableLegacyBrowserOutput {
  documentJson: string;
  reports: {
    validation: { targetDocumentHash: string | null };
    farther: {
      decision: { revealingStepNumber: number } | null;
      origin: { candidates: { documentHash: string }[] };
    } | null;
    fartherCaptures: Record<string, unknown>[];
  }[];
}

function legacyFixture() {
  const current = legacyDiagnosticReplayBrowserOutput();
  if (current.status !== "executed") {
    throw new TypeError("Synthetic legacy artifact fixture requires executed browser bytes.");
  }
  const reports = current.reports.map(({ panelCamera: _panelCamera, ...report }) => {
    void _panelCamera;
    return report;
  });
  const browserOutput = {
    ...current,
    schemaVersion: "lego.real-build-browser-output/2" as const,
    reports,
  };
  expect(sha256Digest(browserOutput.documentJson)).toBe(FROZEN_SYNTHETIC_DOCUMENT_BYTES_DIGEST);
  const document = JSON.parse(browserOutput.documentJson);
  const diagnostic = createRealBuildDiagnosticPrefix(document);
  expect(diagnostic.structuralHash).toBe(FROZEN_SYNTHETIC_DOCUMENT_HASH);
  const summary = {
    schemaVersion: diagnostic.schemaVersion,
    throughStepNumber: diagnostic.throughStepNumber,
    targetEquivalence: diagnostic.targetEquivalence,
    structuralHash: diagnostic.structuralHash,
    parts: diagnostic.parts,
  };
  const frameMismatches = assertFrozenLegacyIdentityProjectionV2({
    panels: replayOptions.panels.filter(({ stepNumber }) => stepNumber <= replayOptions.lastStep),
    reports: current.reports,
    document,
    bindings: browserOutput.identityBindings,
  });
  const firstFrameMismatch = frameMismatches[0];
  if (firstFrameMismatch === undefined) {
    throw new TypeError(
      "Synthetic legacy artifact fixture requires an official-frame calibration mismatch.",
    );
  }
  const scoreSteps = reports.map(({ panelPng, buildPng, fartherCaptures, ...report }) => ({
    ...report,
    panelPng:
      panelPng === null ? null : `step-${String(report.stepNumber).padStart(3, "0")}-panel.png`,
    buildPng:
      buildPng === null ? null : `step-${String(report.stepNumber).padStart(3, "0")}-build.png`,
    fartherCaptures: fartherCaptures.map((capture) => ({
      captureId: capture.captureId,
      role: capture.role,
      panelStepNumber: capture.panelStepNumber,
      candidateId: capture.candidateId,
      path: realBuildFartherCapturePath(report.stepNumber, capture),
    })),
  }));
  const score = {
    schemaVersion: "lego.real-build-score/4",
    authority: LOCAL_REAL_BUILD_AUTHORITY,
    runId: "legacy-synthetic-run",
    status: "incomplete",
    inputDigests: replayOptions.inputDigests,
    accounting: replayOptions.accounting,
    lastStep: replayOptions.lastStep,
    stepsAttempted: 1,
    stepsComplete: 1,
    piecesPlaced: 2,
    diagnosticPrefix: summary,
    finalParts: 0,
    structuralHash: null,
    inputFailures: [],
    completionFailures: [
      {
        code: "visual-evidence-unverified",
        stage: "evidence",
        stepNumber: 1,
        message:
          `Printed step 1 assembles physical pieces, but the Node finalizer cannot ` +
          `independently recompute the PDF crop, lattice fit, camera registration, highlight masks, rendered ` +
          `candidate scores, or decoded PNG pixels from retained raw rasters. Browser-supplied metrics and image ` +
          `headers remain diagnostic only, so completion is unavailable until a deterministic Node visual audit ` +
          `derives panel pixels from the pinned PDF and renders the canonical document.`,
      },
      {
        code: "official-frame-calibration-missing",
        stage: "validation",
        stepNumber: 1,
        message:
          `${frameMismatches.length} visually searched placement(s) differ from their raw calibrated ` +
          `official-model transforms; the first is ${firstFrameMismatch.identityKey} at printed step ` +
          `${firstFrameMismatch.stepNumber}: searched ${JSON.stringify(firstFrameMismatch.transform)}, ` +
          `official ${JSON.stringify(firstFrameMismatch.officialTransform)}. The repository has no independently ` +
          `proven proper world-frame mapping from the booklet search branch to the official target. The exact ` +
          `valid candidate bytes remain diagnostic, but target equivalence and completion are unavailable; do ` +
          `not treat a reflection as a frame or use the official transforms to choose the visual-search answer.`,
      },
    ],
    failures: [],
    totalElapsedMs: browserOutput.totalElapsedMs,
    steps: scoreSteps,
  };
  const artifactEntries = new Map<string, { bytes: number; digest: string }>();
  for (const report of reports) {
    for (const capture of report.fartherCaptures) {
      const path = realBuildFartherCapturePath(report.stepNumber, capture);
      const bytes = decodeFrozenLegacyPngCaptureV2(capture.png);
      artifactEntries.set(path, { bytes: bytes.length, digest: sha256Digest(bytes) });
    }
  }
  const validationSnapshots = reports.map(({ validation }) => ({
    truthSnapshotHash: validation.truthSnapshotHash,
    validatorSetHash: validation.validatorSetHash,
    targetDocumentHash: validation.targetDocumentHash,
  }));
  const contract = {
    schemaVersion: "lego.real-build-run-contract/2",
    inputDigests: replayOptions.inputDigests,
    budgets: { lastStep: replayOptions.lastStep },
  } as unknown as LegacyRealBuildRunContractV2;
  return {
    browserOutput,
    score,
    artifactEntries,
    validationSnapshots,
    diagnostic,
    summary,
    contract,
  };
}

describe("legacy artifact-manifest /3 inspection", () => {
  it("cannot satisfy the current publication-verifier return contract", () => {
    type LegacyCanPublish =
      LegacyRealBuildArtifactInspectionV3 extends RealBuildPublicationVerification ? true : false;
    const legacyCanPublish: LegacyCanPublish = false;
    expect(legacyCanPublish).toBe(false);
  });

  it("binds the frozen browser-output /2 to score /4, diagnostic bytes, snapshots, and PNGs", () => {
    const fixture = legacyFixture();
    const verify = (score: unknown, entries = fixture.artifactEntries) =>
      verifyLegacyRealBuildArtifactScoreV4({
        scoreBytes: Buffer.from(JSON.stringify(score)),
        diagnosticPrefixBytes: Buffer.from(fixture.browserOutput.documentJson),
        artifactEntries: entries,
        declaredValidationSnapshots: fixture.validationSnapshots,
        declaredFinalStructuralHash: null,
        declaredDiagnosticPrefix: fixture.summary,
        runId: "legacy-synthetic-run",
        authority: LOCAL_REAL_BUILD_AUTHORITY,
        retainedContract: fixture.contract,
        preparedOptions: replayOptions,
        browserOutputBytes: Buffer.from(JSON.stringify(fixture.browserOutput)),
        maximumPrintedSteps: 359,
        sha256Digest,
      });

    expect(verify(fixture.score)).toBeUndefined();
    expect(() =>
      verify({
        ...fixture.score,
        steps: [{ ...fixture.score.steps[0], placedPieces: 1 }],
      }),
    ).toThrow(/do not exactly project/u);
    const forgedEntries = new Map(fixture.artifactEntries);
    const firstPath = [...forgedEntries.keys()][0]!;
    forgedEntries.set(firstPath, { bytes: 1, digest: sha256Digest("forged") });
    expect(() => verify(fixture.score, forgedEntries)).toThrow(/exact browser-output PNG bytes/u);
  });

  it("exact-binds every frozen completion failure field, row, and order", () => {
    const fixture = legacyFixture();
    const verify = (completionFailures: unknown[]) =>
      verifyLegacyRealBuildArtifactScoreV4({
        scoreBytes: Buffer.from(JSON.stringify({ ...fixture.score, completionFailures })),
        diagnosticPrefixBytes: Buffer.from(fixture.browserOutput.documentJson),
        artifactEntries: fixture.artifactEntries,
        declaredValidationSnapshots: fixture.validationSnapshots,
        declaredFinalStructuralHash: null,
        declaredDiagnosticPrefix: fixture.summary,
        runId: "legacy-synthetic-run",
        authority: LOCAL_REAL_BUILD_AUTHORITY,
        retainedContract: fixture.contract,
        preparedOptions: replayOptions,
        browserOutputBytes: Buffer.from(JSON.stringify(fixture.browserOutput)),
        maximumPrintedSteps: 359,
        sha256Digest,
      });
    const original = fixture.score.completionFailures.map((failure) => ({ ...failure }));
    expect(verify(original)).toBeUndefined();
    const [visual, frame] = original;
    const hostile = [
      [frame!],
      [visual!, { ...visual!, message: `${visual!.message} forged` }, frame!],
      [frame!, visual!],
      [{ ...visual!, code: "run-incomplete" }, frame!],
      [{ ...visual!, stage: "validation" }, frame!],
      [{ ...visual!, stepNumber: 2 }, frame!],
      [{ ...visual!, message: `${visual!.message} forged` }, frame!],
    ];
    for (const completionFailures of hostile) {
      expect(() => verify(completionFailures)).toThrow(
        /full frozen completion-failure projection/u,
      );
    }
  });

  it("uses only frozen generation-2 predicates, independent of current finalizer evolution", () => {
    const localSources = [
      "real-build-artifact-legacy-browser-v2.ts",
      "real-build-artifact-legacy-browser-v2-report.ts",
      "real-build-artifact-legacy-browser-v2-values.ts",
      "real-build-artifact-legacy-completion-projection.ts",
      "real-build-artifact-legacy-document-v2.ts",
      "real-build-artifact-legacy-farther-v2.ts",
      "real-build-artifact-legacy-farther-v2-evidence.ts",
      "real-build-artifact-legacy-farther-v2-support.ts",
      "real-build-artifact-legacy-report-predicates.ts",
      "real-build-artifact-legacy-identity-predicates.ts",
      "real-build-artifact-legacy-score-verification.ts",
    ]
      .map((file) => readFileSync(join(process.cwd(), "apps", "web", "e2e", file), "utf8"))
      .join("\n");
    expect(localSources).not.toMatch(/from ["']\.\/real-build-finalize/u);
    expect(localSources).not.toMatch(/auditRealBuild(?:ReportEvidence|IdentityBindings)/u);
    expect(localSources).not.toMatch(/from ["']\.\/real-build-browser-output["']/u);
    expect(localSources).not.toMatch(
      /from ["']\.\/real-build-farther-(?:report-parser|origin-policy|tandem-parser)["']/u,
    );
    expect(localSources).not.toMatch(/\bisAtomicStepComplete\b/u);
    expect(localSources).not.toMatch(/REPORT_KEYS\.filter/u);

    const replaySource = readFileSync(
      join(process.cwd(), "apps", "web", "e2e", "real-build-replay.ts"),
      "utf8",
    );
    expect(replaySource).toContain("inspectFrozenLegacyBrowserOutputV2(browserOutput");

    interface MutableLegacyFixture {
      reports: {
        pageNumber: number;
        prerequisites: { calloutPieces: number };
        attemptedPieces: number;
        expectedAssembledPieces: number;
        pieces: { catalogPartId: string; blind: { comparisonPrefixHash: string } }[];
        outcome: { mechanism: string };
        elapsedMs: number;
        validation: { failure: string | null };
        farther: { decision: { originCandidateId: string } };
      }[];
      identityBindings: { materialId: string }[];
    }
    const fixture = legacyFixture();
    const project = (mutate: (value: MutableLegacyFixture) => void) => {
      const output = structuredClone(fixture.browserOutput) as unknown as MutableLegacyFixture;
      mutate(output);
      return projectLegacyRealBuildCompletionFailuresV4({
        output: output as never,
        options: replayOptions,
        diagnosticDocument: JSON.parse(fixture.browserOutput.documentJson),
      });
    };
    expect(project(() => undefined)).toEqual(fixture.score.completionFailures);
    const hostileMutations: readonly ((value: MutableLegacyFixture) => void)[] = [
      (value) => void (value.reports[0]!.pageNumber += 1),
      (value) => void (value.reports[0]!.prerequisites.calloutPieces += 1),
      (value) => void (value.reports[0]!.attemptedPieces += 1),
      (value) => void (value.reports[0]!.expectedAssembledPieces += 1),
      (value) => void (value.reports[0]!.pieces[0]!.catalogPartId = "forged"),
      (value) => void (value.reports[0]!.pieces[0]!.blind.comparisonPrefixHash = "forged"),
      (value) => void (value.reports[0]!.outcome.mechanism = "official-ledger"),
      (value) => void (value.reports[0]!.elapsedMs = -1),
      (value) => void (value.reports[0]!.validation.failure = "forged"),
      (value) => void (value.reports[0]!.farther.decision.originCandidateId = "origin-b"),
      (value) => void (value.identityBindings[0]!.materialId = "forged"),
    ];
    for (const mutate of hostileMutations) {
      expect(() => project(mutate)).toThrow(/frozen (?:\/2 predicate|finalizer)/u);
    }
  });

  it("rejects browser /2 schema and farther evolution independently of current /3", () => {
    const fixture = legacyFixture();
    expect(inspectFrozenLegacyBrowserOutputV2(fixture.browserOutput, replayOptions)).toBe(
      fixture.browserOutput,
    );
    const panelCamera = structuredClone(fixture.browserOutput) as Record<string, unknown> & {
      reports: Record<string, unknown>[];
    };
    panelCamera.reports[0]!.panelCamera = null;
    expect(() => inspectFrozenLegacyBrowserOutputV2(panelCamera, replayOptions)).toThrow(
      /frozen exact schema/u,
    );

    const farther = structuredClone(fixture.browserOutput) as unknown as MutableLegacyBrowserOutput;
    farther.reports[0]!.farther!.decision!.revealingStepNumber = 3;
    expect(() => inspectFrozenLegacyBrowserOutputV2(farther, replayOptions)).toThrow(
      /farther decision/u,
    );

    const capture = structuredClone(fixture.browserOutput) as unknown as MutableLegacyBrowserOutput;
    Object.assign(capture.reports[0]!.fartherCaptures[0]!, { evolvingField: true });
    expect(() => inspectFrozenLegacyBrowserOutputV2(capture, replayOptions)).toThrow(
      /captures differ/u,
    );
  });

  it("fails closed when the reviewed additive catalog bridge is no longer exact", () => {
    const fixture = legacyFixture();
    const document = JSON.parse(fixture.browserOutput.documentJson) as BrickDocumentV1;
    expect(document.truth.catalog.version).toBe("builtin.basic-parts/13");
    expect(document.constraints.allowedCatalogPartIds).toHaveLength(85);
    expect(document.constraints.allowedCatalogPartIds).not.toContain(
      "builtin:tile-1x1-quarter-round",
    );
    const active = createFrozenLegacyAdditiveCatalogBasisV26();
    const driftedTruth = structuredClone(active) as MutableCatalogCompatibilityBasis;
    driftedTruth.truth = {
      ...driftedTruth.truth,
      catalog: { ...driftedTruth.truth.catalog, hash: REAL_BUILD_TEST_DIGEST },
    };
    expect(() => assertFrozenLegacyAdditiveCatalogV2(document, driftedTruth)).toThrow(
      /exact reviewed additive catalog successor/u,
    );

    const semanticDrift = structuredClone(active) as MutableCatalogCompatibilityBasis;
    semanticDrift.validatorSemanticsHash = REAL_BUILD_TEST_DIGEST;
    expect(() => assertFrozenLegacyAdditiveCatalogV2(document, semanticDrift)).toThrow(
      /existing catalog interpretation moved/u,
    );

    const nonAdditive = structuredClone(active) as MutableCatalogCompatibilityBasis;
    nonAdditive.constraints.allowedCatalogPartIds[0] = "builtin:forged-reinterpretation";
    expect(() => assertFrozenLegacyAdditiveCatalogV2(document, nonAdditive)).toThrow(
      /exact 85-part predecessor/u,
    );

    const reordered = structuredClone(document) as BrickDocumentV1 & {
      constraints: { allowedCatalogPartIds: string[]; allowedColorIds: string[] };
    };
    reordered.constraints.allowedCatalogPartIds.reverse();
    reordered.constraints.allowedColorIds.reverse();
    expect(() => assertFrozenLegacyAdditiveCatalogV2(reordered)).not.toThrow();

    const duplicate = structuredClone(document) as BrickDocumentV1 & {
      constraints: { allowedCatalogPartIds: string[] };
    };
    duplicate.constraints.allowedCatalogPartIds[0] =
      duplicate.constraints.allowedCatalogPartIds[1]!;
    expect(() => assertFrozenLegacyAdditiveCatalogV2(duplicate)).toThrow(
      /exact 85-part predecessor/u,
    );

    const duplicateColor = structuredClone(document) as BrickDocumentV1 & {
      constraints: { allowedColorIds: string[] };
    };
    duplicateColor.constraints.allowedColorIds[0] = duplicateColor.constraints.allowedColorIds[1]!;
    expect(() => assertFrozenLegacyAdditiveCatalogV2(duplicateColor)).toThrow(
      /exact 85-part predecessor/u,
    );

    const addedPart = structuredClone(document) as unknown as MutableLegacyDocument;
    addedPart.parts[0]!.catalogPartId = "builtin:tile-1x1-quarter-round";
    expect(() =>
      assertFrozenLegacyAdditiveCatalogV2(addedPart as unknown as BrickDocumentV1),
    ).toThrow(/did not exist in frozen catalog \/13/u);

    const secondAddedPart = structuredClone(document) as unknown as MutableLegacyDocument;
    secondAddedPart.parts[0]!.catalogPartId = "builtin:bracket-1x2-1x4-rounded-bottom";
    expect(() =>
      assertFrozenLegacyAdditiveCatalogV2(secondAddedPart as unknown as BrickDocumentV1),
    ).toThrow(/did not exist in frozen catalog \/13/u);
  });

  it("replays frozen semantic validation for rehashed connection, membership, region, and transform attacks", () => {
    const fixture = legacyFixture();
    const projectMutation = (mutate: (document: MutableLegacyDocument) => void) => {
      const output = structuredClone(
        fixture.browserOutput,
      ) as unknown as MutableLegacyBrowserOutput;
      const document = JSON.parse(output.documentJson) as BrickDocumentV1 & MutableLegacyDocument;
      mutate(document);
      const structuralHash = documentStructuralHash(document);
      output.documentJson = JSON.stringify(document);
      output.reports[0]!.validation.targetDocumentHash = structuralHash;
      output.reports[0]!.farther!.origin.candidates[0]!.documentHash = structuralHash;
      return projectLegacyRealBuildCompletionFailuresV4({
        output: output as never,
        options: replayOptions,
        diagnosticDocument: document,
      });
    };
    const mutations: readonly ((document: MutableLegacyDocument) => void)[] = [
      (document) => void document.connections.splice(0),
      (document) => void document.submodels[0]!.partIds.splice(0, 1),
      (document) =>
        void document.semanticRegions.push({
          id: "forged-region",
          label: "forged region",
          partIds: ["missing-part"],
        }),
      (document) => void (document.parts[0]!.transform.orientationId = "forged-orientation"),
    ];
    for (const mutate of mutations) {
      expect(() => projectMutation(mutate)).toThrow(/not globally valid/u);
    }
    expect(() =>
      projectMutation((document) => {
        for (const part of document.parts) part.transform.positionLdu[0] += 20;
      }),
    ).toThrow(/transform multiset/u);

    const stale = structuredClone(fixture.browserOutput) as unknown as MutableLegacyBrowserOutput;
    stale.reports[0]!.validation.targetDocumentHash = REAL_BUILD_TEST_DIGEST;
    stale.reports[0]!.farther!.origin.candidates[0]!.documentHash = REAL_BUILD_TEST_DIGEST;
    expect(() =>
      projectLegacyRealBuildCompletionFailuresV4({
        output: stale as never,
        options: replayOptions,
        diagnosticDocument: JSON.parse(stale.documentJson),
      }),
    ).toThrow(/structural hash/u);
  });

  it("freezes unordered duplicate transform multisets and fixed-ledger transforms", () => {
    const fixture = legacyFixture();
    const panel = structuredClone(replayOptions.panels[0]!);
    if (panel.action.kind !== "place-callouts" || panel.pieces.length !== 2) {
      throw new TypeError("Legacy identity predicate test requires two direct pieces.");
    }
    const first = panel.pieces[0]!;
    const second = {
      ...panel.pieces[1]!,
      designId: first.designId,
      materialId: first.materialId,
      catalogPartId: first.catalogPartId,
      colorId: first.colorId,
    };
    const duplicatePanel = { ...panel, pieces: [first, second] };
    const output = structuredClone(fixture.browserOutput) as unknown as {
      reports: {
        pieces: { catalogPartId: string }[];
      }[];
      identityBindings: {
        identityKey: string;
        partId: string;
        stepNumber: number;
        designId: string;
        materialId: string;
        catalogPartId: string;
        colorId: string;
      }[];
    };
    const document = JSON.parse(fixture.browserOutput.documentJson) as {
      parts: {
        id: string;
        catalogPartId: string;
        colorId: string;
        transform: { positionLdu: [number, number, number]; orientationId: string };
      }[];
    };
    output.reports[0]!.pieces[1]!.catalogPartId = first.catalogPartId;
    Object.assign(output.identityBindings[1]!, {
      designId: first.designId,
      materialId: first.materialId,
      catalogPartId: first.catalogPartId,
      colorId: first.colorId,
    });
    Object.assign(document.parts[1]!, {
      catalogPartId: first.catalogPartId,
      colorId: first.colorId,
    });
    const firstPartId = output.identityBindings[0]!.partId;
    output.identityBindings[0]!.partId = output.identityBindings[1]!.partId;
    output.identityBindings[1]!.partId = firstPartId;
    const assertIdentity = (selectedPanel: unknown) =>
      assertFrozenLegacyIdentityProjectionV2({
        panels: [selectedPanel] as never,
        reports: output.reports as never,
        document: document as never,
        bindings: output.identityBindings,
      });
    expect(() => assertIdentity(duplicatePanel)).not.toThrow();

    const fixedPanel = {
      ...duplicatePanel,
      action: {
        kind: "multi-build-copy" as const,
        assembledPieces: 2,
        sourceStepNumber: 1,
        evidenceDigest: REAL_BUILD_TEST_DIGEST,
        copies: [first, second].map((piece, index) => ({
          identityKey: piece.identityKey,
          sourceIdentityKey: `source-${index}`,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          evidenceDigest: REAL_BUILD_TEST_DIGEST,
          transform: {
            positionLdu: [...document.parts[index]!.transform.positionLdu] as [
              number,
              number,
              number,
            ],
            orientationId: document.parts[index]!.transform.orientationId,
          },
        })),
      },
    };
    expect(() => assertIdentity(fixedPanel)).not.toThrow();
    fixedPanel.action.copies[0]!.transform.positionLdu[0] += 20;
    expect(() => assertIdentity(fixedPanel)).toThrow(/transform multiset/u);
  });

  it.skipIf(!existsSync(RETAINED_PRODUCTION_RUN))(
    "keeps frozen inspection of the exact ignored production generation when it is locally available",
    () => {
      expect(() => verifyRealBuildArtifactManifest(RETAINED_PRODUCTION_RUN)).toThrow(
        /exact schema \/4/u,
      );
      expect(() => inspectLegacyRealBuildArtifactManifestV3(RETAINED_PRODUCTION_RUN)).toThrow(
        /Catalog coverage declares schema "lego\.real-build-catalog-coverage\/1"[\s\S]*accepts current lego\.real-build-catalog-coverage\/3 or frozen legacy lego\.real-build-catalog-coverage\/2 bytes only/u,
      );

      const replayClosureBytes = readContainedBoundedRegularFile(
        RETAINED_PRODUCTION_RUN,
        "replay-closure.json",
        {
          label: "exact retained production replay closure",
          maximumBytes: RETAINED_PRODUCTION_REPLAY_CLOSURE.bytes,
          exactBytes: RETAINED_PRODUCTION_REPLAY_CLOSURE.bytes,
          expectedSha256: RETAINED_PRODUCTION_REPLAY_CLOSURE.digest,
        },
      );
      expect(JSON.parse(replayClosureBytes.toString("utf8"))).toMatchObject({
        manifestDigest: RETAINED_PRODUCTION_REPLAY_CLOSURE.manifestDigest,
        roles: expect.arrayContaining(
          Object.entries(RETAINED_PRODUCTION_REPLAY_ROLES).map(([role, pin]) => ({
            role,
            bytes: pin.bytes,
            digest: pin.digest,
            casPath: retainedCasPath(pin.digest),
          })),
        ),
      });
      const readFrozenRole = (role: keyof typeof RETAINED_PRODUCTION_REPLAY_ROLES) => {
        const pin = RETAINED_PRODUCTION_REPLAY_ROLES[role];
        const bytes = readContainedBoundedRegularFile(
          RETAINED_PRODUCTION_RUN,
          retainedCasPath(pin.digest),
          {
            label: `exact retained replay role ${role}`,
            maximumBytes: pin.bytes,
            exactBytes: pin.bytes,
            expectedSha256: pin.digest,
          },
        );
        return JSON.parse(bytes.toString("utf8"));
      };
      const preparedOptions = readFrozenRole("prepared-options");
      const browserOutput = readFrozenRole("browser-output");
      expect(inspectFrozenLegacyBrowserOutputV2(browserOutput, preparedOptions)).toBe(
        browserOutput,
      );
      const diagnosticDocument = JSON.parse(
        readContainedBoundedRegularFile(RETAINED_PRODUCTION_RUN, "diagnostic-prefix.json", {
          label: "exact retained diagnostic prefix",
          maximumBytes: RETAINED_PRODUCTION_DIAGNOSTIC_PREFIX.bytes,
          exactBytes: RETAINED_PRODUCTION_DIAGNOSTIC_PREFIX.bytes,
          expectedSha256: RETAINED_PRODUCTION_DIAGNOSTIC_PREFIX.digest,
        }).toString("utf8"),
      );
      const projectedFailures = projectLegacyRealBuildCompletionFailuresV4({
        output: browserOutput,
        options: preparedOptions,
        diagnosticDocument,
      });
      expect(projectedFailures.map(({ code }) => code)).toEqual([
        "run-incomplete",
        "visual-evidence-unverified",
        "visual-evidence-unverified",
        "visual-evidence-unverified",
        "visual-evidence-unverified",
        "visual-evidence-unverified",
        "official-frame-calibration-missing",
      ]);
    },
    120_000,
  );
});
