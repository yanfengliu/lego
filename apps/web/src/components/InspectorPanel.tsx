import { useState } from "react";

import { COLOR_DEFINITIONS, UPRIGHT_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

interface InspectorPanelProps {
  readonly part: PartInstance | null;
  readonly connected: boolean;
  readonly onApply: (changes: {
    readonly colorId: string;
    readonly transform: RigidTransform;
  }) => void;
  readonly onDelete: () => void;
}

export function InspectorPanel({ part, connected, onApply, onDelete }: InspectorPanelProps) {
  const [colorId, setColorId] = useState(part?.colorId ?? "builtin:red");
  const [position, setPosition] = useState<[number, number, number]>(
    part ? [...part.transform.positionLdu] : [0, 0, 0],
  );
  const [orientationId, setOrientationId] = useState(
    part?.transform.orientationId ?? "upright-yaw-0",
  );

  const definition = part ? getPartDefinition(part.catalogPartId) : undefined;
  const transformChanged =
    part !== null &&
    (orientationId !== part.transform.orientationId ||
      position.some((coordinate, axis) => coordinate !== part.transform.positionLdu[axis]));

  return (
    <section className="inspector-section" aria-labelledby="selection-heading">
      <div className="section-heading">
        <p className="kicker">Precise edit</p>
        <h2 id="selection-heading">Selection</h2>
      </div>
      {part === null ? (
        <div className="panel-empty">
          <span aria-hidden="true">◇</span>
          <p>Select a brick in the viewport to edit its canonical transform.</p>
        </div>
      ) : (
        <div className="inspector-form">
          <div className="selection-title">
            <div>
              <strong>{definition?.displayName ?? part.catalogPartId}</strong>
              <small>{part.id}</small>
            </div>
            <span className={connected ? "connection-dot is-connected" : "connection-dot"}>
              {connected ? "connected" : "free"}
            </span>
          </div>

          <label>
            <span className="field-label">Color</span>
            <select value={colorId} onChange={(event) => setColorId(event.target.value)}>
              {COLOR_DEFINITIONS.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.displayName}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="field-label">Position · LDU</legend>
            <div className="coordinate-grid">
              {(["X", "Y", "Z"] as const).map((axis, index) => (
                <label key={axis}>
                  <span>{axis}</span>
                  <input
                    type="number"
                    step={index === 1 ? 8 : 10}
                    value={position[index]}
                    onChange={(event) => {
                      const next = [...position] as [number, number, number];
                      next[index] = Number(event.target.value);
                      setPosition(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            <span className="field-label">Upright orientation</span>
            <select
              value={orientationId}
              onChange={(event) => setOrientationId(event.target.value)}
            >
              {UPRIGHT_ORIENTATIONS.map((orientation) => (
                <option key={orientation.id} value={orientation.id}>
                  {orientation.quarterTurns * 90}° yaw
                </option>
              ))}
            </select>
          </label>

          {connected && transformChanged ? (
            <p className="inline-warning">
              Applying this transform explicitly detaches its connections.
            </p>
          ) : null}

          <div className="button-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                onApply({ colorId, transform: { positionLdu: position, orientationId } })
              }
            >
              {connected && transformChanged ? "Detach & apply" : "Apply changes"}
            </button>
            <button type="button" className="danger-action" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
