import { describe, expect, it } from "vitest";
import { createEmptyBrickDocument, sha256Hex } from "@lego-studio/brick-kernel";

import {
  inspectRealBuildBrowserOutputV4Envelope,
  REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  requireRealBuildBrowserOutputV4EnvelopeInspection,
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes,
} from "../e2e/real-build-browser-output-v4-envelope";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { inspectRealBuildPreparedRunInput } from "../e2e/real-build-prepared-step-authority";
import type { RealBuildOptions, StepFailure } from "../e2e/real-build-safety";
import { preparedRunBytes } from "./real-build-browser-output-v4-semantic.fixture";

const DIGEST = `sha256:${"d".repeat(64)}`;

function role(role: string, bytes = 0) {
  return { role, bytes, digest: DIGEST };
}

function fixture() {
  const preparedBytes = preparedRunBytes();
  const prepared = inspectRealBuildPreparedRunInput(preparedBytes);
  const options = JSON.parse(new TextDecoder().decode(preparedBytes)) as RealBuildOptions;
  const failure: StepFailure = {
    code: "camera-handedness-unresolved",
    stage: "camera-registration",
    stepNumber: 1,
    message: "No exact camera observation was admitted for printed step 1.",
  };
  const report = unexecutedStepReport(options.panels[0]!, failure, {
    documentParts: 0,
    elapsedMs: 0,
    reason: failure.message,
  });
  const output = {
    schemaVersion: "lego.real-build-browser-output/4",
    status: "failed",
    evidence: {
      preparedRunInputDigest: prepared.preparedRunInputDigest,
      branchEvidence: role("branch-evidence-index"),
      compiledBranchRole: role("compiled-branch-evidence-bytes"),
      branchObservationRole: role("branch-observation-bytes"),
      sourceManifest: role("source-evidence-manifest"),
      cameraManifest: role("camera-evidence-manifest"),
      cameraRenderRole: role("d4-child-render-rgba-bytes"),
      cameraMaskRole: role("branch-observation-bytes"),
      transitionManifest: role("transition-evidence-manifest"),
    },
    reports: [report],
    documentJson: JSON.stringify(
      createEmptyBrickDocument({
        id: "real-build",
        name: "Real booklet rebuild",
        maxParts: options.maxParts,
      }),
    ),
    identityBindings: [],
    fetchedPdfDigest: options.inputDigests.pdf,
    failure,
    totalElapsedMs: 0,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  };
  return { preparedBytes, prepared, options, report, output };
}

