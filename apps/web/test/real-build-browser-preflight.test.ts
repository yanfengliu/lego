import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { INSTRUCTION_PDF_LIMITS } from "../src/instructions/instruction-source";
import {
  browserPreparationFailure,
  BrowserPreparationError,
  prepareDigestBoundPdf,
  prepareRealBuildModules,
} from "../e2e/real-build-browser-preflight";
import { describeBrowserThrown } from "../e2e/real-build-browser-error-boundary";
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
  it("formats preflight object and function rejections without invoking hostile traps", async () => {
    const traps = { get: 0, descriptor: 0, keys: 0, prototype: 0, apply: 0, construct: 0 };
    const target = Object.create(null) as object;
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor: () => {
        traps.descriptor += 1;
        throw new Error("must not inspect descriptors");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate");
      },
      get: () => {
        traps.get += 1;
        throw new Error("must not read");
      },
      getPrototypeOf: () => {
        traps.prototype += 1;
        throw new Error("must not inspect prototype");
      },
    });
    const hostileFunction = new Proxy(() => undefined, {
      apply: () => {
        traps.apply += 1;
        throw new Error("must not call");
      },
      construct: () => {
        traps.construct += 1;
        throw new Error("must not construct");
      },
      get: () => {
        traps.get += 1;
        throw new Error("must not read function");
      },
      getOwnPropertyDescriptor: () => {
        traps.descriptor += 1;
        throw new Error("must not inspect function descriptors");
      },
      getPrototypeOf: () => {
        traps.prototype += 1;
        throw new Error("must not inspect function prototype");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate function");
      },
    });

    vi.stubGlobal("fetch", () => Promise.reject(hostile));
    let caught: unknown = null;
    try {
      await prepareDigestBoundPdf({ GlobalWorkerOptions: {} }, baseOptions);
    } catch (error) {
      caught = error;
    }

    expect(browserPreparationFailure(caught)).toMatchObject({
      code: "pdf-fetch-failed",
      inputKey: "pdfUrl",
      message: expect.stringContaining("a thrown non-primitive value"),
    });
    expect(describeBrowserThrown(hostile)).toBe("a thrown non-primitive value");
    expect(describeBrowserThrown(hostileFunction)).toBe("a thrown non-primitive value");
    expect(traps).toEqual({
      get: 0,
      descriptor: 0,
      keys: 0,
      prototype: 0,
      apply: 0,
      construct: 0,
    });
  });

  it("preserves only a brand-checked Error own string message without hostile traps", () => {
    const traps = {
      get: 0,
      descriptor: 0,
      keys: 0,
      prototype: 0,
      accessor: 0,
      globalError: 0,
      inheritedDescriptorValue: 0,
    };
    const NativeError = Error;
    const hostilePrototype = new Proxy(Object.create(null) as object, {
      get: () => {
        traps.get += 1;
        throw new Error("must not read the hostile prototype");
      },
      getOwnPropertyDescriptor: () => {
        traps.descriptor += 1;
        throw new Error("must not inspect hostile prototype descriptors");
      },
      getPrototypeOf: () => {
        traps.prototype += 1;
        throw new Error("must not traverse the hostile prototype");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate the hostile prototype");
      },
    });
    const nativeError = new Error("native error detail");
    Object.setPrototypeOf(nativeError, hostilePrototype);
    const accessorError = new Error("replaced detail");
    Object.defineProperty(accessorError, "message", {
      configurable: true,
      get: () => {
        traps.accessor += 1;
        throw new Error("must not invoke the message accessor");
      },
    });
    const proxiedError = new Proxy(new Error("proxied error detail"), {
      get: () => {
        traps.get += 1;
        throw new Error("must not read the proxied Error");
      },
      getOwnPropertyDescriptor: () => {
        traps.descriptor += 1;
        throw new Error("must not inspect proxied Error descriptors");
      },
      getPrototypeOf: () => {
        traps.prototype += 1;
        throw new Error("must not inspect the proxied Error prototype");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate the proxied Error");
      },
    });
    const globalErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Error");
    if (globalErrorDescriptor === undefined)
      throw new TypeError("Expected global Error descriptor.");
    let liveGlobalMessage: string;
    try {
      Object.defineProperty(globalThis, "Error", {
        configurable: globalErrorDescriptor.configurable === true,
        enumerable: globalErrorDescriptor.enumerable === true,
        get: () => {
          traps.globalError += 1;
          return NativeError;
        },
      });
      liveGlobalMessage = describeBrowserThrown(new NativeError("live global detail"));
    } finally {
      Object.defineProperty(globalThis, "Error", globalErrorDescriptor);
    }
    const inheritedValueDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "value");
    let pollutedPrototypeMessage: string;
    try {
      Object.defineProperty(Object.prototype, "value", {
        configurable: true,
        get: () => {
          traps.inheritedDescriptorValue += 1;
          return "forged inherited detail";
        },
      });
      pollutedPrototypeMessage = describeBrowserThrown(accessorError);
    } finally {
      if (inheritedValueDescriptor === undefined) {
        Reflect.deleteProperty(Object.prototype, "value");
      } else {
        Object.defineProperty(Object.prototype, "value", inheritedValueDescriptor);
      }
    }

    expect(describeBrowserThrown(nativeError)).toBe("native error detail");
    expect(describeBrowserThrown(new Error("x".repeat(600)))).toHaveLength(512);
    expect(describeBrowserThrown(accessorError)).toBe("a thrown non-primitive value");
    expect(describeBrowserThrown(proxiedError)).toBe("a thrown non-primitive value");
    expect(liveGlobalMessage).toBe("live global detail");
    expect(pollutedPrototypeMessage).toBe("a thrown non-primitive value");
    expect(traps).toEqual({
      get: 0,
      descriptor: 0,
      keys: 0,
      prototype: 0,
      accessor: 0,
      globalError: 0,
      inheritedDescriptorValue: 0,
    });
  });

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
    expect(pdfjs.getDocument).toHaveBeenCalledOnce();
    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      data: bytes,
      isEvalSupported: false,
    });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("refuses a trustworthy oversized PDF Content-Length before allocating its body", async () => {
    const arrayBuffer = vi.fn().mockRejectedValue(new Error("must not allocate"));
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-length": String(INSTRUCTION_PDF_LIMITS.maxBytes + 1),
        }),
        body: { cancel },
        arrayBuffer,
      }),
    );

    await expect(
      prepareDigestBoundPdf({ GlobalWorkerOptions: {} }, baseOptions),
    ).rejects.toMatchObject({
      failure: { code: "pdf-fetch-failed", inputKey: "pdfUrl" },
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
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
