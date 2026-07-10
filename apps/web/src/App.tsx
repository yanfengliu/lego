import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  LDRAW_LIMITS,
  applyBuildOperations,
  createEmptyBrickDocument,
  exportBrickDocumentToLDraw,
  importBrickDocumentFromLDraw,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { assertRenderBudget } from "@lego-studio/rendering";

import { AssistantPanel } from "./components/AssistantPanel";
import { BrickViewport, type BrickViewportHandle } from "./components/BrickViewport";
import { CatalogPanel } from "./components/CatalogPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { installAutomationBridge, type AutomationAppState } from "./automation";
import { createEditorState, editorReducer, type EditorTransaction } from "./editor-state";
import { StaleFileImportError, readBoundedFileText } from "./file-import";
import { compileLocalPromptPreview } from "./local-assistant";
import {
  ManualCommandError,
  createAddPartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";

type AssistantPreview = ReturnType<typeof compileLocalPromptPreview>;

function initialDocument() {
  return createEmptyBrickDocument({ id: "local-document", name: "Untitled model" });
}

export function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createEditorState(initialDocument()),
  );
  const [catalogPartId, setCatalogPartId] = useState(
    PART_DEFINITIONS[4]?.id ?? "builtin:brick-2x2",
  );
  const [colorId, setColorId] = useState("builtin:red");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("Build a 4 level red and yellow tower");
  const [assistantPreview, setAssistantPreview] = useState<AssistantPreview | null>(null);
  const viewportRef = useRef<BrickViewportHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const automationStateRef = useRef<AutomationAppState | null>(null);
  const importGenerationRef = useRef(0);

  const selectedPart = state.document.parts.find(({ id }) => id === state.selectedPartId) ?? null;
  const selectedPartConnected =
    selectedPart !== null &&
    state.document.connections.some(
      ({ a, b }) => a.partId === selectedPart.id || b.partId === selectedPart.id,
    );
  const previewDocument =
    assistantPreview?.result.ok === true ? assistantPreview.result.document : state.document;
  const report = useMemo(() => validateBrickDocument(previewDocument), [previewDocument]);
  const documentReport = useMemo(() => validateBrickDocument(state.document), [state.document]);

  const automationState = useMemo<AutomationAppState>(
    () => ({
      document: state.document,
      selectedPartId: state.selectedPartId,
      validationReport: documentReport,
      candidate: assistantPreview
        ? assistantPreview.result.ok
          ? {
              candidateId: assistantPreview.result.patch.provenance.candidateId,
              state: "preview",
              documentHash: assistantPreview.result.validationReport.targetDocumentHash,
              operationCount: assistantPreview.result.patch.operations.length,
              failureCodes: [],
            }
          : {
              candidateId: "local-preview-candidate",
              state: "rejected",
              documentHash: null,
              operationCount: 0,
              failureCodes: assistantPreview.result.issues.map(({ code }) => code),
            }
        : null,
      commandError,
    }),
    [assistantPreview, commandError, documentReport, state.document, state.selectedPartId],
  );

  useEffect(() => {
    automationStateRef.current = automationState;
  }, [automationState]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return installAutomationBridge(
      window,
      () => {
        if (!automationStateRef.current) throw new Error("Automation state is unavailable");
        return automationStateRef.current;
      },
      () => viewportRef.current,
    );
  }, []);

  function runCommand(command: () => void) {
    try {
      importGenerationRef.current += 1;
      command();
      setCommandError(null);
      setAssistantPreview(null);
    } catch (error) {
      setCommandError(
        error instanceof ManualCommandError ? error.message : "The command could not be applied",
      );
    }
  }

  function applyTransaction(transaction: EditorTransaction) {
    applyBuildOperations(state.document, transaction.operations);
    dispatch({ type: "applyTransaction", transaction });
  }

  function addPart() {
    runCommand(() => {
      const transaction = createAddPartTransaction(state.document, {
        catalogPartId,
        colorId,
        selectedPartId: state.selectedPartId,
      });
      applyTransaction(transaction);
      dispatch({ type: "selectPart", partId: transaction.partId });
    });
  }

  function deleteSelectedPart() {
    if (!selectedPart) return;
    runCommand(() => {
      applyTransaction(createRemovePartTransaction(state.document, selectedPart.id));
    });
  }

  function exportLDraw() {
    try {
      const text = exportBrickDocumentToLDraw(state.document);
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${state.document.name.replace(/[^A-Za-z0-9._-]+/g, "-") || "model"}.mpd`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCommandError(null);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "LDraw export failed");
    }
  }

  async function importLDraw(file: File) {
    const generation = ++importGenerationRef.current;
    try {
      const text = await readBoundedFileText(
        file,
        LDRAW_LIMITS.maxBytes,
        () => importGenerationRef.current === generation,
      );
      const imported = importBrickDocumentFromLDraw(text);
      assertRenderBudget(imported);
      if (
        state.document.parts.length > 0 &&
        !window.confirm("Discard this unsaved session and import the selected model?")
      ) {
        return;
      }
      dispatch({ type: "replaceDocument", document: imported });
      setAssistantPreview(null);
      setCommandError(null);
    } catch (error) {
      if (error instanceof StaleFileImportError) return;
      setCommandError(error instanceof Error ? error.message : "LDraw import failed");
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <p>LEGO-compatible modeling</p>
            <h1>Brick Studio</h1>
          </div>
        </div>
        <div className="document-title">
          <span>{state.document.name}</span>
          <small>{state.document.parts.length} parts · session only</small>
        </div>
        <div className="header-actions">
          <span className="offline-badge">
            <i /> Offline kernel
          </span>
          <button
            type="button"
            className="icon-action"
            aria-label="Undo"
            disabled={state.undoStack.length === 0}
            onClick={() => {
              importGenerationRef.current += 1;
              setAssistantPreview(null);
              dispatch({ type: "undo" });
            }}
          >
            ↶
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label="Redo"
            disabled={state.redoStack.length === 0}
            onClick={() => {
              importGenerationRef.current += 1;
              setAssistantPreview(null);
              dispatch({ type: "redo" });
            }}
          >
            ↷
          </button>
          <button
            type="button"
            className="quiet-action"
            onClick={() => {
              if (
                state.document.parts.length > 0 &&
                !window.confirm("Discard this unsaved session and start a new model?")
              ) {
                return;
              }
              importGenerationRef.current += 1;
              setAssistantPreview(null);
              dispatch({ type: "replaceDocument", document: initialDocument() });
            }}
          >
            New model
          </button>
          <button
            type="button"
            className="quiet-action"
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </button>
          <button type="button" className="quiet-action" onClick={exportLDraw}>
            Export LDraw
          </button>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            accept=".ldr,.mpd,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importLDraw(file);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="studio-grid">
        <CatalogPanel
          selectedPartDefinitionId={catalogPartId}
          selectedColorId={colorId}
          canAttach={selectedPart !== null}
          documentIsEmpty={state.document.parts.length === 0}
          onPartDefinitionChange={setCatalogPartId}
          onColorChange={setColorId}
          onAdd={addPart}
        />

        <section className="workspace" aria-label="Model workspace">
          <div className="workspace-toolbar">
            <div className="tool-group" aria-label="Selection tools">
              <button type="button" className="tool is-active" aria-pressed="true">
                ↖ <span>Select</span>
              </button>
              <button type="button" className="tool" disabled>
                ✥ <span>Move</span>
              </button>
              <button type="button" className="tool" disabled>
                ↻ <span>Rotate</span>
              </button>
            </div>
            <div className="truth-readout">
              <span>Grid ½ stud</span>
              <span>-Y up</span>
              <span className={report.documentGloballyValid ? "truth-valid" : "truth-invalid"}>
                {report.documentGloballyValid ? "hard-valid" : "draft-invalid"}
              </span>
            </div>
          </div>
          <BrickViewport
            ref={viewportRef}
            document={previewDocument}
            validationReport={report}
            selectedPartId={assistantPreview?.result.ok ? null : state.selectedPartId}
            previewing={assistantPreview?.result.ok === true}
            onSelectPart={(partId) => dispatch({ type: "selectPart", partId })}
          />
          <div className="viewport-footer">
            <span>Orbit: drag · Zoom: wheel · Select: click</span>
            <code>{report.targetDocumentHash.slice(0, 18)}…</code>
          </div>
          {commandError ? (
            <div className="command-error" role="alert">
              {commandError}
            </div>
          ) : null}
        </section>

        <aside className="panel inspector-panel" aria-label="Inspector and copilot">
          <InspectorPanel
            key={`${selectedPart?.id ?? "none"}:${state.document.revision}`}
            part={selectedPart}
            connected={selectedPartConnected}
            onApply={({ colorId: nextColorId, transform }) => {
              if (!selectedPart) return;
              runCommand(() => {
                const transformChanged =
                  transform.orientationId !== selectedPart.transform.orientationId ||
                  transform.positionLdu.some(
                    (coordinate, axis) => coordinate !== selectedPart.transform.positionLdu[axis],
                  );
                applyTransaction(
                  createUpdatePartTransaction(
                    state.document,
                    selectedPart.id,
                    transformChanged
                      ? { colorId: nextColorId, transform }
                      : { colorId: nextColorId },
                    selectedPartConnected && transformChanged,
                  ),
                );
              });
            }}
            onDelete={deleteSelectedPart}
          />
          <ValidationPanel report={documentReport} />
          <AssistantPanel
            prompt={assistantPrompt}
            planSummary={assistantPreview?.plan.summary ?? null}
            result={assistantPreview?.result ?? null}
            onPromptChange={setAssistantPrompt}
            onGenerate={() =>
              setAssistantPreview(compileLocalPromptPreview(state.document, assistantPrompt))
            }
            onClear={() => setAssistantPreview(null)}
          />
        </aside>
      </div>
    </main>
  );
}
