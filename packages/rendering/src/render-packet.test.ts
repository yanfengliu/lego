import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  validateRenderPacketV1,
  type ArtifactRefV1,
  type RenderViewArtifactV1,
  type ValidationReportV1,
} from "@lego-studio/protocol";
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { CANONICAL_VIEW_NAMES, createCanonicalViewPacket } from "./cameras.ts";
import {
  CANONICAL_CAPTURE_POLICY,
  CANONICAL_CAPTURE_POLICY_HASH,
  CANONICAL_RENDER_PASSES,
  CANONICAL_RENDER_VIEW_SET,
  CanonicalRenderPacketError,
  canonicalRenderPacketHash,
  createCanonicalRenderPacket,
  summarizeCanonicalRenderPacket,
} from "./render-packet.ts";

const hash = (digit: string): Sha256Digest => `sha256:${digit.repeat(64)}`;
const DOCUMENT_HASH = hash("a");
const TRUTH_HASH = hash("b");
const RENDERER_HASH = hash("c");
const BROWSER_BUILD_HASH = hash("d");

function validationReport(
  documentHash = DOCUMENT_HASH,
  truthSnapshotHash = TRUTH_HASH,
): ValidationReportV1 {
  return {
    schemaVersion: "lego.validation-report/1",
    targetDocumentHash: documentHash,
    truthSnapshotHash,
    validatorSetHash: hash("e"),
    patchValid: true,
    documentGloballyValid: true,
    issues: [],
  };
}

function cameraPacket(documentHash = DOCUMENT_HASH) {
  return createCanonicalViewPacket({
    documentHash,
    bounds: new Box3(new Vector3(-1, -2, -3), new Vector3(4, 5, 6)),
  });
}

function artifact(viewId: string, index: number): ArtifactRefV1 {
  const contentHash = hash(((index + 1) % 16).toString(16));
  return {
    artifactId: `render:${viewId}`,
    kind: "render",
    mediaType: CANONICAL_CAPTURE_POLICY.mediaType,
    sha256: contentHash,
    byteLength: 1024,
    casKey: contentHash,
  };
}

function captures(): RenderViewArtifactV1[] {
  return CANONICAL_VIEW_NAMES.map((viewId, index) => ({
    viewId,
    pass: "beauty",
    artifact: artifact(viewId, index),
    width: CANONICAL_CAPTURE_POLICY.width,
    height: CANONICAL_CAPTURE_POLICY.height,
    devicePixelRatio: CANONICAL_CAPTURE_POLICY.devicePixelRatio,
  }));
}

function input(overrides: Partial<Parameters<typeof createCanonicalRenderPacket>[0]> = {}) {
  return {
    documentHash: DOCUMENT_HASH,
    truthSnapshotHash: TRUTH_HASH,
    validationReport: validationReport(),
    rendererSnapshotHash: RENDERER_HASH,
    browserBuildHash: BROWSER_BUILD_HASH,
    cameraPacket: cameraPacket(),
    capturedViews: captures(),
    ...overrides,
  };
}

function expectCode(callback: () => unknown, code: CanonicalRenderPacketError["code"]): void {
  expect(callback).toThrowError(expect.objectContaining({ code }));
}

