import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  LDRAW_LIMITS,
  applyBuildOperations,
  canonicalDigest,
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
import { useCandidateLab } from "./generation/use-candidate-lab";
import {
  ManualCommandError,
  createAddPartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";
import { IndexedDbProjectRepository } from "./persistence/indexeddb-project-repository";
import { ProjectSaveQueue } from "./persistence/project-save-queue";

type ProjectHydration =
  { readonly state: "loading" } | { readonly state: "ready" } | { readonly state: "degraded" };

const LOCAL_PROJECT_ID = "primary-project";

function localStorageErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `Local project storage failed: ${error.message}`
    : "Local project storage failed";
}

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
  const [assistantPrompt, setAssistantPrompt] = useState("Build an 18-piece red and yellow tower");
  const candidateLab = useCandidateLab(state.document);
  const [projectHydration, setProjectHydration] = useState<ProjectHydration>({ state: "loading" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const viewportRef = useRef<BrickViewportHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const automationStateRef = useRef<AutomationAppState | null>(null);
  const importGenerationRef = useRef(0);
  const saveQueueRef = useRef<ProjectSaveQueue | null>(null);
  const lastQueuedStateHashRef = useRef<string | null>(null);
  const latestSaveSequenceRef = useRef(0);

  const selectedPart = state.document.parts.find(({ id }) => id === state.selectedPartId) ?? null;
  const selectedPartConnected =
    selectedPart !== null &&
    state.document.connections.some(
      ({ a, b }) => a.partId === selectedPart.id || b.partId === selectedPart.id,
    );
  const previewDocument = candidateLab.selectedCandidate?.document ?? state.document;
  const report = useMemo(() => validateBrickDocument(previewDocument), [previewDocument]);
  const documentReport = useMemo(() => validateBrickDocument(state.document), [state.document]);

  const automationState = useMemo<AutomationAppState>(() => {
    const readyPopulation = candidateLab.state.status === "ready" ? candidateLab.state : null;
    const candidatePopulation =
      readyPopulation === null
        ? []
        : readyPopulation.population.attempts.map((attempt) => ({
            candidateId: attempt.candidateId,
            state:
              attempt.status === "hard-valid"
                ? readyPopulation.selectedCandidateId === attempt.candidateId
                  ? ("preview" as const)
                  : ("hard-valid" as const)
                : attempt.status === "duplicate"
                  ? ("duplicate" as const)
                  : ("rejected" as const),
            documentHash: attempt.structuralHash,
            operationCount: attempt.program?.operations.length ?? 0,
            failureCodes: attempt.failure ? [attempt.failure.code] : [],
            rank: attempt.rank,
            metrics: attempt.metrics,
            lineage: {
              parentCandidateId: attempt.lineage.parentCandidateId,
              strategyId: attempt.strategyId,
            },
          }));
    const candidate =
      candidatePopulation.find(({ state: candidateState }) => candidateState === "preview") ?? null;
    return {
      document: state.document,
      selectedPartId: state.selectedPartId,
      validationReport: documentReport,
      candidateValidation: candidateLab.selectedCandidate?.validationReport ?? null,
      activeJob:
        candidateLab.state.status === "idle"
          ? null
          : {
              jobId: candidateLab.state.jobId,
              state: candidateLab.state.status,
              baseRevision: candidateLab.state.baseRevision,
              baseDocumentHash: candidateLab.state.baseDocumentHash,
              verificationDurationMs:
                candidateLab.state.status === "ready"
                  ? candidateLab.state.verificationDurationMs
                  : null,
            },
      candidatePopulation,
      candidate,
      commandError,
    };
  }, [
    candidateLab.selectedCandidate?.validationReport,
    candidateLab.state,
    commandError,
    documentReport,
    state.document,
    state.selectedPartId,
  ]);

  useEffect(() => {
    automationStateRef.current = automationState;
  }, [automationState]);

  useEffect(() => {
    let active = true;
    const repository = new IndexedDbProjectRepository();
    const load = repository.load(LOCAL_PROJECT_ID);
    void load
      .then((stored) => {
        if (!active) return;
        if (stored) {
          dispatch({ type: "restoreState", state: stored.state });
          lastQueuedStateHashRef.current = canonicalDigest(stored.state);
        }
        saveQueueRef.current = new ProjectSaveQueue(
          repository,
          LOCAL_PROJECT_ID,
          stored?.generation ?? 0,
        );
        setProjectHydration({ state: "ready" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPersistenceError(localStorageErrorMessage(error));
        setSaveStatus("failed");
        setProjectHydration({ state: "degraded" });
      });
    return () => {
      active = false;
      const queue = saveQueueRef.current;
      saveQueueRef.current = null;
      void (queue?.flush() ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => repository.close())
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (
      projectHydration.state !== "ready" ||
      persistenceError !== null ||
      saveQueueRef.current === null
    ) {
      return;
    }
    const stateHash = canonicalDigest(state);
    if (stateHash === lastQueuedStateHashRef.current) return;
    lastQueuedStateHashRef.current = stateHash;
    const saveSequence = ++latestSaveSequenceRef.current;
    setSaveStatus("saving");
    void saveQueueRef.current.enqueue(state).then(
      () => {
        if (saveSequence === latestSaveSequenceRef.current) setSaveStatus("saved");
      },
      (error: unknown) => {
        setSaveStatus("failed");
        setPersistenceError(localStorageErrorMessage(error));
      },
    );
  }, [persistenceError, projectHydration.state, state]);

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
      candidateLab.clear();
      command();
      setCommandError(null);
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
    candidateLab.clear();
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
      setCommandError(null);
    } catch (error) {
      if (error instanceof StaleFileImportError) return;
      setCommandError(error instanceof Error ? error.message : "LDraw import failed");
    }
  }

  if (projectHydration.state === "loading") {
    return (
      <main className="persistence-gate" aria-busy="true">
        <p>Loading the local project…</p>
      </main>
    );
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
          <small>
            {state.document.parts.length} parts ·{" "}
            {projectHydration.state === "degraded" || persistenceError !== null
              ? "session only"
              : saveStatus === "saved"
                ? "saved locally"
                : saveStatus}
          </small>
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
              candidateLab.clear();
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
              candidateLab.clear();
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
              candidateLab.clear();
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
            selectedPartId={candidateLab.selectedCandidate ? null : state.selectedPartId}
            previewing={candidateLab.selectedCandidate !== null}
            onSelectPart={(partId) => {
              if (!candidateLab.selectedCandidate) dispatch({ type: "selectPart", partId });
            }}
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
          {persistenceError ? (
            <div className="command-error" role="alert">
              {persistenceError} Editing remains available for this session. Stored bytes were left
              unchanged, and further automatic saves are paused to preserve the last durable copy.
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
            lab={candidateLab.state}
            onPromptChange={setAssistantPrompt}
            onGenerate={() => candidateLab.generate(assistantPrompt)}
            onSelectCandidate={candidateLab.selectCandidate}
            onClear={candidateLab.clear}
          />
        </aside>
      </div>
    </main>
  );
}
