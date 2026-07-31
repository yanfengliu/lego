import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PART_DEFINITIONS, getPartDefinition } from "@lego-studio/catalog";
import {
  LDRAW_LIMITS,
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
  deriveBuildSequence,
  exportBrickDocumentToLDraw,
  importBrickDocumentFromLDraw,
  migrateDocumentTruth,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { assertRenderBudget } from "@lego-studio/rendering";
import type { RigidTransform } from "@lego-studio/protocol";

import { AssistantPanel } from "./components/AssistantPanel";
import { BrickViewport, type BrickViewportHandle } from "./components/BrickViewport";
import { BuildPlaybackBar } from "./components/BuildPlaybackBar";
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
  createMovePartTransaction,
  createPlacePartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";
import { nextYawOrientationId, snapPlacementOrigin } from "./placement";
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
  const [draggedCatalogPartId, setDraggedCatalogPartId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  // Bumping this re-frames the camera; ordinary edits must never move it.
  const [frameToken, setFrameToken] = useState(0);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("Build an 18-piece red and yellow tower");
  const candidateLab = useCandidateLab(state.document);
  const [projectHydration, setProjectHydration] = useState<ProjectHydration>({ state: "loading" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
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
  // Deriving a sequence validates every step prefix, so only do it while the
  // playback bar is open.
  const playbackOpen = playbackPosition !== null;
  const buildSequence = useMemo(
    () => (playbackOpen ? deriveBuildSequence(state.document) : null),
    [playbackOpen, state.document],
  );
  const playbackDocument =
    buildSequence === null
      ? null
      : (buildSequence.states[Math.min(playbackPosition ?? 0, buildSequence.states.length - 1)]
          ?.document ?? null);
  const previewDocument =
    candidateLab.selectedCandidate?.document ?? playbackDocument ?? state.document;
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
          // A stored document pins its own truth; carry it forward explicitly
          // rather than letting it float onto the newer catalog.
          const { document: migratedDocument, report } = migrateDocumentTruth(
            stored.state.document,
          );
          const restored =
            report.migrated || report.blockingReasons.length > 0
              ? { ...stored.state, document: migratedDocument }
              : stored.state;
          if (report.migrated) {
            setMigrationNotice(
              `Updated this model from ${report.fromCatalogVersion} to ${report.toCatalogVersion}; ${report.addedColorIds.length} new colors are now available.`,
            );
          } else if (report.blockingReasons.length > 0) {
            setMigrationNotice(
              `This model is pinned to ${report.fromCatalogVersion} and was left unchanged: ${report.blockingReasons[0]}`,
            );
          }
          dispatch({ type: "restoreState", state: restored });
          lastQueuedStateHashRef.current = canonicalDigest(restored);
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

  /**
   * Returns the whole workspace to its opening state, not just the document:
   * selection, candidate previews, playback, errors, and the camera framing all
   * go back to where a fresh session starts.
   */
  function resetScene() {
    importGenerationRef.current += 1;
    candidateLab.clear();
    setPlaybackPlaying(false);
    setPlaybackPosition(null);
    setDraggedCatalogPartId(null);
    setCommandError(null);
    setMigrationNotice(null);
    dispatch({ type: "replaceDocument", document: initialDocument() });
    setFrameToken((token) => token + 1);
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

  function placePart(catalogPartId: string, transform: RigidTransform) {
    runCommand(() => {
      const transaction = createPlacePartTransaction(state.document, {
        catalogPartId,
        colorId,
        transform,
      });
      applyTransaction(transaction);
      dispatch({ type: "selectPart", partId: transaction.partId });
    });
  }

  function movePart(partId: string, transform: RigidTransform) {
    runCommand(() => {
      applyTransaction(createMovePartTransaction(state.document, partId, transform));
      dispatch({ type: "selectPart", partId });
    });
  }

  function rotateSelectedPart() {
    if (!selectedPart) return;
    runCommand(() => {
      const definition = getPartDefinition(selectedPart.catalogPartId);
      if (!definition) {
        throw new ManualCommandError(
          `Cannot rotate ${selectedPart.id}: ${selectedPart.catalogPartId} is absent from the pinned catalog`,
        );
      }
      const orientationId = nextYawOrientationId(selectedPart.transform.orientationId);
      // A yaw can flip the footprint parity, so re-snap laterally at the same height.
      const positionLdu = snapPlacementOrigin({
        catalogPartId: selectedPart.catalogPartId,
        orientationId,
        rawLdu: selectedPart.transform.positionLdu,
        supportUndersideLdu:
          selectedPart.transform.positionLdu[1] + definition.dimensions.heightLdu / 2,
      });
      applyTransaction(
        createMovePartTransaction(state.document, selectedPart.id, { positionLdu, orientationId }),
      );
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
      setFrameToken((token) => token + 1);
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
              resetScene();
            }}
          >
            New model
          </button>
          <button
            type="button"
            className="quiet-action"
            title="Clear the model, selection, previews, and camera"
            onClick={() => {
              if (
                state.document.parts.length > 0 &&
                !window.confirm("Reset the whole scene? The current model is discarded.")
              ) {
                return;
              }
              resetScene();
            }}
          >
            Reset scene
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
          onArmChange={setDraggedCatalogPartId}
          armedPartId={draggedCatalogPartId}
        />

        <section className="workspace" aria-label="Model workspace">
          <div className="workspace-toolbar">
            <div className="tool-group" aria-label="Selection tools">
              <button type="button" className="tool is-active" aria-pressed="true">
                ↖ <span>Select</span>
              </button>
              <button
                type="button"
                className="tool"
                disabled={selectedPart === null}
                title={
                  selectedPart
                    ? "Pick up the selected part, then click to drop it"
                    : "Select a part to move it"
                }
                onClick={() => {
                  if (selectedPart) viewportRef.current?.beginMove(selectedPart.id);
                }}
              >
                ✥ <span>Move</span>
              </button>
              <button
                type="button"
                className="tool"
                disabled={selectedPart === null}
                title={selectedPart ? "Rotate the selected part 90°" : "Select a part to rotate it"}
                onClick={rotateSelectedPart}
              >
                ↻ <span>Rotate</span>
              </button>
            </div>
            <div className="tool-group" aria-label="Build playback">
              <button
                type="button"
                className={`tool${playbackPosition !== null ? " is-active" : ""}`}
                aria-pressed={playbackPosition !== null}
                disabled={state.document.parts.length === 0}
                title={
                  state.document.parts.length === 0
                    ? "Place a part to review the build"
                    : "Step through the build one instruction step at a time"
                }
                onClick={() => {
                  setPlaybackPlaying(false);
                  setPlaybackPosition(playbackPosition === null ? 0 : null);
                }}
              >
                ⏵ <span>Build</span>
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
            frameToken={frameToken}
            onDisarm={() => setDraggedCatalogPartId(null)}
            draggedCatalogPartId={draggedCatalogPartId}
            onSelectPart={(partId) => {
              if (!candidateLab.selectedCandidate) dispatch({ type: "selectPart", partId });
            }}
            onPlacePart={placePart}
            onMovePart={movePart}
          />
          {buildSequence && playbackPosition !== null ? (
            <BuildPlaybackBar
              sequence={buildSequence}
              position={playbackPosition}
              playing={playbackPlaying}
              onSeek={setPlaybackPosition}
              onPlayingChange={setPlaybackPlaying}
              onExit={() => {
                setPlaybackPlaying(false);
                setPlaybackPosition(null);
              }}
            />
          ) : null}
          <div className="viewport-footer">
            <span>
              Place: click · Select: left · Orbit: middle · Pan: right · Zoom: wheel · Fly: WASD,
              Q/E
            </span>
            <code>{report.targetDocumentHash.slice(0, 18)}…</code>
          </div>
          {commandError ? (
            <div className="command-error" role="alert">
              {commandError}
            </div>
          ) : null}
          {migrationNotice ? (
            <div className="command-error command-error--notice" role="status">
              {migrationNotice}
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
