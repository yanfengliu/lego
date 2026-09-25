import { ingestInstructionPdf } from "./instructions/ingest-pdf";
import {
  InstructionIngestError,
  summarizeInstructionSource,
} from "./instructions/instruction-source";

/**
 * A minimal, test-only host page (milestone 2b): never built into the
 * production bundle (absent from vite.config.ts's `rollupOptions.input`) and
 * never linked from the player. It exists only so the Playwright specs that
 * exercise reading-pipeline code (booklet PDF ingestion, rendering, vision
 * scoring) have a page to load, now that the manual editor those specs used
 * to load is deleted.
 *
 * It is not editor UI: no palette, no viewport, no document, no persistence.
 * Most of those specs need nothing from this page at all — they inject their
 * own `<canvas>` and drive real modules via `page.evaluate(() => import(...))`
 * against whatever page is loaded. The one exception is PDF ingestion, which
 * a real `<input type="file">` change event is the only faithful way to
 * drive, so this is the one pipeline hook this page wires up.
 */

const root = document.querySelector<HTMLDivElement>("#root");
if (root === null) throw new Error("Missing #root host mount");

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".pdf,application/pdf";
root.appendChild(fileInput);

const notice = document.createElement("div");
notice.className = "command-error command-error--notice";
notice.setAttribute("role", "status");
notice.hidden = true;
root.appendChild(notice);

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file === undefined) return;
  ingestInstructionPdf(file)
    .then((source) => {
      const summary = summarizeInstructionSource(source);
      notice.hidden = false;
      notice.textContent =
        `Read ${source.fileName}: ${summary.pageCount} pages, ${summary.pagesWithText} with text, ` +
        `${summary.megabytes} MB. ${source.contentHash.slice(0, 18)}…`;
    })
    .catch((error: unknown) => {
      notice.hidden = false;
      notice.textContent =
        error instanceof InstructionIngestError
          ? error.message
          : `Could not read ${file.name} as instructions: ${
              error instanceof Error ? error.message : String(error)
            }`;
    });
});
