import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

const message = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** Why the booklet did not load: the server's own words for a plain-text error answer. */
async function loadFailure(url: string, reason: unknown): Promise<string> {
  const status = (reason as { status?: unknown } | null)?.status;
  if (typeof status !== "number" || status === 0) return message(reason);
  const response = await fetch(url, { cache: "no-store" });
  return response.headers.get("Content-Type")?.startsWith("text/plain")
    ? await response.text()
    : `booklet PDF not found (${response.status} from ${url})`;
}

/**
 * The booklet page for the current step, rendered with pdf.js and fitted to
 * the panel. pdf.js reads the booklet by URL in ranges, when the server offers
 * them, so a page shows without the whole 70 MB file. The panel carries
 * data-rendered-page once a page is on screen.
 *
 * A booklet that fails to load hides every page; a page that fails to render
 * hides only itself, so another step's page still shows.
 */
export function PagePanel({ url, page }: { readonly url: string; readonly page: number }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<{
    readonly page: number;
    readonly text: string;
  } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const panel = panelRef.current!;
    const observer = new ResizeObserver(() =>
      setSize({ width: panel.clientWidth, height: panel.clientHeight }),
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.mjs?url")
      ).default;
      if (cancelled) return;
      // The booklet is read locally; it may not run scripts. Pages are fetched as they are shown.
      task = pdfjs.getDocument({
        url,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });
      const loaded = await task.promise.catch(async (reason: unknown) => {
        throw new Error(await loadFailure(url, reason));
      });
      if (!cancelled) setDocument(loaded);
    })().catch((reason: unknown) => {
      if (!cancelled) setLoadError(message(reason));
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!document || !size || size.width < 2 || size.height < 2) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      if (page < 1 || page > document.numPages) {
        throw new Error(
          `The booklet has ${document.numPages} pages; this step names page ${page}.`,
        );
      }
      const pdfPage = await document.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const fit = Math.min(size.width / base.width, size.height / base.height);
      const ratio = window.devicePixelRatio || 1;
      const viewport = pdfPage.getViewport({ scale: fit * ratio });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = pdfPage.render({ canvas, viewport });
      await task.promise;
      if (cancelled) return;
      panelRef.current!.dataset.renderedPage = String(page);
      setPageError(null);
    })().catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === "RenderingCancelledException")) {
        return;
      }
      delete panelRef.current!.dataset.renderedPage;
      setPageError({ page, text: message(reason) });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, page, size]);

  // A page error belongs to its page: moving to another step shows that step's page again.
  const error = loadError ?? (pageError?.page === page ? pageError.text : null);
  return (
    <div className="page-panel" ref={panelRef} aria-label={`Booklet page ${page}`}>
      <canvas ref={canvasRef} hidden={error !== null} />
      {error !== null && <p className="panel-message">{error}</p>}
      {error === null && document === null && <p className="panel-message">Loading booklet…</p>}
    </div>
  );
}
