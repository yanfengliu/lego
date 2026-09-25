import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/**
 * The booklet page for the current step, rendered with pdf.js and fitted to
 * the panel. The panel carries data-rendered-page once a page is on screen.
 */
export function PagePanel({ url, page }: { readonly url: string; readonly page: number }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const detail = response.headers.get("Content-Type")?.startsWith("text/plain")
          ? await response.text()
          : `booklet PDF not found (${response.status} from ${url})`;
        throw new Error(detail);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.mjs?url")
      ).default;
      // The booklet is read locally; it may not run scripts or pull in outside data.
      loaded = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      if (cancelled) void loaded.destroy();
      else setDocument(loaded);
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      cancelled = true;
      void loaded?.destroy();
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
      if (!cancelled) panelRef.current!.dataset.renderedPage = String(page);
    })().catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === "RenderingCancelledException")) {
        return;
      }
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, page, size]);

  return (
    <div className="page-panel" ref={panelRef} aria-label={`Booklet page ${page}`}>
      <canvas ref={canvasRef} hidden={error !== null} />
      {error !== null && <p className="panel-message">{error}</p>}
      {error === null && document === null && <p className="panel-message">Loading booklet…</p>}
    </div>
  );
}
