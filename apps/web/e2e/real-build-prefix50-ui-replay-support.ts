import { createHash } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import {
  applyBuildOperations,
  canonicalBrickDocument,
  canonicalDigest,
  documentStructuralHash,
  validateBrickDocument,
  type BuildPlaybackTraceV1,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  rawPrimaryProjectCommitment,
  type RawStoredProjectCommitment,
} from "./real-build-prefix50-raw-project";

export interface AppObservation {
  readonly document: BrickDocumentV1;
  readonly documentHash: string;
  readonly canonicalDocumentDigest: `sha256:${string}`;
  readonly validation: {
    readonly documentGloballyValid: boolean;
    readonly targetDocumentHash: string;
    readonly issues: readonly { readonly severity: string; readonly code: string }[];
  };
  readonly playback: {
    readonly position: number;
    readonly terminalPosition: number;
    readonly stepId: string | null;
    readonly stepName: string;
    readonly addedPartCount: number;
    readonly previewDocumentHash: string;
    readonly validation: {
      readonly documentGloballyValid: boolean;
      readonly targetDocumentHash: string;
      readonly issues: readonly { readonly severity: string; readonly code: string }[];
    };
    readonly blockingCodes: readonly string[];
    readonly buildable: boolean;
    readonly connected: boolean;
    readonly exact: boolean;
    readonly mode: "membership-preview" | "operation-trace-exact";
    readonly traceCommitment: `sha256:${string}` | null;
  } | null;
  readonly renderer: {
    readonly contextLost: boolean;
    readonly viewPacket: { readonly documentHash: string } | null;
  } | null;
}

export interface PlaybackCommitment {
  readonly completedPrintedStep: number;
  readonly partCount: number;
  readonly addedPartCount: number;
  readonly stepId: string | null;
  readonly stepName: string;
  readonly documentHash: string;
  readonly canonicalDocumentDigest: string;
  readonly partIds: readonly string[];
  readonly verdict: "trace-valid" | "trace-valid subassembly";
  readonly blockingCodes: readonly string[];
  readonly buildable: boolean;
  readonly connected: boolean;
  readonly exact: true;
  readonly mode: "operation-trace-exact";
  readonly traceCommitment: `sha256:${string}`;
}

interface StoredProjectObservation {
  readonly generation: number;
  readonly documentHash: string;
  readonly snapshotHash: string;
  readonly document: BrickDocumentV1;
  readonly playbackTrace: BuildPlaybackTraceV1 | null;
}

export async function appObservation(page: Page): Promise<AppObservation> {
  return page.evaluate(() => JSON.parse(window.render_app_to_text!()) as AppObservation);
}

async function primaryProjectGeneration(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    const repositoryModulePath = "/src/persistence/indexeddb-project-repository.ts";
    const { IndexedDbProjectRepository } = await import(/* @vite-ignore */ repositoryModulePath);
    const repository = new IndexedDbProjectRepository(indexedDB, "brick-studio");
    try {
      return (await repository.load("primary-project"))?.generation ?? null;
    } finally {
      await repository.close();
    }
  });
}

async function readPrimaryProject(page: Page): Promise<StoredProjectObservation | null> {
  return page.evaluate(async () => {
    const repositoryModulePath = "/src/persistence/indexeddb-project-repository.ts";
    const { IndexedDbProjectRepository } = await import(/* @vite-ignore */ repositoryModulePath);
    const repository = new IndexedDbProjectRepository(indexedDB, "brick-studio");
    try {
      const stored = await repository.load("primary-project");
      return stored === null
        ? null
        : {
            generation: stored.generation,
            documentHash: stored.documentHash,
            snapshotHash: stored.snapshotHash,
            document: stored.state.document,
            playbackTrace: stored.state.playbackTrace,
          };
    } finally {
      await repository.close();
    }
  });
}

function canonicalDocumentDigest(document: BrickDocumentV1): string {
  return `sha256:${createHash("sha256").update(canonicalBrickDocument(document)).digest("hex")}`;
}

