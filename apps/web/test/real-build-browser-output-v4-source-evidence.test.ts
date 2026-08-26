import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { beforeAll, describe, expect, it } from "vitest";

import {
  beginRealBuildBrowserOutputV4SourceEvidenceInspection as beginSourceEvidenceInspection,
  finishRealBuildBrowserOutputV4SourceEvidenceInspection,
  inspectRealBuildBrowserOutputV4SourceEvidencePanel,
  requireRealBuildBrowserOutputV4SourceEvidenceInspection,
} from "../e2e/real-build-browser-output-v4-source-evidence-reader";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES,
  type RealBuildBrowserOutputV4SourceEvidenceManifest,
  type RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
} from "../e2e/real-build-browser-output-v4-source-evidence-types";
import { createRealBuildBrowserOutputV4SourceEvidenceManifest } from "../e2e/real-build-browser-output-v4-source-evidence-writer";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import { inspectRealBuildPreparedRunInput } from "../e2e/real-build-prepared-step-authority";
import {
  SOURCE_EVIDENCE_TEST_PDF_DIGEST as PDF_DIGEST,
  SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS as PREPARED_OPTIONS,
  SOURCE_EVIDENCE_TEST_PREPARED_RUN as PREPARED_RUN,
  sourceEvidenceTestPanelInput as panelInput,
} from "./real-build-browser-output-v4-source-evidence-fixture";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const ENCODER = new TextEncoder();

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

function buildPanel(stepNumber: number) {
  return createRealBuildBrowserOutputV4SourceEvidencePanel(panelInput(stepNumber));
}

let artifacts: RealBuildBrowserOutputV4SourceEvidencePanelArtifact[];
let manifestBytes: Uint8Array;

beforeAll(() => {
  artifacts = Array.from({ length: 359 }, (_, index) => buildPanel(index + 1));
  manifestBytes = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: PREPARED_RUN,
    panels: artifacts.map(({ descriptor }) => descriptor),
  }).readManifestBytes();
});

function beginRealBuildBrowserOutputV4SourceEvidenceInspection(bytes: unknown) {
  return beginSourceEvidenceInspection(bytes, PREPARED_RUN);
}

function mutableManifest(): Mutable<RealBuildBrowserOutputV4SourceEvidenceManifest> {
  return JSON.parse(
    new TextDecoder().decode(manifestBytes),
  ) as Mutable<RealBuildBrowserOutputV4SourceEvidenceManifest>;
}

function manifestAfter(
  mutate: (manifest: Mutable<RealBuildBrowserOutputV4SourceEvidenceManifest>) => void,
): Uint8Array {
  const manifest = mutableManifest();
  mutate(manifest);
  return ENCODER.encode(canonicalStringify(manifest));
}

function inspectFirst(bytes = manifestBytes, panel = artifacts[0]!) {
  const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(bytes);
  return {
    session,
    inspection: inspectRealBuildBrowserOutputV4SourceEvidencePanel(
      session,
      1,
      panel.highRgbaBytes,
      panel.workRgbaBytes,
      panel.packedMaskBytes,
    ),
  };
}

