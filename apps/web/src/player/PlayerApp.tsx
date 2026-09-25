import { useCallback, useEffect, useState } from "react";

import { ModelView } from "./ModelView";
import { PagePanel } from "./PagePanel";
import {
  parsePlayerSetsIndex,
  parsePlayerSteps,
  stepOfEachPart,
  type PlayerStepsFile,
} from "./player-data";

/** The dev server's player-data routes (tools/player/serve.ts). */
const DATA_ROOT = "/player-data";
/** Seconds per step at 1x. */
const BASE_SECONDS = 1.5;
const SPEEDS = [0.5, 1, 2, 4] as const;
/** Refuse a model file past this many characters rather than hang the page parsing it. */
const MAX_MODEL_CHARACTERS = 64 * 1024 * 1024;

interface Loaded {
  readonly setId: string;
  readonly steps: PlayerStepsFile;
  readonly mpd: string;
  readonly stepOf: readonly number[];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) {
    const detail = response.headers.get("Content-Type")?.startsWith("text/plain")
      ? text
      : `${url} answered ${response.status}`;
    throw new Error(`Player data missing: run npm start. (${detail})`);
  }
  return text;
}

async function loadPlayerData(): Promise<Loaded> {
  const index = parsePlayerSetsIndex(JSON.parse(await fetchText(`${DATA_ROOT}/sets.json`)));
  const wanted = new URLSearchParams(window.location.search).get("set");
  const set = index.sets.find(({ id }) => id === wanted) ?? index.sets[0];
  if (!set) throw new Error("Player data missing: tools/player/sets.ts lists no set.");
  const steps = parsePlayerSteps(JSON.parse(await fetchText(`${DATA_ROOT}/${set.id}/steps.json`)));
  const mpd = await fetchText(`${DATA_ROOT}/${set.id}/model.mpd`);
  if (mpd.length > MAX_MODEL_CHARACTERS) {
    throw new Error(
      `model.mpd is ${mpd.length} characters, over the player's ${MAX_MODEL_CHARACTERS}.`,
    );
  }
  return { setId: set.id, steps, mpd, stepOf: stepOfEachPart(mpd, steps) };
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

export function PlayerApp() {
  const [loaded, setLoaded] = useState<Loaded | { readonly error: string } | null>(null);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    loadPlayerData().then(
      (data) => {
        if (cancelled) return;
        document.title = `${data.steps.set.name} · build player`;
        setLoaded(data);
      },
      (reason: unknown) => {
        if (!cancelled)
          setLoaded({ error: reason instanceof Error ? reason.message : String(reason) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const last = loaded && "steps" in loaded ? loaded.steps.steps.length : 1;
  const go = useCallback((next: number) => setStep(Math.min(last, Math.max(1, next))), [last]);
  const togglePlay = useCallback(() => {
    // Play from the last step starts over.
    if (!playing && step >= last) setStep(1);
    setPlaying(!playing);
  }, [playing, step, last]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => {
        const next = Math.min(last, step + 1);
        setStep(next);
        // Play stops on the last step.
        if (next >= last) setPlaying(false);
      },
      (BASE_SECONDS * 1000) / speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, step, last, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      const actions: Record<string, () => void> = {
        " ": togglePlay,
        ArrowLeft: () => go(step - 1),
        ArrowRight: () => go(step + 1),
        Home: () => go(1),
        End: () => go(last),
      };
      const action = actions[event.key];
      if (!action) return;
      // Space would also press a focused button; the player owns these keys.
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, togglePlay, step, last]);

  if (loaded === null) return <p className="player-message">Loading player data…</p>;
  if ("error" in loaded) return <p className="player-message">{loaded.error}</p>;

  const current = loaded.steps.steps[step - 1]!;
  const plural = current.partsAdded === 1 ? "part" : "parts";
  return (
    <div className="player">
      <div className="stage">
        <ModelView
          mpd={loaded.mpd}
          stepOf={loaded.stepOf}
          step={step}
          source={loaded.steps.set.modelSource}
        />
        <PagePanel url={`${DATA_ROOT}/${loaded.setId}/booklet.pdf`} page={current.page} />
      </div>
      <div className="controls" role="group" aria-label="Playback">
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="First step"
          title="First step (Home)"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => go(step - 1)}
          aria-label="Previous step"
          title="Previous step (←)"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          title="Play or pause (Space)"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => go(step + 1)}
          aria-label="Next step"
          title="Next step (→)"
        >
          ▶|
        </button>
        <button
          type="button"
          onClick={() => go(last)}
          aria-label="Last step"
          title="Last step (End)"
        >
          ⏭
        </button>
        <label className="speed">
          Speed
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <input
          className="scrubber"
          type="range"
          min={1}
          max={last}
          value={step}
          aria-label="Step"
          onChange={(event) => go(Number(event.target.value))}
        />
        <output className="step-label" aria-live="polite">
          Step {step} / {last} · page {current.page} · +{current.partsAdded} {plural}
        </output>
      </div>
    </div>
  );
}