function expectStoredProjectExact(
  stored: StoredProjectObservation | null,
  expectedDocument: BrickDocumentV1,
  expectedGeneration: number,
  label: string,
  expectedTrace: BuildPlaybackTraceV1 | null = null,
): asserts stored is StoredProjectObservation {
  expect(stored, `${label} project row`).not.toBeNull();
  if (stored === null) throw new Error(`${label} primary-project row is absent.`);
  expect(stored.generation, `${label} generation`).toBe(expectedGeneration);
  expect(stored.documentHash, `${label} stored document hash`).toBe(
    canonicalDigest(stored.document),
  );
  expect(stored.snapshotHash, `${label} stored snapshot hash`).toMatch(/^sha256:[0-9a-f]{64}$/u);
  const expectedCanonical = canonicalBrickDocument(expectedDocument);
  const actualCanonical = canonicalBrickDocument(stored.document);
  expect(actualCanonical.length, `${label} canonical byte length`).toBe(expectedCanonical.length);
  expect(canonicalDocumentDigest(stored.document), `${label} canonical digest`).toBe(
    canonicalDocumentDigest(expectedDocument),
  );
  if (actualCanonical !== expectedCanonical) {
    throw new Error(
      `${label} stored canonical document bytes differ despite the preceding bounded digest checks.`,
    );
  }
  expect(
    stored.playbackTrace === null ? null : canonicalDigest(stored.playbackTrace),
    `${label} persisted playback trace`,
  ).toBe(expectedTrace === null ? null : canonicalDigest(expectedTrace));
}

export async function expectPrimaryProjectExact(
  page: Page,
  expectedDocument: BrickDocumentV1,
  expectedGeneration: number,
  label: string,
  expectedTrace: BuildPlaybackTraceV1 | null = null,
): Promise<void> {
  expectStoredProjectExact(
    await readPrimaryProject(page),
    expectedDocument,
    expectedGeneration,
    label,
    expectedTrace,
  );
}

export async function savePrimaryProjectAndReload(
  page: Page,
  document: BrickDocumentV1,
  expectedGeneration: number,
  label: string,
  playbackTrace: BuildPlaybackTraceV1 | null = null,
): Promise<number> {
  const saved = await page.evaluate(
    async ({ compiledDocument, generation, playbackTrace }) => {
      const repositoryModulePath = "/src/persistence/indexeddb-project-repository.ts";
      const editorStateModulePath = "/src/editor-state.ts";
      const [{ IndexedDbProjectRepository }, { createEditorState }] = await Promise.all([
        import(/* @vite-ignore */ repositoryModulePath),
        import(/* @vite-ignore */ editorStateModulePath),
      ]);
      const repository = new IndexedDbProjectRepository(indexedDB, "brick-studio");
      try {
        const current = await repository.load("primary-project");
        if (current === null) {
          throw new Error("The app did not create the normal primary-project persistence row.");
        }
        if (current.generation !== generation) {
          throw new Error(
            `Primary-project replacement expected generation ${generation}, found ${current.generation}.`,
          );
        }
        const next = await repository.save(
          "primary-project",
          createEditorState(compiledDocument, playbackTrace),
          generation,
        );
        return {
          generation: next.generation,
          documentHash: next.documentHash,
          snapshotHash: next.snapshotHash,
          document: next.state.document,
          playbackTrace: next.state.playbackTrace,
        };
      } finally {
        await repository.close();
      }
    },
    { compiledDocument: document, generation: expectedGeneration, playbackTrace },
  );
  const nextGeneration = expectedGeneration + 1;
  expectStoredProjectExact(
    saved,
    document,
    nextGeneration,
    `${label} before reload`,
    playbackTrace,
  );

  await page.reload();
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  await expect(
    page.getByText(`${document.parts.length} parts · saved locally`, { exact: true }),
  ).toBeVisible();
  await expect.poll(() => primaryProjectGeneration(page)).toBe(nextGeneration);
  const expectedReport = validateBrickDocument(document);
  await expect
    .poll(() => page.evaluate(() => window.get_model_snapshot!()))
    .toMatchObject({
      partCount: document.parts.length,
      documentGloballyValid: expectedReport.documentGloballyValid,
      structuralHash: documentStructuralHash(document),
    });
  await expectPrimaryProjectExact(
    page,
    document,
    nextGeneration,
    `${label} after reload`,
    playbackTrace,
  );
  return nextGeneration;
}

