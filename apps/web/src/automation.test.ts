import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { createCanonicalViewPacket, deriveBrickScene } from "@lego-studio/rendering";

import type { BrickViewportHandle } from "./components/BrickViewport";
import { compileLocalPromptPreview } from "./local-assistant";
import {
  installAutomationBridge,
  type AutomationAppState,
  type AutomationBridgeTarget,
} from "./automation";

describe("browser automation bridge", () => {
  it("exposes deterministic structured state without granting document mutation", async () => {
    const document = createEmptyBrickDocument({ id: "automation", name: "Automation" });
    const state: AutomationAppState = {
      document,
      selectedPartId: null,
      validationReport: validateBrickDocument(document),
      candidateValidation: null,
      activeJob: null,
      candidatePopulation: [],
      candidate: null,
      commandError: null,
    };
    const target: AutomationBridgeTarget = {};
    const cleanup = installAutomationBridge(
      target,
      () => state,
      () => null,
    );

    expect(JSON.parse(target.render_app_to_text!())).toMatchObject({
      schemaVersion: "lego.app-observation/1",
      documentHash: expect.stringMatching(/^sha256:/),
      activeJob: null,
      selection: { partId: null },
    });
    expect(target.get_model_snapshot!()).toMatchObject({
      schemaVersion: "lego.model-snapshot/1",
      documentId: "automation",
      partCount: 0,
      documentGloballyValid: true,
    });
    await expect(target.capture_model_views!()).resolves.toEqual({});
    await expect(target.advanceTime!(16)).resolves.toEqual(target.get_model_snapshot!());
    await expect(target.advanceTime!(-1)).rejects.toThrow(RangeError);

    cleanup();
    expect(target).toEqual({});
  });

  it("keeps base validation separate while candidate validation and preview pixels agree", () => {
    const document = createEmptyBrickDocument({ id: "automation-base", name: "Base" });
    const compiled = compileLocalPromptPreview(document, "Build a 4 level tower");
    if (!compiled.result.ok) throw new Error(JSON.stringify(compiled.result.issues));
    const candidateDocument = compiled.result.document;
    const candidateValidation = compiled.result.validationReport;
    const candidateHash = documentStructuralHash(candidateDocument);
    const scene = deriveBrickScene(candidateDocument, { validationReport: candidateValidation });
    const viewPacket = createCanonicalViewPacket(scene);
    const candidate = {
      candidateId: "candidate-automation",
      state: "preview" as const,
      documentHash: candidateHash,
      operationCount: compiled.result.patch.operations.length,
      failureCodes: [],
      rank: 1,
      metrics: null,
      lineage: { parentCandidateId: null, strategyId: "test" },
    };
    const state: AutomationAppState = {
      document,
      selectedPartId: null,
      validationReport: validateBrickDocument(document),
      candidateValidation,
      activeJob: {
        jobId: "automation-job",
        state: "ready",
        baseRevision: document.revision,
        baseDocumentHash: documentStructuralHash(document),
        verificationDurationMs: 1,
      },
      candidatePopulation: [candidate],
      candidate,
      commandError: null,
    };
    const viewport: BrickViewportHandle = {
      getSnapshot: () => ({
        contextLost: false,
        viewPacket,
        rendererMemory: { geometries: 0, textures: 0 },
      }),
      captureCanonicalViews: async () => ({}),
    };
    const target: AutomationBridgeTarget = {};
    const cleanup = installAutomationBridge(
      target,
      () => state,
      () => viewport,
    );
    const observation = JSON.parse(target.render_app_to_text!());

    expect(observation.validation.targetDocumentHash).toBe(documentStructuralHash(document));
    expect(observation.candidate.documentHash).toBe(candidateHash);
    expect(observation.candidateValidation.targetDocumentHash).toBe(candidateHash);
    expect(observation.renderer.viewPacket.documentHash).toBe(candidateHash);

    cleanup();
    scene.dispose();
  });
});
