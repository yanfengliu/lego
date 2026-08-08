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

  it("reports the live viewport packet against the same document its validation covers", () => {
    const empty = createEmptyBrickDocument({ id: "automation-base", name: "Base" });
    const addition = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const document = applyBuildOperations(empty, addition.operations);
    const documentHash = documentStructuralHash(document);
    const validationReport = validateBrickDocument(document);
    const scene = deriveBrickScene(document, { validationReport });
    const viewPacket = createCanonicalViewPacket(scene);
    const state: AutomationAppState = {
      document,
      selectedPartId: addition.partId,
      validationReport,
      commandError: null,
    };
    const viewport: BrickViewportHandle = {
      getSnapshot: () => ({
        contextLost: false,
        viewPacket,
        rendererMemory: { geometries: 0, textures: 0 },
      }),
      captureCanonicalViews: async () => ({}),
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
    expect(observation.renderer.viewPacket.documentHash).toBe(documentHash);
    expect(observation.selection).toEqual({ partId: addition.partId });

    cleanup();
    scene.dispose();
  });
});
