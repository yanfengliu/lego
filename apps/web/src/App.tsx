import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

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

import { BrickViewport, type BrickViewportHandle } from "./components/BrickViewport";
import { BuildPlaybackBar } from "./components/BuildPlaybackBar";
import { CatalogPanel } from "./components/CatalogPanel";
import { PanelSplitter } from "./components/PanelSplitter";
import { ProjectBar } from "./components/ProjectBar";
import { InspectorPanel } from "./components/InspectorPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { installAutomationBridge, type AutomationAppState } from "./automation";
import {
  createEditorState,
  editorReducer,
  type EditorState,
  type EditorTransaction,
} from "./editor-state";
import { StaleFileImportError, readBoundedFileText } from "./file-import";
import {
  ManualCommandError,
  createAddPartTransaction,
  createMovePartTransaction,
  createPlacePartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";
import { ingestInstructionPdf } from "./instructions/ingest-pdf";
import {
  InstructionIngestError,
  summarizeInstructionSource,
  type InstructionSourceV1,
} from "./instructions/instruction-source";
import { nextYawOrientationId, snapPlacementOrigin } from "./placement";
import {
  IndexedDbProjectRepository,
  type ProjectSummary,
} from "./persistence/indexeddb-project-repository";
import { ProjectSaveQueue } from "./persistence/project-save-queue";
import { modelAppearanceCatalogIds } from "./migration-notice";

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
  const [catalogWidth, setCatalogWidth] = useState(290);
  const [inspectorWidth, setInspectorWidth] = useState(330);
  const [projectId, setProjectId] = useState(LOCAL_PROJECT_ID);
  const [projects, setProjects] = useState<readonly ProjectSummary[]>([]);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [projectHydration, setProjectHydration] = useState<ProjectHydration>({ state: "loading" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [instructionSource, setInstructionSource] = useState<InstructionSourceV1 | null>(null);
  const [instructionProgress, setInstructionProgress] = useState<string | null>(null);
  const viewportRef = useRef<BrickViewportHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const instructionInputRef = useRef<HTMLInputElement>(null);
  const automationStateRef = useRef<AutomationAppState | null>(null);
  const importGenerationRef = useRef(0);
  const saveQueueRef = useRef<ProjectSaveQueue | null>(null);
  const lastQueuedStateHashRef = useRef<string | null>(null);
  const latestSaveSequenceRef = useRef(0);
  const repositoryRef = useRef<IndexedDbProjectRepository | null>(null);

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
  const previewDocument = playbackDocument ?? state.document;
  const documentReport = useMemo(() => validateBrickDocument(state.document), [state.document]);
  // Outside playback the preview *is* the document, and validating it twice
  // produced two equal reports from the same validators. Nothing here decides
  // legality differently; it decides it once.
  const previewReport = useMemo(
    () => (previewDocument === state.document ? null : validateBrickDocument(previewDocument)),
    [previewDocument, state.document],
  );
  const report = previewReport ?? documentReport;

  const automationState = useMemo<AutomationAppState>(
    () => ({
      document: state.document,
      selectedPartId: state.selectedPartId,
      validationReport: documentReport,
      commandError,
    }),
    [commandError, documentReport, state.document, state.selectedPartId],
  );

  useEffect(() => {
    automationStateRef.current = automationState;
  }, [automationState]);

  useEffect(() => {
    let active = true;
    const repository = repositoryRef.current ?? new IndexedDbProjectRepository();
    repositoryRef.current = repository;
    const load = repository.load(projectId);
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
            const reinterpretedParts = modelAppearanceCatalogIds(
              stored.state.document.parts.map(({ catalogPartId }) => catalogPartId),
              report.catalogInterpretationChanges,
            );
            setMigrationNotice(
              `Updated this model from ${report.fromCatalogVersion} to ${report.toCatalogVersion}; ${report.addedColorIds.length} new colors are now available${reinterpretedParts.length === 0 ? "" : `, and ${reinterpretedParts.length} catalog part appearance${reinterpretedParts.length === 1 ? "" : "s"} used by this model changed (${reinterpretedParts.join(", ")})`}.`,
            );
          } else if (report.blockingReasons.length > 0) {
            setMigrationNotice(
              `This model is pinned to ${report.fromCatalogVersion} and was left unchanged: ${report.blockingReasons[0]}`,
            );
          }
          dispatch({ type: "restoreState", state: restored });
          lastQueuedStateHashRef.current = canonicalDigest(restored);
        }
        saveQueueRef.current = new ProjectSaveQueue(repository, projectId, stored?.generation ?? 0);
        if (!stored) lastQueuedStateHashRef.current = null;
        setProjectHydration({ state: "ready" });
        void repository.list().then((rows) => {
          if (active) setProjects(rows);
        });
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
      void (queue?.flush() ?? Promise.resolve()).catch(() => undefined);
    };
  }, [projectId]);

  // The repository outlives project switches; only unmounting closes it.
  useEffect(
    () => () => {
      void repositoryRef.current?.close().catch(() => undefined);
      repositoryRef.current = null;
    },
    [],
  );

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

  // Stable identity: the catalog panel is memoized, and a fresh handler on every
  // render would put its 84 parts back into every unrelated re-render.
  const runCommand = useCallback((command: () => void) => {
    try {
      importGenerationRef.current += 1;
      command();
      setCommandError(null);
    } catch (error) {
      setCommandError(
        error instanceof ManualCommandError ? error.message : "The command could not be applied",
      );
    }
  }, []);

  /**
   * Returns the whole workspace to its opening state, not just the document:
   * selection, playback, errors, and the camera framing all go back to where a
   * fresh session starts.
   */
  function resetScene() {
    importGenerationRef.current += 1;
    setPlaybackPlaying(false);
    setPlaybackPosition(null);
    setDraggedCatalogPartId(null);
    setCommandError(null);
    setMigrationNotice(null);
    dispatch({ type: "replaceDocument", document: initialDocument() });
    setFrameToken((token) => token + 1);
  }

  /** Flushes pending writes before the open project changes underneath them. */
  async function switchTo(nextProjectId: string, seed?: EditorState) {
    const queue = saveQueueRef.current;
    saveQueueRef.current = null;
    await (queue?.flush() ?? Promise.resolve()).catch(() => undefined);
    importGenerationRef.current += 1;
    setPlaybackPlaying(false);
    setPlaybackPosition(null);
    setCommandError(null);
    setMigrationNotice(null);
    lastQueuedStateHashRef.current = null;
    setProjectHydration({ state: "loading" });
    if (seed) dispatch({ type: "restoreState", state: seed });
    setProjectId(nextProjectId);
    setFrameToken((token) => token + 1);
  }

  function newProjectId(): string {
    return `project-${canonicalDigest({ at: state.document.revision, existing: projects.length }).slice(7, 19)}`;
  }

  function openProject(nextProjectId: string) {
    void switchTo(nextProjectId);
  }

  function createProject() {
    void switchTo(newProjectId(), createEditorState(initialDocument()));
  }

  /** A copy starts from the current editor state under a fresh project id. */
  function duplicateProject() {
    void switchTo(newProjectId(), {
      ...state,
      document: { ...state.document, name: `${state.document.name} copy` },
    });
  }

  function deleteProject(target: string) {
    const summary = projects.find(({ projectId: id }) => id === target);
    if (!summary || !window.confirm(`Delete "${summary.name}" permanently?`)) return;
    const repository = repositoryRef.current;
    if (!repository) return;
    void repository
      .delete(target, summary.generation)
      .then(() => repository.list())
      .then((rows) => {
        setProjects(rows);
        // Deleting the open project leaves the editor on a fresh one.
        if (target === projectId) createProject();
      })
      .catch((error: unknown) => setPersistenceError(localStorageErrorMessage(error)));
  }

  async function importInstructions(file: File) {
    setInstructionSource(null);
    setInstructionProgress(`Reading ${file.name}…`);
    try {
      const source = await ingestInstructionPdf(file, {
        onProgress: (read, total) => setInstructionProgress(`Reading page ${read} of ${total}…`),
      });
      setInstructionSource(source);
      setInstructionProgress(null);
      setCommandError(null);
    } catch (error) {
      setInstructionProgress(null);
      setCommandError(
        error instanceof InstructionIngestError
          ? error.message
          : `Could not read ${file.name} as instructions: ${
              error instanceof Error ? error.message : String(error)
            }`,
      );
    }
  }

  const applyTransaction = useCallback(
    (transaction: EditorTransaction) => {
      applyBuildOperations(state.document, transaction.operations);
      dispatch({ type: "applyTransaction", transaction });
    },
    [state.document],
  );

  const addPart = useCallback(() => {
    runCommand(() => {
      const transaction = createAddPartTransaction(state.document, {
        catalogPartId,
        colorId,
        selectedPartId: state.selectedPartId,
      });
      applyTransaction(transaction);
      dispatch({ type: "selectPart", partId: transaction.partId });
    });
  }, [applyTransaction, catalogPartId, colorId, runCommand, state.document, state.selectedPartId]);

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
        <ProjectBar
          name={state.document.name}
          partCount={state.document.parts.length}
          statusLabel={
            projectHydration.state === "degraded" || persistenceError !== null
              ? "session only"
              : saveStatus === "saved"
                ? "saved locally"
                : saveStatus
          }
          projects={projects}
          currentProjectId={projectId}
          onRename={(name) => dispatch({ type: "renameDocument", name })}
          onOpen={openProject}
          onCreate={createProject}
          onDuplicate={duplicateProject}
          onDelete={deleteProject}
        />
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
          <button
            type="button"
            className="quiet-action"
            title="Read a set instruction PDF"
            onClick={() => instructionInputRef.current?.click()}
          >
            Instructions
          </button>
          <input
            ref={instructionInputRef}
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importInstructions(file);
              event.target.value = "";
            }}
          />
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

      <div
        className="studio-grid"
        style={{
          gridTemplateColumns: `${catalogWidth}px 6px minmax(320px, 1fr) 6px ${inspectorWidth}px`,
        }}
      >
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

        <PanelSplitter
          side="left"
          width={catalogWidth}
          minWidth={210}
          maxWidth={560}
          onWidthChange={setCatalogWidth}
          label="Resize the part catalog"
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
            selectedPartId={state.selectedPartId}
            frameToken={frameToken}
            onDisarm={() => setDraggedCatalogPartId(null)}
            draggedCatalogPartId={draggedCatalogPartId}
            onSelectPart={(partId) => dispatch({ type: "selectPart", partId })}
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
          {instructionProgress ? (
            <div className="command-error command-error--notice" role="status">
              {instructionProgress}
            </div>
          ) : null}
          {instructionSource ? (
            <div className="command-error command-error--notice" role="status">
              Read {instructionSource.fileName}:{" "}
              {summarizeInstructionSource(instructionSource).pageCount} pages,{" "}
              {summarizeInstructionSource(instructionSource).pagesWithText} with text,{" "}
              {summarizeInstructionSource(instructionSource).megabytes} MB.{" "}
              <code>{instructionSource.contentHash.slice(0, 18)}…</code> Interpreting these pages
              into build steps is not implemented yet.
            </div>
          ) : null}
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

        <PanelSplitter
          side="right"
          width={inspectorWidth}
          minWidth={240}
          maxWidth={620}
          onWidthChange={setInspectorWidth}
          label="Resize the inspector"
        />

        <aside className="panel inspector-panel" aria-label="Inspector and validation">
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
        </aside>
      </div>
    </main>
  );
}