describe("browser-output /4 hostile envelope preflight", () => {
  it("retains one dense failed prefix with exact prepared/report/role bindings and no authority", () => {
    const { preparedBytes, prepared, output } = fixture();
    const inspected = inspectRealBuildBrowserOutputV4Envelope(output, preparedBytes);

    expect(inspected.preparedRun.preparedRunInputDigest).toBe(prepared.preparedRunInputDigest);
    expect(inspected.envelope.reports).toHaveLength(1);
    expect(inspected.terminalReportStepNumber).toBe(1);
    expect(inspected.authority).toBe("absent");
    expect(inspected.completionAuthority).toEqual({
      status: "absent",
      authorized: false,
      reason: "browser-output-v4-requires-separate-trusted-user-admission",
    });
    expect(Object.isFrozen(inspected)).toBe(true);
    expect(Object.isFrozen(inspected.envelope)).toBe(true);
    expect(requireRealBuildBrowserOutputV4EnvelopeInspection(inspected)).toBe(inspected);
    expect(() => requireRealBuildBrowserOutputV4EnvelopeInspection({ ...inspected })).toThrow(
      /exact authority-free result/u,
    );
  });

  it("rejects root and nested proxies before dispatching any trap", () => {
    const { preparedBytes, output } = fixture();
    let traps = 0;
    const handler: ProxyHandler<object> = {
      ownKeys() {
        traps += 1;
        throw new Error("must remain inert");
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        throw new Error("must remain inert");
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error("must remain inert");
      },
    };
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(new Proxy(output, handler), preparedBytes),
    ).toThrow(/is a Proxy/u);
    expect(traps).toBe(0);

    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        { ...output, evidence: new Proxy(output.evidence, handler) },
        preparedBytes,
      ),
    ).toThrow(/is a Proxy/u);
    expect(traps).toBe(0);
  });

  it("rejects prepared/PDF/role/authority drift and missing terminal bytes", () => {
    const { preparedBytes, output } = fixture();
    const other = `sha256:${"e".repeat(64)}`;
    for (const mutation of [
      { ...output, fetchedPdfDigest: other },
      {
        ...output,
        evidence: { ...output.evidence, preparedRunInputDigest: other },
      },
      {
        ...output,
        evidence: {
          ...output.evidence,
          cameraMaskRole: { ...output.evidence.cameraMaskRole, role: "camera-mask" },
        },
      },
      { ...output, documentJson: "" },
      {
        ...output,
        completionAuthority: {
          ...REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
          authorized: true,
        },
      },
    ]) {
      expect(() => inspectRealBuildBrowserOutputV4Envelope(mutation, preparedBytes)).toThrow();
    }
  });

  it("requires replay-neutral report and total timings without a live timing role", () => {
    const { preparedBytes, report, output } = fixture();
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        { ...output, reports: [{ ...report, elapsedMs: 1 }] },
        preparedBytes,
      ),
    ).toThrow(/report\[0\]\.elapsedMs.*replay-neutral zero/iu);
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope({ ...output, totalElapsedMs: 1 }, preparedBytes),
    ).toThrow(/totalElapsedMs.*replay-neutral zero/iu);
  });

  it("rejects a report suffix after terminal failure and incomplete executed labels", () => {
    const { preparedBytes, report, output } = fixture();
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        { ...output, reports: [report, { ...report, stepNumber: 2 }] },
        preparedBytes,
      ),
    ).toThrow(/report\[1\]|follows terminal/iu);

    const { failure: _failure, ...withoutFailure } = output;
    void _failure;
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        { ...withoutFailure, status: "executed" },
        preparedBytes,
      ),
    ).toThrow(/executed browser output.*retains 1 reports/iu);
  });

  it("bounds aggregate roles and requires unique exact identity bindings", () => {
    const { preparedBytes, output } = fixture();
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        {
          ...output,
          evidence: {
            ...output.evidence,
            compiledBranchRole: role("compiled-branch-evidence-bytes", 400 * 1024 * 1024),
            branchObservationRole: role("branch-observation-bytes", 200 * 1024 * 1024),
          },
        },
        preparedBytes,
      ),
    ).toThrow(/branch roles exceed/iu);

    const binding = {
      identityKey: "identity-1",
      partId: "part-1",
      stepNumber: 1,
      designId: "3005",
      materialId: "1",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
    };
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        { ...output, identityBindings: [binding, { ...binding }] },
        preparedBytes,
      ),
    ).toThrow(/duplicates an identityKey or partId/u);
  });

  it("rejects invented failure codes, stages, negative indices, and attempted mechanisms", () => {
    const { preparedBytes, report, output } = fixture();
    for (const failure of [
      { ...report.outcome.failure, code: "invented-failure" },
      { ...report.outcome.failure, stage: "invented-stage" },
      { ...report.outcome.failure, stepNumber: -1 },
    ]) {
      expect(() =>
        inspectRealBuildBrowserOutputV4Envelope(
          {
            ...output,
            failure,
            reports: [{ ...report, outcome: { ...report.outcome, failure } }],
          },
          preparedBytes,
        ),
      ).toThrow();
    }
    expect(() =>
      inspectRealBuildBrowserOutputV4Envelope(
        {
          ...output,
          reports: [
            {
              ...report,
              outcome: { ...report.outcome, attemptedMechanism: "invented-mechanism" },
            },
          ],
        },
        preparedBytes,
      ),
    ).toThrow(/prepared-panel boundary|attemptedMechanism/iu);
  });

  it("cross-binds small external manifest bytes without dispatching typed-array proxy traps", () => {
    const { preparedBytes, output } = fixture();
    const bytes = new TextEncoder().encode("exact branch index bytes");
    const bound = {
      ...output,
      evidence: {
        ...output.evidence,
        branchEvidence: {
          role: "branch-evidence-index",
          bytes: bytes.length,
          digest: `sha256:${sha256Hex(bytes)}`,
        },
      },
    };
    const inspection = inspectRealBuildBrowserOutputV4Envelope(bound, preparedBytes);
    expect(() =>
      verifyRealBuildBrowserOutputV4EvidenceRoleBytes(inspection, "branchEvidence", bytes),
    ).not.toThrow();
    expect(() =>
      verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
        inspection,
        "branchEvidence",
        Uint8Array.from(bytes, (byte, index) => (index === 0 ? byte ^ 1 : byte)),
      ),
    ).toThrow(/hashes to/iu);

    let traps = 0;
    const proxied = new Proxy(bytes, {
      get() {
        traps += 1;
        throw new Error("must remain inert");
      },
    });
    expect(() =>
      verifyRealBuildBrowserOutputV4EvidenceRoleBytes(inspection, "branchEvidence", proxied),
    ).toThrow(/genuine Uint8Array/iu);
    expect(traps).toBe(0);
  });
});