export async function seedPrimaryProject(
  page: Page,
  document: BrickDocumentV1,
  playbackTrace: BuildPlaybackTraceV1,
): Promise<RawStoredProjectCommitment> {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
  await expect(page.getByText("0 parts · saved locally")).toBeVisible();
  await expect.poll(() => primaryProjectGeneration(page)).toBe(1);
  expect(
    await savePrimaryProjectAndReload(page, document, 1, "compiled Step50 seed", playbackTrace),
  ).toBe(2);
  return rawPrimaryProjectCommitment(page);
}

/** Independent operation-replay oracle: do not reuse App's trace derivation. */
export function independentPlaybackCommitments(
  document: BrickDocumentV1,
  trace: BuildPlaybackTraceV1,
): readonly PlaybackCommitment[] {
  const traceBody: Record<string, unknown> = { ...trace };
  delete traceBody.traceCommitment;
  if (
    trace.authority !== "none" ||
    trace.transitions.length !== 50 ||
    trace.traceCommitment !== canonicalDigest(traceBody) ||
    documentStructuralHash(trace.baseDocument) !== trace.baseDocumentHash
  ) {
    throw new Error("Compiled playback oracle requires one intact authority-free 50-step trace.");
  }
  let current = trace.baseDocument;
  const commitments: PlaybackCommitment[] = [];
  const record = (input: {
    readonly completedPrintedStep: number;
    readonly stepId: string | null;
    readonly stepName: string;
    readonly addedPartIds: readonly string[];
  }): void => {
    const report = validateBrickDocument(current);
    const blockingCodes = [
      ...new Set(
        report.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code),
      ),
    ].sort();
    const unexpectedBlockingCodes = blockingCodes.filter(
      (code) => code !== "DISCONNECTED_ASSEMBLY",
    );
    if (unexpectedBlockingCodes.length > 0) {
      throw new Error(
        `Playback transition ${input.completedPrintedStep} has hard blocking codes ${unexpectedBlockingCodes.join(", ")}.`,
      );
    }
    const documentHash = documentStructuralHash(current);
    if (report.targetDocumentHash !== documentHash) {
      throw new Error(`Playback transition ${input.completedPrintedStep} targets the wrong graph.`);
    }
    commitments.push({
      completedPrintedStep: input.completedPrintedStep,
      partCount: current.parts.length,
      addedPartCount: input.addedPartIds.length,
      partIds: current.parts.map(({ id }) => id).sort(),
      stepId: input.stepId,
      stepName: input.stepName,
      documentHash,
      canonicalDocumentDigest: canonicalDigest(current),
      verdict: blockingCodes.includes("DISCONNECTED_ASSEMBLY")
        ? "trace-valid subassembly"
        : "trace-valid",
      blockingCodes,
      buildable: unexpectedBlockingCodes.length === 0,
      connected: !blockingCodes.includes("DISCONNECTED_ASSEMBLY"),
      exact: true,
      mode: "operation-trace-exact",
      traceCommitment: trace.traceCommitment,
    });
  };
  record({ completedPrintedStep: 0, stepId: null, stepName: "Empty base", addedPartIds: [] });
  for (const [position, transition] of trace.transitions.entries()) {
    if (
      transition.beforeDocumentHash !== documentStructuralHash(current) ||
      transition.beforeDocumentCanonicalDigest !== canonicalDigest(current)
    ) {
      throw new Error(`Playback transition ${position + 1} before hash drifted.`);
    }
    const priorIds = new Set(current.parts.map(({ id }) => id));
    for (const operations of transition.operationGroups) {
      current = applyBuildOperations(current, operations);
    }
    const addedIds = current.parts
      .filter(({ id }) => !priorIds.has(id))
      .map(({ id }) => id)
      .sort();
    if (
      transition.stepIndex !== position ||
      transition.afterDocumentHash !== documentStructuralHash(current) ||
      transition.afterDocumentCanonicalDigest !== canonicalDigest(current) ||
      transition.addedPartIds.length !== addedIds.length ||
      transition.addedPartIds.some((partId, index) => partId !== addedIds[index])
    ) {
      throw new Error(`Playback transition ${position + 1} replay commitment drifted.`);
    }
    record({
      completedPrintedStep: position + 1,
      stepId: transition.stepId,
      stepName: transition.stepName,
      addedPartIds: addedIds,
    });
  }
  if (
    documentStructuralHash(current) !== trace.targetDocumentHash ||
    trace.targetDocumentHash !== documentStructuralHash(document) ||
    canonicalBrickDocument(current) !== canonicalBrickDocument(document)
  ) {
    throw new Error("Playback trace did not reproduce the exact authored final document bytes.");
  }
  return commitments;
}

