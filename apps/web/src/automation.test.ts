import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  createEmptyBrickDocument,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { createCanonicalViewPacket, deriveBrickScene } from "@lego-studio/rendering";

import type { BrickViewportHandle } from "./components/BrickViewport";
import { createAddPartTransaction } from "./manual-commands";
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
      commandError: null,
      playback: null,
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
      selection: { partId: null },
      playback: null,
    });
    expect(target.get_model_snapshot!()).toMatchObject({
      schemaVersion: "lego.model-snapshot/1",
      documentId: "automation",
      partCount: 0,
      documentGloballyValid: true,
    });
    await expect(target.capture_model_views!()).resolves.toEqual({});
    await expect(
      target.capture_instruction_view!({
        scene: "model-only",
        renderMode: "instruction-art",
        backgroundHex: 0x899093,
        parameters: {
          azimuthDegrees: 30,
          elevationDegrees: 25,
          pixelsPerUnit: 10,
          centerXPx: 32,
          centerYPx: 24,
        },
        frame: { widthPx: 64, heightPx: 48, target: [0, 0, 0], sceneRadius: 1 },
      }),
    ).rejects.toThrow(/live viewport/u);
    await expect(target.advanceTime!(16)).resolves.toEqual(target.get_model_snapshot!());
    await expect(target.advanceTime!(-1)).rejects.toThrow(RangeError);

    cleanup();
    expect(target).toEqual({});
  });

  it("reports the live viewport packet against the playback preview while retaining the document", async () => {
    const empty = createEmptyBrickDocument({ id: "automation-base", name: "Base" });
    const addition = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const document = applyBuildOperations(empty, addition.operations);
    const documentHash = documentStructuralHash(document);
    const validationReport = validateBrickDocument(document);
    const previewDocument = empty;
    const previewValidationReport = validateBrickDocument(previewDocument);
    const previewHash = documentStructuralHash(previewDocument);
    const scene = deriveBrickScene(previewDocument, {
      validationReport: previewValidationReport,
    });
    const viewPacket = createCanonicalViewPacket(scene);
    const state: AutomationAppState = {
      document,
      selectedPartId: addition.partId,
      validationReport,
      commandError: null,
      playback: {
        position: 0,
        terminalPosition: 1,
        stepId: null,
        stepName: "Empty base",
        addedPartCount: 0,
        previewDocument,
        validationReport: previewValidationReport,
        blockingCodes: [],
        buildable: true,
        connected: true,
        exact: true,
        mode: "operation-trace-exact",
        traceCommitment: `sha256:${"a".repeat(64)}`,
      },
    };
    let captureScene: string | undefined;
    let instructionScene: string | undefined;
    const viewport: BrickViewportHandle = {
      getSnapshot: () => ({
        contextLost: false,
        viewPacket,
        rendererMemory: { geometries: 0, textures: 0 },
      }),
      captureCanonicalViews: async (options) => {
        captureScene = options?.scene;
        return {};
      },
      captureInstructionView: async (request) => {
        instructionScene = request.scene;
        return {
          scene: "model-only",
          renderMode: request.renderMode,
          semanticColorMask: null,
          backgroundHex: request.backgroundHex,
          width: request.frame.widthPx,
          height: request.frame.heightPx,
          pngDataUrl: "data:image/png;base64,AA==",
          parameters: request.parameters,
          frame: request.frame,
          projectionMatrix: [],
          matrixWorldInverse: [],
        };
      },
      beginMove: () => undefined,
    };
    const target: AutomationBridgeTarget = {};
    const cleanup = installAutomationBridge(
      target,
      () => state,
      () => viewport,
    );
    const observation = JSON.parse(target.render_app_to_text!());

    expect(observation.documentHash).toBe(documentHash);
    expect(observation.validation.targetDocumentHash).toBe(documentHash);
    expect(observation.playback).toMatchObject({
      position: 0,
      terminalPosition: 1,
      stepId: null,
      stepName: "Empty base",
      addedPartCount: 0,
      previewDocumentHash: previewHash,
      blockingCodes: [],
      buildable: true,
      connected: true,
    });
    expect(observation.playback.validation.targetDocumentHash).toBe(previewHash);
    expect(observation.renderer.viewPacket.documentHash).toBe(previewHash);
    expect(observation.selection).toEqual({ partId: addition.partId });
    await target.capture_model_views!({ scene: "model-only" });
    expect(captureScene).toBe("model-only");
    await target.capture_instruction_view!({
      scene: "model-only",
      renderMode: "instruction-art",
      backgroundHex: 0x899093,
      parameters: {
        azimuthDegrees: 30,
        elevationDegrees: 25,
        pixelsPerUnit: 10,
        centerXPx: 32,
        centerYPx: 24,
      },
      frame: { widthPx: 64, heightPx: 48, target: [0, 0, 0], sceneRadius: 1 },
    });
    expect(instructionScene).toBe("model-only");

    cleanup();
    scene.dispose();
  });
});
