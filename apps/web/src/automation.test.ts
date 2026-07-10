import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, validateBrickDocument } from "@lego-studio/brick-kernel";

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
});
