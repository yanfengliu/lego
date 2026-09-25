import { useEffect, useRef, useState } from "react";

import { createModelScene, type ModelScene } from "./model-scene";

/** The 3D view: orbit, pan and zoom with the mouse, and a button back to the starting view. */
export function ModelView({
  mpd,
  stepOf,
  step,
}: {
  readonly mpd: string;
  readonly stepOf: readonly number[];
  readonly step: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ModelScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | { readonly error: string }>("loading");

  useEffect(() => {
    const scene = createModelScene(hostRef.current!);
    sceneRef.current = scene;
    let cancelled = false;
    scene.load(mpd, stepOf).then(
      () => {
        if (!cancelled) setStatus("ready");
      },
      (reason: unknown) => {
        if (!cancelled)
          setStatus({ error: reason instanceof Error ? reason.message : String(reason) });
      },
    );
    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene.dispose();
    };
  }, [mpd, stepOf]);

  useEffect(() => {
    if (status === "ready") sceneRef.current?.showStep(step);
  }, [status, step]);

  return (
    <div className="model-view" ref={hostRef} aria-label="3D model">
      {status !== "ready" && (
        <p className="panel-message">{status === "loading" ? "Loading model…" : status.error}</p>
      )}
      <button
        type="button"
        className="reset-view"
        onClick={() => sceneRef.current?.resetView()}
        disabled={status !== "ready"}
      >
        Reset view
      </button>
    </div>
  );
}
