import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  BrowserPreparationError,
  prepareDigestBoundPdf,
  prepareRealBuildModules,
} from "../e2e/real-build-browser-preflight";
import type { RealBuildOptions } from "../e2e/real-build-safety";

const DIGEST = `sha256:${"a".repeat(64)}`;
const baseOptions = {
  pdfjsUrl: "data:text/javascript,export const GlobalWorkerOptions = {};",
  latticeUrl: "data:text/javascript,export const lattice = true;",
  renderingUrl: "data:text/javascript,export const rendering = true;",
  kernelUrl: "data:text/javascript,export const kernel = true;",
  commandsUrl: "data:text/javascript,export const commands = true;",
  assemblyUrl: "data:text/javascript,export const assembly = true;",
  workerUrl: "worker.js",
  pdfUrl: "/booklet.pdf",
  inputDigests: {
    pdf: DIGEST,
    calloutManifest: DIGEST,
    coverage: DIGEST,
    officialModel: DIGEST,
    actionLedger: DIGEST,
    highlightCalibration: DIGEST,
    builderCalibration: DIGEST,
    builderGeometry: DIGEST,
    transitionClassifications: DIGEST,
  },
} as unknown as RealBuildOptions;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("real-build browser preparation failures", () => {
  it("attributes a dynamic import failure to the exact module before execution", async () => {
    await expect(
      prepareRealBuildModules({
        ...baseOptions,
        assemblyUrl: "file:///definitely-missing-real-build-assembly.mjs",
      }),
    ).rejects.toMatchObject({
      name: "BrowserPreparationError",
      failure: { code: "dynamic-import-failed", stage: "loading", inputKey: "assembly" },
    });
  });

  it("distinguishes fetch, digest, and PDF parser failures and destroys a rejected loading task", async () => {
    const pdfjs = {
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: vi.fn(),
    } as Parameters<typeof prepareDigestBoundPdf>[0];
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    await expect(prepareDigestBoundPdf(pdfjs, baseOptions)).rejects.toMatchObject({
      failure: { code: "pdf-fetch-failed", inputKey: "pdfUrl" },
    });

    const bytes = new TextEncoder().encode("not really a PDF");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response(bytes))),
    );
    await expect(prepareDigestBoundPdf(pdfjs, baseOptions)).rejects.toMatchObject({
      failure: { code: "input-digest-mismatch", inputKey: "pdf" },
    });

    const destroy = vi.fn().mockResolvedValue(undefined);
    pdfjs.getDocument = vi.fn().mockImplementation(() => ({
      promise: Promise.reject(new Error("malformed xref")),
      destroy,
    }));
    const exactOptions = {
      ...baseOptions,
      inputDigests: { ...baseOptions.inputDigests, pdf: sha256Digest(bytes) },
    };
    await expect(prepareDigestBoundPdf(pdfjs, exactOptions)).rejects.toMatchObject({
      failure: { code: "pdf-load-failed", inputKey: "pdf" },
    });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("exposes failures as typed errors rather than ambiguous booleans", () => {
    const failure = {
      code: "pdf-load-failed",
      stage: "loading",
      inputKey: "pdf",
      message: "exact PDF failed",
    } as const;

    expect(new BrowserPreparationError(failure)).toMatchObject({
      message: "exact PDF failed",
      failure,
    });
  });
});