describe("canonical RenderPacketV1 foundation", () => {
  it("defines the honest versioned seven-view beauty-only capture policy", () => {
    expect(CANONICAL_RENDER_PASSES).toEqual(["beauty"]);
    expect(CANONICAL_RENDER_VIEW_SET).toMatchObject({
      schemaVersion: "lego.canonical-render-view-set/1",
      version: "lego.canonical-render-views/1",
      views: [
        { viewId: "isometric", projection: "perspective", passes: ["beauty"] },
        ...CANONICAL_VIEW_NAMES.slice(1).map((viewId) => ({
          viewId,
          projection: "orthographic",
          passes: ["beauty"],
        })),
      ],
    });
    expect(CANONICAL_CAPTURE_POLICY_HASH).toBe(canonicalDigest(CANONICAL_CAPTURE_POLICY));
    expect(Object.isFrozen(CANONICAL_RENDER_VIEW_SET.views)).toBe(true);
    expect(Object.isFrozen(CANONICAL_CAPTURE_POLICY)).toBe(true);
  });

  it("assembles a detached protocol-valid packet in canonical view order", () => {
    const source = input({ capturedViews: captures().reverse() });
    const packet = createCanonicalRenderPacket(source);

    expect(validateRenderPacketV1(packet), validateRenderPacketV1.errors?.[0]?.message).toBe(true);
    expect(packet).toMatchObject({
      schemaVersion: "lego.render-packet/1",
      documentHash: DOCUMENT_HASH,
      validationReportHash: canonicalDigest(source.validationReport),
      rendererSnapshotHash: RENDERER_HASH,
      capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      browserBuildHash: BROWSER_BUILD_HASH,
    });
    expect(packet.views.map(({ viewId }) => viewId)).toEqual(CANONICAL_VIEW_NAMES);
    expect(packet.views.every(({ pass }) => pass === "beauty")).toBe(true);
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.views)).toBe(true);
    expect(Object.isFrozen(packet.views[0]?.artifact)).toBe(true);
    expect(packet.views).not.toBe(source.capturedViews);
  });

  it("normalizes camera and capture order for deterministic hashes and summaries", () => {
    const first = createCanonicalRenderPacket(input());
    const reorderedCamera = {
      ...cameraPacket(),
      views: [...cameraPacket().views].reverse(),
    };
    const second = createCanonicalRenderPacket(
      input({ cameraPacket: reorderedCamera, capturedViews: captures().reverse() }),
    );
    const externallyReordered = { ...first, views: [...first.views].reverse() };

    expect(second).toEqual(first);
    expect(canonicalRenderPacketHash(externallyReordered)).toBe(canonicalRenderPacketHash(first));
    expect(summarizeCanonicalRenderPacket(externallyReordered)).toEqual(
      summarizeCanonicalRenderPacket(first),
    );
    expect(summarizeCanonicalRenderPacket(first)).toEqual({
      schemaVersion: "lego.canonical-render-packet-summary/1",
      packetHash: canonicalRenderPacketHash(first),
      documentHash: DOCUMENT_HASH,
      viewCount: 7,
      viewIds: CANONICAL_VIEW_NAMES,
      passes: ["beauty"],
      totalByteLength: 7 * 1024,
    });
    expect(Object.isFrozen(summarizeCanonicalRenderPacket(first))).toBe(true);
  });

  it("rejects missing, duplicate, extra, and unsupported-pass views", () => {
    const expected = captures();
    expectCode(
      () => createCanonicalRenderPacket(input({ capturedViews: expected.slice(0, -1) })),
      "MISSING_CANONICAL_VIEW",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: [
              ...expected.slice(0, -1),
              { ...expected[0]!, artifact: artifact("duplicate", 8) },
            ],
          }),
        ),
      "DUPLICATE_CANONICAL_VIEW",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: [
              ...expected,
              { ...expected[0]!, viewId: "closeup", artifact: artifact("closeup", 9) },
            ],
          }),
        ),
      "EXTRA_CANONICAL_VIEW",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: expected.map((view, index) =>
              index === 0 ? { ...view, pass: "silhouette" } : view,
            ),
          }),
        ),
      "MISMATCHED_CANONICAL_VIEW",
    );
  });

  it("rejects capture metadata, media, and byte budgets outside the canonical policy", () => {
    const expected = captures();
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ capturedViews: [{ ...expected[0]!, width: 641 }, ...expected.slice(1)] }),
        ),
      "CAPTURE_METADATA_MISMATCH",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: [
              {
                ...expected[0]!,
                artifact: { ...expected[0]!.artifact, mediaType: "image/jpeg" },
              },
              ...expected.slice(1),
            ],
          }),
        ),
      "CAPTURE_ARTIFACT_MISMATCH",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: [
              {
                ...expected[0]!,
                artifact: {
                  ...expected[0]!.artifact,
                  byteLength: CANONICAL_CAPTURE_POLICY.maxArtifactBytes + 1,
                },
              },
              ...expected.slice(1),
            ],
          }),
        ),
      "CAPTURE_ARTIFACT_MISMATCH",
    );
  });

  it("rejects validation or camera evidence stale for the current document and truth", () => {
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ validationReport: validationReport(hash("f"), TRUTH_HASH) }),
        ),
      "STALE_DOCUMENT_HASH",
    );
    expectCode(
      () => createCanonicalRenderPacket(input({ cameraPacket: cameraPacket(hash("f")) })),
      "STALE_DOCUMENT_HASH",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ validationReport: validationReport(DOCUMENT_HASH, hash("f")) }),
        ),
      "STALE_TRUTH_HASH",
    );
  });

  it("rejects malformed reports, malformed artifacts, and mismatched camera view sets", () => {
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ validationReport: { ...validationReport(), schemaVersion: "bad" } as never }),
        ),
      "VALIDATION_REPORT_INVALID",
    );
    const expected = captures();
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            capturedViews: [
              {
                ...expected[0]!,
                artifact: { ...expected[0]!.artifact, casKey: hash("f") },
              },
              ...expected.slice(1),
            ],
          }),
        ),
      "RENDER_PACKET_PROTOCOL_INVALID",
    );
    const packet = cameraPacket();
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            cameraPacket: {
              ...packet,
              views: packet.views.map((view, index) =>
                index === 0 ? { ...view, projection: "orthographic" } : view,
              ),
            },
          }),
        ),
      "CAMERA_VIEW_SET_MISMATCH",
    );

    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({
            cameraPacket: {
              ...packet,
              views: packet.views.map((view, index) =>
                index === 0
                  ? {
                      ...view,
                      position: [view.position[0] + 1, view.position[1], view.position[2]],
                    }
                  : view,
              ),
            },
          }),
        ),
      "CAMERA_VIEW_SET_MISMATCH",
    );
  });

  it("rejects accessor-bearing and malformed camera inputs with typed failures", () => {
    let getterReads = 0;
    const accessorPacket = Object.defineProperty({ ...cameraPacket() }, "extra", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return "untrusted";
      },
    });
    expectCode(
      () => createCanonicalRenderPacket(input({ cameraPacket: accessorPacket })),
      "INPUT_INVALID",
    );
    expect(getterReads).toBe(0);

    expectCode(
      () => createCanonicalRenderPacket(input({ cameraPacket: null as never })),
      "CAMERA_PACKET_INVALID",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ cameraPacket: { ...cameraPacket(), bounds: null } as never }),
        ),
      "CAMERA_PACKET_INVALID",
    );
    expectCode(
      () =>
        createCanonicalRenderPacket(
          input({ cameraPacket: { ...cameraPacket(), views: [null] } as never }),
        ),
      "CAMERA_VIEW_SET_MISMATCH",
    );
  });
});
