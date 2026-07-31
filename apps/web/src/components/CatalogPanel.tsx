import { useMemo, useState } from "react";

import {
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
  getColorDefinition,
  type ColorDefinition,
  type PartDefinition,
} from "@lego-studio/catalog";

import { PartPreview } from "./PartPreview";

interface CatalogPanelProps {
  readonly selectedPartDefinitionId: string;
  readonly selectedColorId: string;
  readonly canAttach: boolean;
  readonly documentIsEmpty: boolean;
  readonly onPartDefinitionChange: (partId: string) => void;
  readonly onColorChange: (colorId: string) => void;
  readonly onAdd: () => void;
  readonly onDragStateChange: (partId: string | null) => void;
}

function PartOption({
  part,
  colorHex,
  selected,
  onSelect,
  onDragStateChange,
}: {
  readonly part: PartDefinition;
  readonly colorHex: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onDragStateChange: (partId: string | null) => void;
}) {
  return (
    <button
      type="button"
      className={`part-option${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      title={`${part.displayName} — drag into the model to place it`}
      draggable
      onClick={onSelect}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", part.id);
        onSelect();
        onDragStateChange(part.id);
      }}
      onDragEnd={() => onDragStateChange(null)}
    >
      <PartPreview part={part} colorHex={colorHex} />
      <span className="part-option__copy">
        <strong>{part.displayName}</strong>
        <small>
          {part.dimensions.widthStuds} × {part.dimensions.lengthStuds} · {part.family}
        </small>
      </span>
    </button>
  );
}

function ColorOption({
  color,
  selected,
  onSelect,
}: {
  readonly color: ColorDefinition;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`color-option${selected ? " is-selected" : ""}`}
      aria-label={color.displayName}
      aria-pressed={selected}
      title={`${color.displayName} · ${color.displayHex}`}
      onClick={onSelect}
      style={{ "--swatch": color.displayHex } as React.CSSProperties}
    />
  );
}

function ColorPanel({
  selectedColorId,
  onColorChange,
}: {
  readonly selectedColorId: string;
  readonly onColorChange: (colorId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const selected = getColorDefinition(selectedColorId);
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? COLOR_DEFINITIONS.filter(
        (color) =>
          color.displayName.toLowerCase().includes(normalized) ||
          color.displayHex.toLowerCase().includes(normalized),
      )
    : COLOR_DEFINITIONS;
  // Collapsed, the panel shows one dense row; expanded, the whole palette. The
  // current colour always stays on screen so the selection is never hidden.
  const collapsed = matches.slice(0, 9);
  const visible =
    expanded || normalized
      ? matches
      : collapsed.some(({ id }) => id === selectedColorId) || !selected
        ? collapsed
        : [selected, ...collapsed.slice(0, 8)];

  return (
    <div className="color-panel">
      <div className="color-panel__header">
        <span className="field-label">Color</span>
        <span className="color-panel__current" title={selected?.displayHex}>
          {selected?.displayName ?? "Unknown"}
          <code>{selected?.displayHex ?? "—"}</code>
        </span>
      </div>
      {expanded ? (
        <label className="search-field search-field--compact">
          <span className="sr-only">Search colors</span>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search colors or hex"
          />
        </label>
      ) : null}
      <div className="color-grid" aria-label="Palette">
        {visible.map((color) => (
          <ColorOption
            key={color.id}
            color={color}
            selected={color.id === selectedColorId}
            onSelect={() => onColorChange(color.id)}
          />
        ))}
      </div>
      {visible.length === 0 ? <p className="color-panel__empty">No color matches {query}</p> : null}
      <button
        type="button"
        className="color-panel__toggle"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded);
          if (expanded) setQuery("");
        }}
      >
        {expanded ? "Show fewer" : `All ${COLOR_DEFINITIONS.length} colors`}
      </button>
    </div>
  );
}

export function CatalogPanel({
  selectedPartDefinitionId,
  selectedColorId,
  canAttach,
  documentIsEmpty,
  onPartDefinitionChange,
  onColorChange,
  onAdd,
  onDragStateChange,
}: CatalogPanelProps) {
  const [query, setQuery] = useState("");
  const colorHex = getColorDefinition(selectedColorId)?.displayHex ?? "#c91a09";
  const parts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? PART_DEFINITIONS.filter((part) => part.displayName.toLowerCase().includes(normalized))
      : PART_DEFINITIONS;
  }, [query]);

  return (
    <aside className="panel catalog-panel" aria-label="Part catalog">
      <div className="panel-heading">
        <div>
          <p className="kicker">Basic catalog</p>
          <h2>Parts</h2>
        </div>
        <span className="count-badge">{PART_DEFINITIONS.length}</span>
      </div>

      <label className="search-field">
        <span className="sr-only">Search parts</span>
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search basic parts"
        />
      </label>

      <div className="part-list" aria-label="Basic parts">
        {parts.map((part) => (
          <PartOption
            key={part.id}
            part={part}
            colorHex={colorHex}
            selected={part.id === selectedPartDefinitionId}
            onSelect={() => onPartDefinitionChange(part.id)}
            onDragStateChange={onDragStateChange}
          />
        ))}
      </div>

      <div className="catalog-footer">
        <ColorPanel selectedColorId={selectedColorId} onColorChange={onColorChange} />
        <button
          type="button"
          className="primary-action"
          disabled={!documentIsEmpty && !canAttach}
          onClick={onAdd}
        >
          <span aria-hidden="true">＋</span>
          {documentIsEmpty
            ? "Place at origin"
            : canAttach
              ? "Attach to selection"
              : "Select a part"}
        </button>
      </div>
    </aside>
  );
}
