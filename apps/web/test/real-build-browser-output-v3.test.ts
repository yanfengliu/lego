import { describe, expect, it } from "vitest";
import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";

import {
  inspectLegacyRealBuildBrowserOutputV2,
  readRealBuildBrowserOutput,
} from "../e2e/real-build-browser-output";
import { panelCameraEvidenceDefect } from "../e2e/real-build-browser-output-panel-camera";
import { browserOutput, completeReport, options } from "./real-build-adversarial-fixtures";
import {
  PANEL_CAMERA_TEST_CAMERA,
  seededPanelCameraEvidence,
} from "./real-build-panel-camera-evidence.fixture";
import {
  MEASUREMENT_BOUNDARY,
  acceptedRootTransition,
  asDigest,
  continuationReport,
  continuityAfterRoot,
  continuedEvidence,
  directOptions,
  executedStep2Transition,
  hostileThrownObject,
  rootRefusalReport,
} from "./real-build-browser-output-v3.fixture";

describe("real-build browser-output generation 3", () => {
  it("detaches the full output without invoking action hooks or report accessors", () => {
    const prepared = directOptions();
    const source = browserOutput(1, [rootRefusalReport()]);

    let toJsonCalls = 0;
    let coercionCalls = 0;
    const action = {
      ...source.reports[0]!.action,
      toJSON: () => {
        toJsonCalls += 1;
        return source.reports[0]!.action;
      },
      [Symbol.toPrimitive]: () => {
        coercionCalls += 1;
        return "forged";
      },
    };
    const actionResult = readRealBuildBrowserOutput(
      { ...source, reports: [{ ...source.reports[0]!, action }] },
      prepared,
    );
    expect(actionResult.envelopeDefect).toMatch(/could not be safely detached/u);
    expect(toJsonCalls).toBe(0);
    expect(coercionCalls).toBe(0);

    let getterCalls = 0;
    const accessorReport = { ...source.reports[0]! } as Record<string, unknown>;
    Object.defineProperty(accessorReport, "action", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return source.reports[0]!.action;
      },
    });
    const accessorResult = readRealBuildBrowserOutput(
      { ...source, reports: [accessorReport] },
      prepared,
    );
    expect(accessorResult.envelopeDefect).toMatch(/enumerable own data property/u);
    expect(getterCalls).toBe(0);
  });

  it("contains full-report proxy traps without exposing or coercing their thrown values", () => {
    const source = browserOutput(1, [rootRefusalReport()]);
    const prepared = directOptions();
    let ownKeysCalls = 0;
    let descriptorCalls = 0;
    const report = new Proxy(source.reports[0]!, {
      ownKeys: () => {
        ownKeysCalls += 1;
        throw hostileThrownObject();
      },
      getOwnPropertyDescriptor: () => {
        descriptorCalls += 1;
        throw hostileThrownObject();
      },
    });
    const reading = readRealBuildBrowserOutput({ ...source, reports: [report] }, prepared);
    expect(reading.envelopeDefect).toMatch(/could not be safely detached/u);
    expect(reading.envelopeDefect!.length).toBeLessThan(1_024);
    expect(ownKeysCalls).toBe(1);
    expect(descriptorCalls).toBe(0);

    ownKeysCalls = 0;
    descriptorCalls = 0;
    const descriptorReport = new Proxy(source.reports[0]!, {
      ownKeys: (target) => {
        ownKeysCalls += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor: () => {
        descriptorCalls += 1;
        throw hostileThrownObject();
      },
    });
    const descriptorReading = readRealBuildBrowserOutput(
      { ...source, reports: [descriptorReport] },
      prepared,
    );
    expect(descriptorReading.envelopeDefect).toMatch(/stable property descriptor/u);
    expect(ownKeysCalls).toBe(1);
    expect(descriptorCalls).toBe(1);

    const manyKeysTarget = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
    );
    let manyOwnKeysCalls = 0;
    const manyKeysAction = new Proxy(manyKeysTarget, {
      ownKeys: (target) => {
        manyOwnKeysCalls += 1;
        return Reflect.ownKeys(target);
      },
    });
    const manyKeysReading = readRealBuildBrowserOutput(
      { ...source, reports: [{ ...source.reports[0]!, action: manyKeysAction }] },
      prepared,
    );
    expect(manyKeysReading.envelopeDefect).toMatch(/exposes 129 own keys.*permits 128/u);
    expect(manyOwnKeysCalls).toBe(1);
  });

  it("requires failed retained evidence to keep its terminal document and exact fetched PDF", () => {
    const prepared = directOptions();
    const source = browserOutput(1, [rootRefusalReport()]);
    const canonicalSource = browserOutput(1);
    const failed = {
      ...canonicalSource,
      status: "failed" as const,
      failure: { code: "rendering-error", stage: "rendering", message: "cleanup failed" },
    };
    expect(readRealBuildBrowserOutput(failed, prepared).envelopeDefect).toBeNull();

    for (const evidenceLoss of [
      { documentJson: null },
      { documentJson: "" },
      { fetchedPdfDigest: null },
      { fetchedPdfDigest: `sha256:${"c".repeat(64)}` },
    ]) {
      expect(
        readRealBuildBrowserOutput({ ...failed, ...evidenceLoss }, prepared).envelopeDefect,
      ).toMatch(/retained reports or bindings.*canonical document.*exact fetched PDF/iu);
    }

    const preExecution = {
      ...failed,
      reports: [],
      documentJson: null,
      identityBindings: [],
      fetchedPdfDigest: null,
    };
    expect(readRealBuildBrowserOutput(preExecution, prepared).envelopeDefect).toBeNull();
    for (const evidenceDrift of [
      { documentJson: source.documentJson },
      { fetchedPdfDigest: prepared.inputDigests.pdf },
    ]) {
      expect(
        readRealBuildBrowserOutput({ ...preExecution, ...evidenceDrift }, prepared).envelopeDefect,
      ).toMatch(/pre-execution.*exactly null PDF\/document evidence/iu);
    }

    const hostileDocument = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostileDocument, "toString", {
      enumerable: true,
      get: () => {
        throw new Error("must not inspect hostile document evidence");
      },
    });
    expect(
      readRealBuildBrowserOutput({ ...failed, documentJson: hostileDocument }, prepared)
        .envelopeDefect,
    ).toMatch(/enumerable own data property/u);
  });

  it("rejects huge, deep, long-string, and sparse rows before semantic parsing", () => {
    const source = browserOutput(1, [rootRefusalReport()]);
    const prepared = directOptions();
    const huge = { ...source, reports: Array.from({ length: 2 }, () => source.reports[0]!) };
    expect(readRealBuildBrowserOutput(huge, prepared).envelopeDefect).toMatch(
      /reports contains 2 entries.*permits 1/u,
    );

    let deep: unknown = null;
    for (let index = 0; index < 140; index += 1) deep = { child: deep };
    expect(
      readRealBuildBrowserOutput(
        { ...source, reports: [{ ...source.reports[0]!, action: deep }] },
        prepared,
      ).envelopeDefect,
    ).toMatch(/exceeds browser-output depth/u);

    const repeatedLargeString = "€".repeat(8 * 1024 * 1024);
    const oversizedStrings = {
      first: repeatedLargeString,
      second: repeatedLargeString,
      third: repeatedLargeString,
    };
    expect(
      readRealBuildBrowserOutput(
        { ...source, reports: [{ ...source.reports[0]!, action: oversizedStrings }] },
        prepared,
      ).envelopeDefect,
    ).toMatch(/serialized JSON exceeds 67108864 bytes/u);

    const sparseReports = new Array(1);
    expect(
      readRealBuildBrowserOutput({ ...source, reports: sparseReports }, prepared).envelopeDefect,
    ).toMatch(/dense array/u);
  });

  it("compares prepared actions structurally regardless of object key order", () => {
    const prepared = directOptions();
    const report = rootRefusalReport();
    const action = report.action;
    expect(action.kind).toBe("place-callouts");
    if (action.kind !== "place-callouts") throw new Error("Fixture action changed unexpectedly.");
    const reordered = {
      evidenceDigest: action.evidenceDigest,
      assembledPieces: action.assembledPieces,
      kind: "place-callouts" as const,
    };
    const reading = readRealBuildBrowserOutput(
      browserOutput(1, [{ ...report, action: reordered }]),
      prepared,
    );
    expect(reading.envelopeDefect).toBeNull();
    expect(reading.reportDefects).toStrictEqual([null]);

    const changed = readRealBuildBrowserOutput(
      browserOutput(1, [{ ...report, action: { ...reordered, assembledPieces: 2 } }]),
      prepared,
    );
    expect(changed.reportDefects[0]).toMatch(/prepared-panel boundary shape/u);
  });

  it("accepts the eight-root refusal and rejects a complete placement with the same unselected seeds", () => {
    const prepared = directOptions();
    const refused = browserOutput(1, [rootRefusalReport()]);
    const refusalReading = readRealBuildBrowserOutput(refused, prepared);
    expect(refusalReading.envelopeDefect).toBeNull();
    expect(refusalReading.reportDefects).toStrictEqual([null]);
    expect(refused.reports[0]!.panelCamera?.observations).toHaveLength(8);

    const falseCompletion = browserOutput(1, [rootRefusalReport(true)]);
    expect(readRealBuildBrowserOutput(falseCompletion, prepared).reportDefects[0]).toMatch(
      /complete placement.*selects no observation lineage/u,
    );
  });

  it("keeps /2 as an exact inspection-only generation with no synthetic panelCamera field", () => {
    const current = browserOutput(1);
    const legacyReport: Record<string, unknown> = { ...current.reports[0]! };
    delete legacyReport.panelCamera;
    const legacy = {
      ...current,
      schemaVersion: "lego.real-build-browser-output/2" as const,
      reports: [legacyReport],
    };
    const legacyOptions = Object.fromEntries(
      Object.entries(options(1)).filter(([key]) => key !== "panelCameraBranchBudget"),
    ) as Omit<ReturnType<typeof options>, "panelCameraBranchBudget">;

    expect(readRealBuildBrowserOutput(legacy, options(1)).envelopeDefect).not.toBeNull();
    const inspected = inspectLegacyRealBuildBrowserOutputV2(legacy, legacyOptions);
    expect(inspected).toBe(legacy);
    expect(inspected.reports[0]).not.toHaveProperty("panelCamera");
  });

  it("requires the root and rejects a forged hash-preserving zero-piece transition", () => {
    const generated = browserOutput(1, [completeReport(1)]);
    const missingRoot = readRealBuildBrowserOutput(
      { ...generated, reports: [completeReport(1)] },
      options(1),
    );
    expect(missingRoot.reportDefects[0]).toMatch(/must retain the eight-way step-0 root/u);

    const root = seededPanelCameraEvidence();
    const rootHash = root.candidates[0]!.documentHash;
    const forgedNoOp = browserOutput(
      1,
      [acceptedRootTransition(rootHash)],
      JSON.stringify(
        createEmptyBrickDocument({
          id: "real-build",
          name: "Real booklet rebuild",
          maxParts: 1_464,
        }),
      ),
    );
    const forgedNoOpReading = readRealBuildBrowserOutput(forgedNoOp, options(1));
    expect(forgedNoOpReading.envelopeDefect).toBeNull();
    expect(forgedNoOpReading.reportDefects[0]).toMatch(
      /seed-only evidence cannot.*canonical transition/iu,
    );

    const parents = root.observations.map(({ lineageId }) => lineageId);
    const continuation = continuedEvidence(parents, 8, asDigest(rootHash));
    const continuity = continuityAfterRoot(root);
    expect(
      panelCameraEvidenceDefect(
        continuation,
        continuationReport(continuation, rootHash),
        1,
        8_192,
        continuity,
        MEASUREMENT_BOUNDARY,
      ),
    ).toBeNull();
    expect(continuity.reservedAfter).toBe(72);
    expect(continuity.eligibleParents).toHaveLength(8);
  });

  it("advances continuity only through a genuinely executed and validated empty BuildStep", () => {
    const root = seededPanelCameraEvidence();
    const { source, executed, boundary } = executedStep2Transition();
    const sourceHash = documentStructuralHash(source);
    expect(sourceHash).toBe(root.candidates[0]!.documentHash);
    const evidence = continuedEvidence(
      root.observations.map(({ lineageId }) => lineageId),
      8,
      sourceHash,
      false,
    );
    expect(evidence.status).toBe("unresolved");
    expect(
      evidence.candidates.every(({ selectedObservationId }) => selectedObservationId === null),
    ).toBe(true);
    const report = {
      ...completeReport(2),
      camera: PANEL_CAMERA_TEST_CAMERA,
      panelCamera: evidence,
      canonicalStepId: executed.stepId,
      validation: executed.validation,
    };
    const continuity = continuityAfterRoot(root, boundary.transitionWitnesses);

    expect(
      panelCameraEvidenceDefect(evidence, report, 1, 8_192, continuity, MEASUREMENT_BOUNDARY),
    ).toBeNull();
    expect(continuity.acceptedDocumentHash).toBe(executed.validation.targetDocumentHash);
    expect(continuity.acceptedDocumentHash).not.toBe(sourceHash);
    expect(continuity.eligibleParents).toStrictEqual(
      new Set(evidence.observations.map(({ lineageId }) => lineageId)),
    );

    const staleHashEvidence = continuedEvidence(
      [...continuity.eligibleParents],
      continuity.reservedAfter,
      sourceHash,
      false,
      2,
      3,
    );
    expect(
      panelCameraEvidenceDefect(
        staleHashEvidence,
        continuationReport(staleHashEvidence, sourceHash, 3),
        2,
        8_192,
        continuity,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/own-panel prefix must keep accepted document hash/u);
  });

  it("never advances an absent, unvalidated, or hostile transition witness", () => {
    const root = seededPanelCameraEvidence();
    const { source, executed, boundary } = executedStep2Transition();
    const sourceHash = documentStructuralHash(source);
    const evidence = continuedEvidence(
      root.observations.map(({ lineageId }) => lineageId),
      8,
      sourceHash,
      false,
    );
    const validReport = {
      ...completeReport(2),
      camera: PANEL_CAMERA_TEST_CAMERA,
      panelCamera: evidence,
      canonicalStepId: executed.stepId,
      validation: executed.validation,
    };

    const absent = continuityAfterRoot(root);
    expect(
      panelCameraEvidenceDefect(evidence, validReport, 1, 8_192, absent, MEASUREMENT_BOUNDARY),
    ).toMatch(/canonical BuildStep is absent or non-unique/u);
    expect(absent.acceptedDocumentHash).toBe(sourceHash);
    expect(absent.reservedAfter).toBe(8);

    const unvalidated = continuityAfterRoot(root, boundary.transitionWitnesses);
    expect(
      panelCameraEvidenceDefect(
        evidence,
        {
          ...validReport,
          validation: {
            ...validReport.validation,
            attempted: false,
            targetDocumentHash: null,
          },
        },
        1,
        8_192,
        unvalidated,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/does not reproduce.*independently validated target prefix/u);
    expect(unvalidated.acceptedDocumentHash).toBe(sourceHash);
    expect(unvalidated.reservedAfter).toBe(8);

    const hostileWitnesses = new Proxy(boundary.transitionWitnesses, {
      get: () => {
        throw hostileThrownObject();
      },
    });
    const hostile = continuityAfterRoot(root, hostileWitnesses);
    const hostileDefect = panelCameraEvidenceDefect(
      evidence,
      validReport,
      1,
      8_192,
      hostile,
      MEASUREMENT_BOUNDARY,
    );
    expect(hostileDefect).toMatch(/could not be safely inspected.*hostile thrown object/iu);
    expect(hostileDefect!.length).toBeLessThan(2_048);
    expect(hostile.acceptedDocumentHash).toBe(sourceHash);
    expect(hostile.reservedAfter).toBe(8);
  });
});
