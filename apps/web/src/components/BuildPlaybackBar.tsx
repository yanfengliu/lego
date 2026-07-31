import { useEffect } from "react";

import type { BuildSequence } from "@lego-studio/brick-kernel";

/** Milliseconds each step holds while playing. */
export const PLAYBACK_STEP_MS = 900;

interface BuildPlaybackBarProps {
  readonly sequence: BuildSequence;
  /** Index into sequence.states, not the step index. */
  readonly position: number;
  readonly playing: boolean;
  readonly onSeek: (position: number) => void;
  readonly onPlayingChange: (playing: boolean) => void;
  readonly onExit: () => void;
}

export function BuildPlaybackBar({
  sequence,
  position,
  playing,
  onSeek,
  onPlayingChange,
  onExit,
}: BuildPlaybackBarProps) {
  const lastPosition = sequence.states.length - 1;
  const state = sequence.states[Math.min(position, lastPosition)];

  useEffect(() => {
    if (!playing) return;
    if (position >= lastPosition) {
      onPlayingChange(false);
      return;
    }
    const timer = window.setTimeout(() => onSeek(position + 1), PLAYBACK_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, position, lastPosition, onSeek, onPlayingChange]);

  if (!state) return null;

  return (
    <div className="playback-bar" role="group" aria-label="Build playback">
      <button
        type="button"
        className="icon-action"
        aria-label="Previous step"
        disabled={position <= 0}
        onClick={() => onSeek(position - 1)}
      >
        ◀
      </button>
      <button
        type="button"
        className="icon-action"
        aria-label={playing ? "Pause build" : "Play build"}
        onClick={() => {
          // Replaying from the end restarts rather than sitting still.
          if (!playing && position >= lastPosition) onSeek(0);
          onPlayingChange(!playing);
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        className="icon-action"
        aria-label="Next step"
        disabled={position >= lastPosition}
        onClick={() => onSeek(position + 1)}
      >
        ▶❙
      </button>

      <label className="playback-scrubber">
        <span className="sr-only">Build step</span>
        <input
          type="range"
          min={0}
          max={lastPosition}
          step={1}
          value={Math.min(position, lastPosition)}
          onChange={(event) => {
            onPlayingChange(false);
            onSeek(Number(event.target.value));
          }}
        />
      </label>

      <div className="playback-readout">
        <strong>{state.stepIndex < 0 ? "Start" : state.stepName}</strong>
        <small>
          {position} / {lastPosition} · {state.cumulativePartCount} parts
          {state.addedPartIds.length > 0 ? ` · +${state.addedPartIds.length}` : ""}
        </small>
      </div>

      <span
        className={state.buildable ? "playback-verdict is-ok" : "playback-verdict is-bad"}
        title={
          state.buildable
            ? state.connected
              ? "This step verifies as buildable"
              : "Buildable; subassemblies are still separate"
            : `Not buildable: ${state.blockingCodes.join(", ")}`
        }
      >
        {state.buildable ? (state.connected ? "verified" : "subassembly") : "unbuildable"}
      </span>

      <button type="button" className="quiet-action" onClick={onExit}>
        Exit
      </button>
    </div>
  );
}
