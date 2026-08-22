import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  beginRealBuildBrowserOutputV4SourceEvidenceInspection,
  inspectRealBuildBrowserOutputV4SourceEvidencePanel,
} from "../e2e/real-build-browser-output-v4-source-evidence-reader";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import type { RealBuildBrowserOutputV4SourceEvidencePanelArtifact } from "../e2e/real-build-browser-output-v4-source-evidence-types";
import { createRealBuildBrowserOutputV4SourceEvidenceManifest } from "../e2e/real-build-browser-output-v4-source-evidence-writer";
import {
  SOURCE_EVIDENCE_TEST_PREPARED_RUN,
  sourceEvidenceTestPanelInput,
} from "./real-build-browser-output-v4-source-evidence-fixture";

let artifacts: RealBuildBrowserOutputV4SourceEvidencePanelArtifact[];
let manifestBytes: Uint8Array;

beforeAll(() => {
  artifacts = Array.from({ length: 359 }, (_, index) =>
    createRealBuildBrowserOutputV4SourceEvidencePanel(sourceEvidenceTestPanelInput(index + 1)),
  );
  manifestBytes = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: SOURCE_EVIDENCE_TEST_PREPARED_RUN,
    panels: artifacts.map(({ descriptor }) => descriptor),
  }).readManifestBytes();
});

describe("browser-output /4 source evidence session reentrancy", () => {
  it("rejects a source record Proxy without dispatching its primordial-poisoning trap", () => {
    let traps = 0;
    const hostile = new Proxy(sourceEvidenceTestPanelInput(1), {
      getPrototypeOf() {
        traps += 1;
        throw new Error("source record Proxy trap must remain inert");
      },
    });

    expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(hostile)).toThrow(
      /source evidence panel input may not be a Proxy/iu,
    );
    expect(traps).toBe(0);
  });

  it("reserves the session before validating a hostile step-number value", () => {
    const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(
      manifestBytes,
      SOURCE_EVIDENCE_TEST_PREPARED_RUN,
    );
    const first = artifacts[0]!;
    let coercionInvoked = false;
    const hostileStepNumber = {
      [Symbol.toPrimitive]() {
        coercionInvoked = true;
        inspectRealBuildBrowserOutputV4SourceEvidencePanel(
          session,
          1,
          first.highRgbaBytes,
          first.workRgbaBytes,
          first.packedMaskBytes,
        );
        return 1;
      },
    };
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        hostileStepNumber,
        first.highRgbaBytes,
        first.workRgbaBytes,
        first.packedMaskBytes,
      ),
    ).toThrow(/requires sequential step 1.*not a safe integer/iu);
    expect(coercionInvoked).toBe(false);
    expect(
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        1,
        first.highRgbaBytes,
        first.workRgbaBytes,
        first.packedMaskBytes,
      ).stepNumber,
    ).toBe(1);
  });

  it("refuses ambient constructor drift before writer or reader derivation", () => {
    const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(
      manifestBytes,
      SOURCE_EVIDENCE_TEST_PREPARED_RUN,
    );
    const first = artifacts[0]!;
    const second = artifacts[1]!;
    const writerInput = sourceEvidenceTestPanelInput(1);
    const OriginalUint8ClampedArray = globalThis.Uint8ClampedArray;
    let invoked = false;
    const ReentrantUint8ClampedArray = new Proxy(OriginalUint8ClampedArray, {
      construct(target, argumentsList) {
        if (!invoked) {
          invoked = true;
          expect(() =>
            inspectRealBuildBrowserOutputV4SourceEvidencePanel(
              session,
              1,
              first.highRgbaBytes,
              first.workRgbaBytes,
              first.packedMaskBytes,
            ),
          ).toThrow(/already verifying sequential step 1.*reentrant/iu);
        }
        return Reflect.construct(target, argumentsList, target) as Uint8ClampedArray;
      },
    });
    vi.stubGlobal("Uint8ClampedArray", ReentrantUint8ClampedArray);
    try {
      expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(writerInput)).toThrow(
        /derivation primordials changed.*refuse before raster work/iu,
      );
      expect(() =>
        inspectRealBuildBrowserOutputV4SourceEvidencePanel(
          session,
          1,
          first.highRgbaBytes,
          first.workRgbaBytes,
          first.packedMaskBytes,
        ),
      ).toThrow(/derivation primordials changed.*refuse before raster work/iu);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(invoked).toBe(false);
    expect(
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        1,
        first.highRgbaBytes,
        first.workRgbaBytes,
        first.packedMaskBytes,
      ).stepNumber,
    ).toBe(1);
    expect(
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        2,
        second.highRgbaBytes,
        second.workRgbaBytes,
        second.packedMaskBytes,
      ).stepNumber,
    ).toBe(2);
  });
});
