import { useEffect, useRef, useState } from "react";

import type { ProjectSummary } from "../persistence/indexeddb-project-repository";

export interface ProjectBarProps {
  readonly name: string;
  readonly partCount: number;
  readonly statusLabel: string;
  readonly projects: readonly ProjectSummary[];
  readonly currentProjectId: string;
  readonly onRename: (name: string) => void;
  readonly onOpen: (projectId: string) => void;
  readonly onCreate: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: (projectId: string) => void;
}

/**
 * The document title doubles as the rename field and the project switcher.
 * Renaming commits on Enter or blur and abandons on Escape, so a half-typed
 * name never becomes the saved one by accident.
 */
export function ProjectBar({
  name,
  partCount,
  statusLabel,
  projects,
  currentProjectId,
  onRename,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
}: ProjectBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== name) onRename(trimmed);
    else setDraft(name);
  }

  return (
    <div className="project-bar">
      <div className="project-bar__row">
        {editing ? (
          <input
            ref={inputRef}
            className="project-title-input"
            aria-label="Project name"
            value={draft}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="project-title"
            title="Click to rename this project"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            {name}
          </button>
        )}
      </div>
      <small>
        {partCount} parts · {statusLabel}
      </small>

      <div className="project-menu" ref={menuRef}>
        <button
          type="button"
          className="quiet-action"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          Projects ▾
        </button>
        {menuOpen ? (
          <div className="project-menu__panel" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onCreate();
              }}
            >
              New project
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate();
              }}
            >
              Duplicate this project
            </button>
            <p className="project-menu__label">Saved projects</p>
            {projects.length === 0 ? (
              <p className="project-menu__empty">Nothing saved yet</p>
            ) : (
              projects.map((project) => (
                <div key={project.projectId} className="project-menu__row">
                  <button
                    type="button"
                    role="menuitem"
                    className={
                      project.projectId === currentProjectId
                        ? "project-menu__open is-current"
                        : "project-menu__open"
                    }
                    onClick={() => {
                      setMenuOpen(false);
                      if (project.projectId !== currentProjectId) onOpen(project.projectId);
                    }}
                  >
                    <span>{project.name}</span>
                    <small>{project.partCount} parts</small>
                  </button>
                  <button
                    type="button"
                    className="project-menu__delete"
                    aria-label={`Delete ${project.name}`}
                    title={`Delete ${project.name}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(project.projectId);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
