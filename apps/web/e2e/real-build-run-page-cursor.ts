import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import { renderRealBuildPageCanvas } from "./real-build-panel-raster";
import { realBuildCleanupFailure } from "./real-build-run-cleanup";
import type { StepFailure } from "./real-build-safety";

type RenderedPage = Awaited<ReturnType<typeof renderRealBuildPageCanvas>>;

export interface RealBuildRunPageCursor {
  readonly select: (
    pageNumber: number,
  ) => Promise<{ readonly page: RenderedPage | null; readonly failure: string | null }>;
  readonly close: () => StepFailure | null;
}

/** Owns the one reusable PDF page raster and its exact cleanup failure. */
export function createRealBuildRunPageCursor(
  pdf: PreparedRealBuildModules["pdfjs"],
  renderScale: number,
): RealBuildRunPageCursor {
  let page: RenderedPage | null = null;
  let pageNumber: number | null = null;
  let failure: string | null = null;
  let cleanupFailure: StepFailure | null = null;

  const dispose = () => {
    if (page === null) return;
    try {
      page.dispose();
    } catch (error) {
      cleanupFailure ??= realBuildCleanupFailure(`booklet page ${pageNumber ?? "unknown"}`, error);
    }
    page = null;
  };

  return Object.freeze({
    async select(nextPageNumber: number) {
      if (pageNumber === nextPageNumber) return { page, failure };
      dispose();
      pageNumber = nextPageNumber;
      failure = null;
      if (cleanupFailure === null) {
        try {
          page = await renderRealBuildPageCanvas(pdf, nextPageNumber, renderScale);
        } catch (error) {
          failure = describeBrowserThrown(error);
        }
      } else {
        failure = cleanupFailure.message;
      }
      return { page, failure };
    },
    close() {
      dispose();
      return cleanupFailure;
    },
  });
}
