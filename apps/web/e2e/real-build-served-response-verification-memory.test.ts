import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  createRealBuildSourceParityTestServedEvidence,
  sourceParityTestDigest,
} from "./real-build-observation-source-parity-test-fixture";
import { REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH } from "./real-build-served-response-policy";
import { verifyRealBuildServedResponseEvidenceBytes } from "./real-build-served-response-verification-memory";

type MutableManifest = {
  sourceRoot: string;
  events: Array<Record<string, unknown>>;
  responses: Array<Record<string, unknown> & { body: Record<string, unknown> }>;
  bodyChunks: Array<Record<string, unknown>>;
};

function evidence(mutator?: (manifest: MutableManifest, chunks: Buffer[]) => void) {
  const source = createRealBuildSourceParityTestServedEvidence();
  const manifest = JSON.parse(source.manifestBytes.toString("utf8")) as MutableManifest;
  const chunks = source.bodyChunkBytes.map((bytes) => Buffer.from(bytes));
  mutator?.(manifest, chunks);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  return {
    manifestBytes,
    bodyChunkBytes: chunks,
    expectedManifestDigest: sourceParityTestDigest(manifestBytes),
    sourceFiles: source.sourceFiles,
    requireRunner: true,
  } as const;
}

describe("inert served-response verification", () => {
  it("verifies exact runner, request history, response bodies, and source bindings", () => {
    expect(verifyRealBuildServedResponseEvidenceBytes(evidence())).toEqual([
      "served-response-bodies-000.bin",
      "served-response-manifest.json",
    ]);
  });

  it("refuses a false request identity", () => {
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        evidence((manifest) => {
          manifest.responses[0]!.requestKey = "false-request-key";
        }),
      ),
    ).toThrow(/false request identity|malformed or non-canonical/);
  });

  it("refuses an event that points at a different response", () => {
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        evidence((manifest) => {
          manifest.events[1]!.responseIndex = manifest.events[0]!.responseIndex;
        }),
      ),
    ).toThrow(/references the wrong response/);
  });

  it("refuses a false body offset even when the manifest digest is rebound", () => {
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        evidence((manifest) => {
          const runner = manifest.responses.find(
            ({ requestUrl }) => requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
          )!;
          runner.body.offset = 1;
        }),
      ),
    ).toThrow(/non-canonical bundle offset/);
  });

  it("refuses changed runner bytes even when every local digest is rebound", () => {
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        evidence((manifest, chunks) => {
          const runnerChunk = chunks[0]!;
          runnerChunk[0] = runnerChunk[0]! ^ 1;
          const digest = sourceParityTestDigest(runnerChunk);
          manifest.bodyChunks[0]!.digest = digest;
          const runner = manifest.responses.find(
            ({ requestUrl }) => requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
          )!;
          runner.body.digest = digest;
        }),
      ),
    ).toThrow(/exact synthetic status, headers, and body/);
  });

  it("accepts a source URL only under the exact bound checkout root", () => {
    const input = evidence((manifest) => {
      const pdf = manifest.responses.find(({ sourcePath }) => sourcePath === "inputs/booklet.pdf")!;
      pdf.requestUrl = "/@fs/C:/fixture/checkout/inputs/booklet.pdf";
      pdf.requestKey = `${pdf.requestUrl}#headers=${sourceParityTestDigest("[]")}`;
      const event = manifest.events.find(
        ({ requestKey }) => requestKey !== manifest.events[0]!.requestKey,
      )!;
      event.requestKey = pdf.requestKey;
    });
    expect(
      verifyRealBuildServedResponseEvidenceBytes({
        ...input,
        expectedCheckoutRoot: "C:/fixture/checkout",
      }),
    ).toEqual(["served-response-bodies-000.bin", "served-response-manifest.json"]);
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({
        ...input,
        expectedCheckoutRoot: "C:/different/checkout",
      }),
    ).toThrow(/outside its locked mirror and checkout/);
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({
        ...input,
        expectedCheckoutRoot: "C:/fixture/checkout",
        frozenLegacyArtifactManifestV3RunId:
          "2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367",
      }),
    ).toThrow(/cannot combine current checkout binding with frozen legacy \/3 inspection/);
  });

  it("inspects only the exact frozen legacy /3 checkout encoded by its run generation", () => {
    const runId = "2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367";
    const checkoutRoot = "C:/fixture/historical-checkout";
    const input = evidence((manifest) => {
      manifest.sourceRoot = `${checkoutRoot}/output/direct-origin-k-production/runs/.tmp-${runId}/source-snapshot`;
      const pdf = manifest.responses.find(({ sourcePath }) => sourcePath === "inputs/booklet.pdf")!;
      const priorKey = pdf.requestKey;
      pdf.requestUrl = `/@fs/${checkoutRoot}/inputs/booklet.pdf`;
      pdf.requestKey = `${pdf.requestUrl}#headers=${sourceParityTestDigest("[]")}`;
      manifest.events.find(({ requestKey }) => requestKey === priorKey)!.requestKey =
        pdf.requestKey;
    });
    expect(() => verifyRealBuildServedResponseEvidenceBytes(input)).toThrow(
      /outside its declared locked root/,
    );
    expect(
      verifyRealBuildServedResponseEvidenceBytes({
        ...input,
        frozenLegacyArtifactManifestV3RunId: runId,
      }),
    ).toEqual(["served-response-bodies-000.bin", "served-response-manifest.json"]);
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({
        ...input,
        frozenLegacyArtifactManifestV3RunId:
          "2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca368",
      }),
    ).toThrow(/source root does not match its exact run generation/);
  });

  it("uses intrinsic typed-array view bounds instead of shadow properties", () => {
    const input = evidence();
    const manifestBytes = Uint8Array.from(input.manifestBytes);
    Object.defineProperties(manifestBytes, {
      buffer: { value: new SharedArrayBuffer(1) },
      byteLength: { value: 1 },
      byteOffset: { value: Number.MAX_SAFE_INTEGER },
    });
    expect(verifyRealBuildServedResponseEvidenceBytes({ ...input, manifestBytes })).toEqual([
      "served-response-bodies-000.bin",
      "served-response-manifest.json",
    ]);
  });

  it("refuses SharedArrayBuffer-backed served-response bytes before copying", () => {
    const input = evidence();
    const manifestBytes = new Uint8Array(new SharedArrayBuffer(input.manifestBytes.length));
    manifestBytes.set(input.manifestBytes);
    expect(() => verifyRealBuildServedResponseEvidenceBytes({ ...input, manifestBytes })).toThrow(
      /Served-response manifest may not use SharedArrayBuffer backing/,
    );
  });

  it("snapshots hostile outer arrays and records before semantic work", () => {
    const base = evidence();
    let trapRead = false;
    const proxiedOuter = new Proxy(base, {
      get: () => {
        trapRead = true;
        throw new Error("outer trap must remain inert");
      },
    });
    expect(() => verifyRealBuildServedResponseEvidenceBytes(proxiedOuter)).toThrow(
      /verification input must be a non-proxy plain data record/,
    );
    expect(trapRead).toBe(false);

    const accessorOuter = { ...base } as Record<string, unknown>;
    Object.defineProperty(accessorOuter, "expectedManifestDigest", {
      enumerable: true,
      get: () => {
        trapRead = true;
        throw new Error("outer accessor must remain inert");
      },
    });
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        accessorOuter as unknown as Parameters<
          typeof verifyRealBuildServedResponseEvidenceBytes
        >[0],
      ),
    ).toThrow(/expectedManifestDigest.*data property, not an accessor/);
    expect(trapRead).toBe(false);

    const proxiedChunks = new Proxy(base.bodyChunkBytes, {
      get: () => {
        trapRead = true;
        throw new Error("trap must remain inert");
      },
    });
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({ ...base, bodyChunkBytes: proxiedChunks }),
    ).toThrow(/bodyChunkBytes must be a non-proxy Array/);
    expect(trapRead).toBe(false);

    const accessorSources = [...base.sourceFiles] as unknown[];
    Object.defineProperty(accessorSources, "0", {
      enumerable: true,
      get: () => {
        trapRead = true;
        throw new Error("accessor must remain inert");
      },
    });
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({
        ...base,
        sourceFiles: accessorSources as typeof base.sourceFiles,
      }),
    ).toThrow(/sourceFiles\[0\].*data property, not an accessor/);
    expect(trapRead).toBe(false);

    const sparse = new Array<Buffer>(2);
    sparse[0] = base.bodyChunkBytes[0]!;
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({ ...base, bodyChunkBytes: sparse }),
    ).toThrow(/bodyChunkBytes must be dense/);

    const custom = [...base.sourceFiles];
    Object.setPrototypeOf(custom, null);
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({ ...base, sourceFiles: custom }),
    ).toThrow(/sourceFiles must be an ordinary Array/);
  });

  it("uses detached byte and source snapshots after hostile inputs are accepted", () => {
    const base = evidence();
    const manifestBytes = Uint8Array.from(base.manifestBytes);
    const chunk = Uint8Array.from(base.bodyChunkBytes[0]!);
    let manifestReads = 0;
    const expectedManifestDigest = {
      toString: () => {
        manifestReads += 1;
        manifestBytes[0] = 0;
        chunk[0] = 0;
        return base.expectedManifestDigest;
      },
    } as unknown as string;
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes({
        ...base,
        manifestBytes,
        bodyChunkBytes: [chunk],
        expectedManifestDigest,
      }),
    ).toThrow(/manifest binding is not one canonical/);
    expect(manifestReads).toBe(0);
  });

  it.each([
    ["fragment", "/@vite/client#fragment"],
    ["protocol-relative", "//evil.example/@vite/client"],
    ["absolute altered origin", "https://evil.example/@vite/client"],
    ["double leading slash", "//@vite/client"],
  ])("refuses %s request URL spelling before route dispatch", (_label, requestUrl) => {
    expect(() =>
      verifyRealBuildServedResponseEvidenceBytes(
        evidence((manifest) => {
          const runner = manifest.responses.find(
            (response) => response.requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
          )!;
          const priorKey = runner.requestKey;
          runner.requestUrl = requestUrl;
          runner.requestKey = `${requestUrl}#headers=${sourceParityTestDigest("[]")}`;
          manifest.events.find((event) => event.requestKey === priorKey)!.requestKey =
            runner.requestKey;
          manifest.responses.sort((left, right) =>
            String(left.requestKey).localeCompare(String(right.requestKey)),
          );
          manifest.responses.forEach((response, index) => (response.index = index));
          for (const event of manifest.events) {
            event.responseIndex = manifest.responses.findIndex(
              (response) => response.requestKey === event.requestKey,
            );
          }
        }),
      ),
    ).toThrow(/expected exact.*one leading slash and no fragment/);
  });

  it.each([
    [
      "manifest schema",
      (manifest: MutableManifest) =>
        ((manifest as Record<string, unknown>).schemaVersion = "wrong"),
      /schemaVersion was "wrong"; expected/,
    ],
    [
      "chunk file",
      (manifest: MutableManifest) => (manifest.bodyChunks[0]!.file = "wrong.bin"),
      /bodyChunks\[0\]\.file was "wrong.bin"; expected/,
    ],
    [
      "chunk byte declaration",
      (manifest: MutableManifest) => (manifest.bodyChunks[0]!.bytes = 0),
      /bodyChunks\[0\]\.bytes was 0; expected 1 through/,
    ],
    [
      "chunk digest declaration",
      (manifest: MutableManifest) => (manifest.bodyChunks[0]!.digest = "wrong"),
      /bodyChunks\[0\]\.digest was "wrong"; expected canonical sha256 digest/,
    ],
    [
      "response index",
      (manifest: MutableManifest) => (manifest.responses[0]!.index = 9),
      /responses\[0\]\.index was 9; expected dense index 0/,
    ],
    [
      "response status",
      (manifest: MutableManifest) => (manifest.responses[0]!.status = 500),
      /responses\[0\]\.status was 500; expected 200 through 299/,
    ],
  ])("reports the exact malformed %s leaf", (_label, mutate, pattern) => {
    expect(() => verifyRealBuildServedResponseEvidenceBytes(evidence(mutate))).toThrow(pattern);
  });
});