export async function expectPlaybackPosition(
  page: Page,
  commitments: readonly PlaybackCommitment[],
  position: number,
): Promise<void> {
  const expected = commitments[position];
  if (expected === undefined)
    throw new Error(`Missing playback commitment at position ${position}.`);

  const scrubber = page.locator(".playback-scrubber input");
  await expect(scrubber).toHaveValue(String(position));
  await expect(page.locator(".playback-readout strong")).toHaveText(
    position === 0 ? "Start" : expected.stepName,
  );
  await expect(page.locator(".playback-readout small")).toHaveText(
    `${position} / 50 · ${expected.partCount} parts${expected.addedPartCount > 0 ? ` · +${expected.addedPartCount}` : ""}`,
  );
  await expect(page.locator(".playback-verdict")).toHaveText(expected.verdict);
  await expect
    .poll(async () => (await appObservation(page)).playback)
    .toMatchObject({
      position,
      terminalPosition: 50,
      stepId: expected.stepId,
      stepName: expected.stepName,
      addedPartCount: expected.addedPartCount,
      previewDocumentHash: expected.documentHash,
      validation: { targetDocumentHash: expected.documentHash },
      blockingCodes: expected.blockingCodes,
      buildable: expected.buildable,
      connected: expected.connected,
      exact: true,
      mode: "operation-trace-exact",
      traceCommitment: expected.traceCommitment,
    });
  await expect
    .poll(async () => (await appObservation(page)).renderer?.viewPacket?.documentHash ?? null)
    .toBe(expected.documentHash);
  const playback = (await appObservation(page)).playback;
  expect(playback).not.toBeNull();
  expect(
    playback?.validation.issues
      .filter(({ severity }) => severity === "blocking")
      .map(({ code }) => code)
      .sort(),
  ).toEqual(expected.blockingCodes);
}

export async function expectPlaybackDidNotPersist(input: {
  readonly page: Page;
  readonly commitments: readonly PlaybackCommitment[];
  readonly position: number;
  readonly authoredDocument: BrickDocumentV1;
  readonly playbackTrace: BuildPlaybackTraceV1;
  readonly expectedGeneration: number;
  readonly rawStoredProjectCommitment: RawStoredProjectCommitment;
}): Promise<void> {
  const {
    page,
    commitments,
    position,
    authoredDocument,
    playbackTrace,
    expectedGeneration,
    rawStoredProjectCommitment,
  } = input;
  const expectedPreview = commitments[position]!;
  const authoredHash = documentStructuralHash(authoredDocument);
  const authoredReport = validateBrickDocument(authoredDocument);
  const observation = await appObservation(page);
  expect(observation.documentHash).toBe(authoredHash);
  expect(observation.document.parts).toHaveLength(authoredDocument.parts.length);
  expect(observation.playback?.position).toBe(position);
  expect(observation.playback?.previewDocumentHash).toBe(expectedPreview.documentHash);
  expect(observation.renderer?.viewPacket?.documentHash).toBe(expectedPreview.documentHash);
  expect(await page.evaluate(() => window.get_model_snapshot!())).toMatchObject({
    partCount: authoredDocument.parts.length,
    structuralHash: authoredHash,
    documentGloballyValid: authoredReport.documentGloballyValid,
  });
  await expectPrimaryProjectExact(
    page,
    authoredDocument,
    expectedGeneration,
    `playback position ${position} persistence boundary`,
    playbackTrace,
  );
  expect(await rawPrimaryProjectCommitment(page)).toEqual(rawStoredProjectCommitment);
}
