import { describe, expect, it } from "vitest";

import {
  inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput,
  inspectRealBuildPreparedPanelFromRunInput,
  inspectRealBuildPreparedRunInput,
  inspectRealBuildPreparedStepInput,
  MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES,
  requireRealBuildPreparedPanelInspection,
  requireRealBuildPreparedBrowserOutputBoundaryInspection,
  requireRealBuildPreparedStepAuthority,
  requireRealBuildPreparedStepInspection,
} from "../e2e/real-build-prepared-step-authority";
import {
  preparedSearchOptions,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

describe("prepared real-build step prerequisite", () => {
  it("derives exact ordered physical identities from complete preflight-valid run bytes", () => {
    const inspection = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(2), 2);

    expect(inspection).toMatchObject({
      stepNumber: 2,
      authority: "absent",
      compilerMetadata: {
        name: "Printed step 2",
        sourceActionDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      expectedAtomicPieces: [
        {
          identityKey: "direct-0",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
        },
        {
          identityKey: "direct-1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
        },
      ],
    });
    expect(inspection.preparedRunInputDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(inspection.printedStepIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.expectedAtomicPieces)).toBe(true);
    expect(requireRealBuildPreparedStepInspection(inspection)).toBe(inspection);
  });

  it("binds full prepared input and the exact panel rather than a caller label", () => {
    const original = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 2);
    const mutated = preparedSearchOptions();
    const first = mutated.panels[1]!.pieces[0]!;
    const panels = [...mutated.panels];
    panels[1] = {
      ...panels[1]!,
      pieces: [{ ...first, identityKey: "direct-renamed" }],
    };
    const changed = inspectRealBuildPreparedStepInput(
      new TextEncoder().encode(JSON.stringify({ ...mutated, panels })),
      2,
    );

    expect(changed.expectedAtomicPieces[0]!.identityKey).toBe("direct-renamed");
    expect(changed.printedStepIdentity).not.toBe(original.printedStepIdentity);
    expect(changed.preparedRunInputDigest).not.toBe(original.preparedRunInputDigest);
  });

  it("derives reusable authority-free PDF, panel, crop, action, and piece facts from one parse", () => {
    const bytes = preparedSearchOptionsBytes(2);
    const run = inspectRealBuildPreparedRunInput(bytes);
    const panel = inspectRealBuildPreparedPanelFromRunInput(run, 2);
    const step = inspectRealBuildPreparedStepInput(bytes, 2);
    const expected = preparedSearchOptions(2).panels[1]!;

    expect(panel).toMatchObject({
      stepNumber: 2,
      preparedRunInputDigest: run.preparedRunInputDigest,
      placementPrintedStepIdentity: step.printedStepIdentity,
      pdfDigest: preparedSearchOptions(2).inputDigests.pdf,
      pageNumber: expected.pageNumber,
      panelFace: expected.panelFace,
      bounds: {
        minXPt: expected.minXPt,
        maxXPt: expected.maxXPt,
        minYPt: expected.minYPt,
        maxYPt: expected.maxYPt,
      },
      actionKind: "place-callouts",
      assembledPieces: 2,
      actionEvidenceDigest: expected.action.evidenceDigest,
      expectedAtomicPieces: step.expectedAtomicPieces,
      authority: "absent",
    });
    expect(panel.preparedPanelIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(panel.panelEvidenceDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(panel.cropDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(panel.actionDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(JSON.parse(panel.actionCanonicalJson)).toEqual(expected.action);
    expect(Object.isFrozen(panel)).toBe(true);
    expect(Object.isFrozen(panel.bounds)).toBe(true);
    expect(Object.isFrozen(panel.calloutBoxes)).toBe(true);
    expect(Object.isFrozen(panel.expectedAtomicPieces)).toBe(true);
    expect(requireRealBuildPreparedPanelInspection(panel)).toBe(panel);
  });

  it("projects the exact deep-frozen report boundary from the same retained parse", () => {
    const options = preparedSearchOptions(2);
    const run = inspectRealBuildPreparedRunInput(preparedSearchOptionsBytes(2));
    const boundary = inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput(run);

    expect(boundary).toMatchObject({
      preparedRunInputDigest: run.preparedRunInputDigest,
      lastStep: options.lastStep,
      maxParts: options.maxParts,
      inputDigests: options.inputDigests,
      panelCameraBranchBudget: options.panelCameraBranchBudget,
      authority: "absent",
    });
    expect(boundary.panels).toEqual(options.panels);
    expect(Object.isFrozen(boundary)).toBe(true);
    expect(Object.isFrozen(boundary.panels)).toBe(true);
    expect(Object.isFrozen(boundary.panels[0])).toBe(true);
    expect(requireRealBuildPreparedBrowserOutputBoundaryInspection(boundary)).toBe(boundary);
    expect(() => requireRealBuildPreparedBrowserOutputBoundaryInspection({ ...boundary })).toThrow(
      /exact authority-free projection/u,
    );
  });

  it("inspects zero-piece panels without relabelling them as placement-ready", () => {
    const run = inspectRealBuildPreparedRunInput(preparedSearchOptionsBytes());
    const panel = inspectRealBuildPreparedPanelFromRunInput(run, 3);

    expect(panel.actionKind).not.toBe("place-callouts");
    expect(panel.placementPrintedStepIdentity).toBeNull();
    expect(panel.expectedAtomicPieces).toEqual([]);
    expect(panel.authority).toBe("absent");
    expect(() => requireRealBuildPreparedPanelInspection({ ...panel })).toThrow(
      /exact authority-free result/u,
    );
  });

  it("binds panel and crop changes while preserving the private retained run graph", () => {
    const originalRun = inspectRealBuildPreparedRunInput(preparedSearchOptionsBytes());
    const original = inspectRealBuildPreparedPanelFromRunInput(originalRun, 2);
    const options = preparedSearchOptions();
    const panels = [...options.panels];
    panels[1] = { ...panels[1]!, maxXPt: panels[1]!.maxXPt + 1 };
    const changedRun = inspectRealBuildPreparedRunInput(
      new TextEncoder().encode(JSON.stringify({ ...options, panels })),
    );
    const changed = inspectRealBuildPreparedPanelFromRunInput(changedRun, 2);

    expect(changed.cropDigest).not.toBe(original.cropDigest);
    expect(changed.panelEvidenceDigest).not.toBe(original.panelEvidenceDigest);
    expect(changed.preparedPanelIdentity).not.toBe(original.preparedPanelIdentity);
    expect(changed.placementPrintedStepIdentity).not.toBe(original.placementPrintedStepIdentity);
    expect(original.bounds.maxXPt).toBe(options.panels[1]!.maxXPt);
    expect(() => inspectRealBuildPreparedPanelFromRunInput(originalRun, 359)).toThrow(
      /beyond requested lastStep/u,
    );
  });

  it("derives compiler metadata from the same panel and binds action-digest changes", () => {
    const original = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 2);
    const mutated = preparedSearchOptions();
    const panels = [...mutated.panels];
    const panel = panels[1]!;
    if (panel.action.kind !== "place-callouts") throw new Error("Fixture action changed.");
    panels[1] = {
      ...panel,
      action: { ...panel.action, evidenceDigest: `sha256:${"e".repeat(64)}` },
    };
    const changed = inspectRealBuildPreparedStepInput(
      new TextEncoder().encode(JSON.stringify({ ...mutated, panels })),
      2,
    );

    expect(original.compilerMetadata).toEqual({
      name: "Printed step 2",
      sourceActionDigest: panel.action.evidenceDigest,
    });
    expect(changed.compilerMetadata.sourceActionDigest).toBe(`sha256:${"e".repeat(64)}`);
    expect(changed.compilerMetadata).not.toEqual(original.compilerMetadata);
    expect(changed.printedStepIdentity).not.toBe(original.printedStepIdentity);
    expect(Object.isFrozen(changed.compilerMetadata)).toBe(true);
  });

  it("keeps successful authority issuance unavailable to caller-authored run bytes", () => {
    const inspection = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 2);

    expect(() => requireRealBuildPreparedStepAuthority(inspection)).toThrow(
      /private result of bounded run-input preflight/u,
    );
    expect(() =>
      requireRealBuildPreparedStepAuthority({
        ...inspection,
        authority: true,
      }),
    ).toThrow(/private result/u);
  });

  it("refuses non-bytes, hostile typed-array wrappers, and oversize before decoding", () => {
    let traps = 0;
    const hostile = new Proxy(preparedSearchOptionsBytes(), {
      get() {
        traps += 1;
        throw new Error("must remain inert");
      },
      ownKeys() {
        traps += 1;
        throw new Error("must remain inert");
      },
    });
    expect(() => inspectRealBuildPreparedStepInput(hostile, 2)).toThrow(/genuine Uint8Array/u);
    expect(traps).toBe(0);
    expect(() => inspectRealBuildPreparedStepInput({}, 2)).toThrow(/genuine Uint8Array/u);
    expect(() =>
      inspectRealBuildPreparedStepInput(
        new Uint8Array(MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES + 1),
        2,
      ),
    ).toThrow(/no text was decoded or parsed/u);
  });

  it("refuses unsupported panels and invalid complete run preparation", () => {
    expect(() => inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 3)).toThrow(
      /currently admits only exact place-callouts/u,
    );
    const options = preparedSearchOptions();
    expect(() =>
      inspectRealBuildPreparedStepInput(
        new TextEncoder().encode(JSON.stringify({ ...options, panelCameraBranchBudget: 7 })),
        2,
      ),
    ).toThrow(/failed deterministic preflight/u);
  });

  it("bounds unknown JSON depth and structural expansion before parsing", () => {
    const deep = new TextEncoder().encode(`{"unknown":${"[".repeat(129)}0${"]".repeat(129)}}`);
    expect(() => inspectRealBuildPreparedStepInput(deep, 2)).toThrow(
      /exceeds depth 128.*not parsed/u,
    );

    const expanded = new TextEncoder().encode(`{"unknown":[${"0,".repeat(2_000_000)}0]}`);
    expect(() => inspectRealBuildPreparedStepInput(expanded, 2)).toThrow(
      /exceeds 2000000 structural values.*not parsed/u,
    );
  });
});
