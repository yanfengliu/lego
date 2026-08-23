import type { RealBuildBrowserOutput } from "./real-build-browser-output";
import type { RealBuildOptions, StepFailure } from "./real-build-safety";
import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import { INSTRUCTION_PDF_LIMITS } from "../src/instructions/instruction-source";

// These modules execute inside the untrusted browser probe. Their output is
// parsed and recomputed by the typed Node finalizer rather than trusted here.
type UntrustedBrowserModule = ReturnType<typeof JSON.parse>;
type PdfJsModule = UntrustedBrowserModule;
type PdfLoadingTask = UntrustedBrowserModule;
type PdfDocument = UntrustedBrowserModule;

const PREPARATION_FAILURES = new WeakMap<object, StepFailure>();

const declaredPdfContentLength = (response: Response): number | null => {
  const header = response.headers.get("content-length");
  if (header === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(header)) {
    throw new TypeError(`Real-build PDF Content-Length ${JSON.stringify(header)} is not decimal.`);
  }
  const bytes = Number(header);
  if (!Number.isSafeInteger(bytes)) {
    throw new RangeError(`Real-build PDF Content-Length ${header} exceeds safe integer range.`);
  }
  return bytes;
};

const cancelResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // The bounded source refusal remains primary if transport cleanup fails.
  }
};

export class BrowserPreparationError extends Error {
  constructor(
    readonly failure: StepFailure,
    options?: ErrorOptions,
  ) {
    super(failure.message, options);
    this.name = "BrowserPreparationError";
    PREPARATION_FAILURES.set(this, failure);
  }
}

/** Recognizes only errors constructed at this boundary without probing a hostile object. */
export function browserPreparationFailure(value: unknown): StepFailure | null {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return null;
  return PREPARATION_FAILURES.get(value) ?? null;
}

export const failedBrowserOutput = (
  failure: StepFailure,
  started: number,
): RealBuildBrowserOutput => ({
  schemaVersion: "lego.real-build-browser-output/3",
  status: "failed",
  reports: [],
  documentJson: null,
  identityBindings: [],
  fetchedPdfDigest: null,
  failure,
  totalElapsedMs: Math.round(performance.now() - started),
});

async function requiredImport<T>(label: string, url: string): Promise<T> {
  try {
    const imported: unknown = await import(/* @vite-ignore */ url);
    return imported as T;
  } catch (error) {
    throw new BrowserPreparationError(
      {
        code: "dynamic-import-failed",
        stage: "loading",
        inputKey: label,
        message:
          `Real-build ${label} module ${JSON.stringify(url)} failed dynamic import before execution: ` +
          `${describeBrowserThrown(error)}. The run placed no parts.`,
      },
      { cause: error },
    );
  }
}

export type PreparedRealBuildModules = {
  readonly pdfjs: PdfJsModule;
  readonly lattice: UntrustedBrowserModule;
  readonly rendering: UntrustedBrowserModule;
  readonly kernel: UntrustedBrowserModule;
  readonly commands: UntrustedBrowserModule;
  readonly assembly: UntrustedBrowserModule;
};

export async function prepareRealBuildModules(
  options: RealBuildOptions,
): Promise<PreparedRealBuildModules> {
  const [pdfjs, lattice, rendering, kernel, commands, assembly] = await Promise.all([
    requiredImport<PdfJsModule>("pdfjs", options.pdfjsUrl),
    requiredImport<UntrustedBrowserModule>("camera-fit-lattice", options.latticeUrl),
    requiredImport<UntrustedBrowserModule>("rendering", options.renderingUrl),
    requiredImport<UntrustedBrowserModule>("brick-kernel", options.kernelUrl),
    requiredImport<UntrustedBrowserModule>("manual-commands", options.commandsUrl),
    requiredImport<UntrustedBrowserModule>("assembly", options.assemblyUrl),
  ]);
  return { pdfjs, lattice, rendering, kernel, commands, assembly };
}

const browserDigest = async (bytes: Uint8Array): Promise<string> => {
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", stableBytes.buffer);
  return `sha256:${[...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

export type PreparedPdf = {
  readonly pdf: PdfDocument;
  readonly loadingTask: PdfLoadingTask;
  readonly fetchedPdfDigest: string;
};

export async function prepareDigestBoundPdf(
  pdfjs: PdfJsModule,
  options: RealBuildOptions,
): Promise<PreparedPdf> {
  pdfjs.GlobalWorkerOptions.workerSrc = options.workerUrl;
  let data: Uint8Array;
  let fetchedPdfDigest: string;
  try {
    const response = await fetch(options.pdfUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const declaredBytes = declaredPdfContentLength(response);
    if (declaredBytes !== null && declaredBytes > INSTRUCTION_PDF_LIMITS.maxBytes) {
      await cancelResponseBody(response);
      throw new RangeError(
        `Real-build PDF declares ${declaredBytes} bytes; maximum is ${INSTRUCTION_PDF_LIMITS.maxBytes}.`,
      );
    }
    data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength > INSTRUCTION_PDF_LIMITS.maxBytes) {
      throw new RangeError(
        `Real-build PDF materialized ${data.byteLength} bytes; maximum is ${INSTRUCTION_PDF_LIMITS.maxBytes}.`,
      );
    }
    fetchedPdfDigest = await browserDigest(data);
  } catch (error) {
    throw new BrowserPreparationError(
      {
        code: "pdf-fetch-failed",
        stage: "loading",
        inputKey: "pdfUrl",
        message:
          `Real-build PDF ${JSON.stringify(options.pdfUrl)} could not be fetched and hashed before PDF ` +
          `parsing: ${describeBrowserThrown(error)}.`,
      },
      { cause: error },
    );
  }
  if (fetchedPdfDigest !== options.inputDigests.pdf) {
    throw new BrowserPreparationError({
      code: "input-digest-mismatch",
      stage: "loading",
      inputKey: "pdf",
      message:
        `Fetched PDF bytes hash to ${fetchedPdfDigest}, but the immutable run contract requires ` +
        `${options.inputDigests.pdf}. PDF parsing was not attempted.`,
    });
  }
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
  try {
    const pdf = await loadingTask.promise;
    return { pdf, loadingTask, fetchedPdfDigest };
  } catch (error) {
    let cleanupDiagnostic = "";
    try {
      await loadingTask.destroy();
    } catch (cleanupError) {
      cleanupDiagnostic =
        ` Loading-task cleanup also failed: ${describeBrowserThrown(cleanupError)}; ` +
        "the parser failure remains the primary cause.";
    }
    throw new BrowserPreparationError(
      {
        code: "pdf-load-failed",
        stage: "loading",
        inputKey: "pdf",
        message:
          `PDF.js rejected the exact digest-bound PDF before any step executed: ` +
          `${describeBrowserThrown(error)}.${cleanupDiagnostic}`,
      },
      { cause: error },
    );
  }
}

export function rgbaPngDataUrl(pixels: ArrayLike<number>, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")!
    .putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return canvas.toDataURL("image/png");
}