describe("browser-output /4 streamed source evidence", () => {
  it("reproduces all 359 exact panels sequentially without acquiring authority", () => {
    const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    for (let index = 0; index < artifacts.length; index += 1) {
      const panel = artifacts[index]!;
      const inspected = inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        index + 1,
        panel.highRgbaBytes,
        panel.workRgbaBytes,
        panel.packedMaskBytes,
      );
      expect(inspected.reproducible).toBe(true);
      expect(inspected.provenanceAuthority).toBe("absent");
    }
    const finished = finishRealBuildBrowserOutputV4SourceEvidenceInspection(session);
    expect(finished.manifest.coverage).toEqual({
      expectedPanelCount: 359,
      retainedPanelCount: 359,
      status: "complete",
    });
    expect(finished.manifest.preparedRunInputDigest).toBe(PREPARED_RUN.preparedRunInputDigest);
    expect(finished.manifest.sourceExecutionProvenance).toEqual({
      status: "absent",
      reason: "pdf-render-execution-and-provisional-step-identity-not-bound/1",
    });
    expect(finished.sourceExecutionProvenance).toEqual({
      status: "absent",
      reason: "pdf-render-execution-and-provisional-step-identity-not-bound/1",
    });
    expect(finished.placementAuthority.authorized).toBe(false);
    expect(finished.completionAuthority.authorized).toBe(false);
    expect(requireRealBuildBrowserOutputV4SourceEvidenceInspection(finished)).toBe(finished);
    expect(() =>
      requireRealBuildBrowserOutputV4SourceEvidenceInspection({
        manifest: finished.manifest,
        reproducible: true,
      }),
    ).toThrow(/exact branded finished inspection/iu);
    expect(() =>
      requireRealBuildBrowserOutputV4SourceEvidenceInspection(new Proxy(finished, {})),
    ).toThrow(/exact branded finished inspection/iu);
  });

  it("snapshots caller RGBA before derivation and returns independently owned panel payloads", () => {
    const input = panelInput(1);
    const originalHigh = input.highRgba.slice();
    const originalWork = input.workRgba.slice();
    const artifact = createRealBuildBrowserOutputV4SourceEvidencePanel(input);
    input.highRgba.fill(255);
    input.workRgba.fill(255);
    expect(artifact.highRgbaBytes).toEqual(new Uint8Array(originalHigh));
    expect(artifact.workRgbaBytes).toEqual(new Uint8Array(originalWork));
    expect(artifact.highRgbaBytes.buffer).not.toBe(input.highRgba.buffer);
    expect(artifact.workRgbaBytes.buffer).not.toBe(input.workRgba.buffer);
  });

  it("refuses accessors without invoking them and rejects proxied byte views", () => {
    let invoked = false;
    const valid = panelInput(1);
    const accessor = {
      pdfDigest: PDF_DIGEST,
      get panel() {
        invoked = true;
        return valid.panel;
      },
      highRgba: valid.highRgba,
      workRgba: valid.workRgba,
    };
    expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(accessor)).toThrow(
      /panel.*data property/iu,
    );
    expect(invoked).toBe(false);

    const manifestProxy = new Proxy(manifestBytes, {});
    expect(() => beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestProxy)).toThrow(
      /may not be a Proxy/iu,
    );
    const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        1,
        new Proxy(artifacts[0]!.highRgbaBytes, {}),
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/may not be a Proxy/iu);
  });

  it("rejects shared, detached, subclassed, Buffer, and accessor lookalike role storage", () => {
    if (typeof SharedArrayBuffer !== "undefined") {
      const sharedInput = panelInput(1);
      sharedInput.highRgba = new Uint8ClampedArray(
        new SharedArrayBuffer(sharedInput.highRgba.byteLength),
      ) as unknown as Uint8ClampedArray<ArrayBuffer>;
      expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(sharedInput)).toThrow(
        /SharedArrayBuffer/iu,
      );
    }
    const detached = artifacts[0]!.highRgbaBytes.slice();
    structuredClone(detached, { transfer: [detached.buffer] });
    const detachedSession = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        detachedSession,
        1,
        detached,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/exact dimensions require/iu);

    class Bytes extends Uint8Array {}
    const subclassed = new Bytes(artifacts[0]!.highRgbaBytes);
    const subclassSession = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        subclassSession,
        1,
        subclassed,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/wrong intrinsic typed-array brand or prototype/iu);

    const bufferSession = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        bufferSession,
        1,
        Buffer.from(artifacts[0]!.highRgbaBytes),
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/wrong intrinsic typed-array brand or prototype/iu);

    let invoked = false;
    const lookalike = {
      get byteLength() {
        invoked = true;
        return artifacts[0]!.highRgbaBytes.byteLength;
      },
    };
    const lookalikeSession = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        lookalikeSession,
        1,
        lookalike,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/intrinsic one-byte typed array/iu);
    expect(invoked).toBe(false);
  });

  it("rejects swapped panels, swapped roles, and one-bit payload mutations", () => {
    const swappedPanel = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        swappedPanel,
        1,
        artifacts[1]!.highRgbaBytes,
        artifacts[1]!.workRgbaBytes,
        artifacts[1]!.packedMaskBytes,
      ),
    ).toThrow(/role digest/iu);

    const swappedRole = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        swappedRole,
        1,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.highRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/exact dimensions require/iu);

    for (const role of ["high", "work", "mask"] as const) {
      const panel = artifacts[0]!;
      const high = panel.highRgbaBytes.slice();
      const work = panel.workRgbaBytes.slice();
      const mask = panel.packedMaskBytes.slice();
      (role === "high" ? high : role === "work" ? work : mask)[0]! ^= 1;
      const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
      expect(() =>
        inspectRealBuildBrowserOutputV4SourceEvidencePanel(session, 1, high, work, mask),
      ).toThrow(/role digest/iu);
    }
  });

  it("rejects a work raster that is not the exact high-raster downsample", () => {
    const input = panelInput(1);
    input.workRgba[0]! ^= 1;
    expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(input)).toThrow(
      /not the deterministic factor-2 downsample/iu,
    );
  });

  it("checks mask padding, dense ranges, and independently reproduced descriptor digests", () => {
    const panel = artifacts[0]!;
    const paddingMask = panel.packedMaskBytes.slice();
    const p = panel.descriptor.masks[1]!;
    const paddingIndex = p.offset + p.byteLength - 1;
    paddingMask[paddingIndex] = (paddingMask[paddingIndex] ?? 0) | 1;
    const paddingManifest = manifestAfter((manifest) => {
      const first = manifest.panels[0]!;
      first.roles[2]!.digest = digest(paddingMask);
      first.masks[1]!.packedDigest = digest(
        paddingMask.subarray(p.offset, p.offset + p.byteLength),
      );
    });
    const paddingSession = beginRealBuildBrowserOutputV4SourceEvidenceInspection(paddingManifest);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        paddingSession,
        1,
        panel.highRgbaBytes,
        panel.workRgbaBytes,
        paddingMask,
      ),
    ).toThrow(/non-zero low padding bits/iu);

    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          manifest.panels[0]!.masks[1]!.offset += 1;
        }),
      ),
    ).toThrow(/exact dense P/iu);

    const descriptorManifest = manifestAfter((manifest) => {
      manifest.panels[0]!.policyDescriptorDigest = `sha256:${"0".repeat(64)}`;
    });
    const descriptorSession =
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(descriptorManifest);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        descriptorSession,
        1,
        panel.highRgbaBytes,
        panel.workRgbaBytes,
        panel.packedMaskBytes,
      ),
    ).toThrow(/descriptor digests do not reproduce/iu);
  });

  it("rejects non-dense or non-359 manifests and aggregate/prepared binding drift", () => {
    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          manifest.panels.pop();
          manifest.coverage.retainedPanelCount = 358 as 359;
        }),
      ),
    ).toThrow(/coverage must be exact|359 through 359/iu);

    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          const first = manifest.panels[0]!;
          manifest.panels[0] = manifest.panels[1]!;
          manifest.panels[1] = first;
        }),
      ),
    ).toThrow(/stepNumber must be 1/iu);

    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          manifest.aggregate.totalWorkPixels += 1;
        }),
      ),
    ).toThrow(/aggregate.totalWorkPixels/iu);

    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          manifest.preparedPanelsDigest = `sha256:${"0".repeat(64)}`;
        }),
      ),
    ).toThrow(/preparedPanelsDigest/iu);
  });

  it("requires the exact prepared-run inspection and persists the provenance limitation", () => {
    const changedRun = inspectRealBuildPreparedRunInput(
      encodeRealBuildPreparedRunInput({
        ...PREPARED_OPTIONS,
        minimumScoreMargin: PREPARED_OPTIONS.minimumScoreMargin + 0.001,
      }),
    );
    expect(() => beginSourceEvidenceInspection(manifestBytes, changedRun)).toThrow(
      /does not bind the supplied exact prepared-run/iu,
    );
    expect(() => beginSourceEvidenceInspection(manifestBytes, { ...PREPARED_RUN })).toThrow(
      /exact result of one bounded byte parse/iu,
    );
    expect(() =>
      beginRealBuildBrowserOutputV4SourceEvidenceInspection(
        manifestAfter((manifest) => {
          manifest.sourceExecutionProvenance.reason =
            "pdf-render-execution-and-provisional-step-identity-not-bound/2" as never;
        }),
      ),
    ).toThrow(/exact absent PDF-render\/provisional provenance/iu);
  });

  it("gates estimated active memory before touching oversized caller payloads", () => {
    const input = panelInput(1, 300);
    input.highRgba = new Uint8ClampedArray();
    input.workRgba = new Uint8ClampedArray();
    expect(() => createRealBuildBrowserOutputV4SourceEvidencePanel(input)).toThrow(
      new RegExp(
        `maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES}`,
        "iu",
      ),
    );
  });

  it("does not advance after failure and refuses gaps, early/double finish, or reuse", () => {
    const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes);
    const wrong = artifacts[0]!.highRgbaBytes.slice();
    wrong[0]! ^= 1;
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        1,
        wrong,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/role digest/iu);
    expect(
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        1,
        artifacts[0]!.highRgbaBytes,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ).stepNumber,
    ).toBe(1);
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        3,
        artifacts[2]!.highRgbaBytes,
        artifacts[2]!.workRgbaBytes,
        artifacts[2]!.packedMaskBytes,
      ),
    ).toThrow(/requires sequential step 2/iu);
    expect(() => finishRealBuildBrowserOutputV4SourceEvidenceInspection(session)).toThrow(
      /verified 1 panels/iu,
    );

    for (let index = 1; index < artifacts.length; index += 1) {
      const panel = artifacts[index]!;
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        index + 1,
        panel.highRgbaBytes,
        panel.workRgbaBytes,
        panel.packedMaskBytes,
      );
    }
    finishRealBuildBrowserOutputV4SourceEvidenceInspection(session);
    expect(() => finishRealBuildBrowserOutputV4SourceEvidenceInspection(session)).toThrow(
      /already finished/iu,
    );
    expect(() =>
      inspectRealBuildBrowserOutputV4SourceEvidencePanel(
        session,
        360,
        artifacts[0]!.highRgbaBytes,
        artifacts[0]!.workRgbaBytes,
        artifacts[0]!.packedMaskBytes,
      ),
    ).toThrow(/already finished/iu);
    expect(() => finishRealBuildBrowserOutputV4SourceEvidenceInspection({})).toThrow(
      /exact branded session/iu,
    );
  });

  it("keeps manifest bytes canonical and rejects bit-level manifest drift", () => {
    expect(inspectFirst().inspection.descriptorDigests).toBe("verified");
    const changed = manifestBytes.slice();
    changed[changed.length - 2]! ^= 1;
    expect(() => beginRealBuildBrowserOutputV4SourceEvidenceInspection(changed)).toThrow();
  });
});
