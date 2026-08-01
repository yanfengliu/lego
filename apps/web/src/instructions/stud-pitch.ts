/**
 * Measures the stud pitch a step's artwork is drawn at, from the scallops the
 * studs leave along the upper edge of its highlight outline.
 *
 * Instruction art outlines the parts a step adds. Where those parts carry studs,
 * the outline's upper edge is not straight: each stud pushes a bump through it,
 * and the bumps repeat at the stud pitch as projected into the page. Recovering
 * that period turns a region's extent into a count of studs, which is the first
 * measurement about a step stated in brick units rather than pixels.
 *
 * Three findings from rendering the sample booklet and looking at it shape the
 * whole design, and each cost an attempt that failed:
 *
 * - The edge is piecewise linear. A highlight outline turns corners, and one
 *   straight-line fit cannot flatten that; the leftover trend then dominates any
 *   periodicity. The corners are found and cut instead, and only straight pieces
 *   are measured — see `stud-pitch-profile.ts`.
 * - Repeating proves nothing on its own. A sloped line rounded into whole raster
 *   rows stair-steps, and a staircase repeats exactly and forever: `round(0.45x)`
 *   has period 20. What separates a stud from a stair is how far the edge moves.
 * - Moving far enough proves nothing either. Thresholding an anti-aliased stroke
 *   into a binary mask makes the traced edge wander by a row or two, correlated
 *   along its length, which both clears an amplitude floor and repeats well
 *   enough to fool a single-lag test — on page 120 of the sample booklet that
 *   produced a confident 26 px pitch from an outline that is visibly straight.
 *   Only requiring the wobble to gather onto the harmonics of one period, and to
 *   leave the half-multiples between them empty, refuses it.
 *
 * Plenty of steps add tiles, or parts seen edge-on, whose outlines carry no
 * scallops whatever. Reporting no pitch for those is the correct answer, not a
 * failure, so every refusal says what was measured and what would have passed.
 */
import { coarsePeaks, refinePeak, usablePitchRange } from "./stud-pitch-comb";
import {
  STUD_PITCH_DEFAULTS,
  STUD_PITCH_SCHEMA_VERSION,
  prepareRun,
  type EdgeRun,
  type Evaluated,
  type PreparedRun,
  type StudPitchEstimate,
  type StudPitchOptions,
} from "./stud-pitch-profile";

export { STUD_PITCH_DEFAULTS, STUD_PITCH_SCHEMA_VERSION };
export type { EdgeRun, StudPitchEstimate, StudPitchOptions };

/**
 * Cuts a per-column top-edge profile into runs at its discontinuities.
 *
 * A gap is a column the region does not reach; a jump is where the topmost
 * outlined row hands over from one branch of the outline to another. Neither is
 * an edge the studs scalloped, and carrying either into the measurement makes a
 * profile piecewise in a way no amount of levelling repairs.
 */
export function splitIntoRuns(
  profile: readonly (number | null)[],
  options: Partial<StudPitchOptions> = {},
): readonly EdgeRun[] {
  const { maxRowJumpPx, minPitchPx, minPeriodsPerRun } = { ...STUD_PITCH_DEFAULTS, ...options };
  const shortest = minPitchPx * minPeriodsPerRun;
  const runs: EdgeRun[] = [];
  let startX = 0;
  let rows: number[] = [];

  const flush = (): void => {
    if (rows.length >= shortest) runs.push({ startX, rows });
    rows = [];
  };

  for (let x = 0; x < profile.length; x += 1) {
    const row = profile[x];
    if (row === null || row === undefined) {
      flush();
      continue;
    }
    const previous = rows.at(-1);
    if (previous !== undefined && Math.abs(row - previous) > maxRowJumpPx) flush();
    if (rows.length === 0) startX = x;
    rows.push(row);
  }
  flush();
  return runs;
}

function refuse(
  rejected: string,
  prepared: readonly PreparedRun[],
  columnsUsed: number,
): StudPitchEstimate {
  return {
    schemaVersion: STUD_PITCH_SCHEMA_VERSION,
    pitchPx: null,
    rejected,
    combShare: 0,
    fundamentalShare: 0,
    halfShare: 0,
    rippleRows: 0,
    segmentsUsed: prepared.reduce((total, run) => total + run.segments.length, 0),
    columnsUsed,
  };
}

/**
 * Estimates the stud pitch shared by a set of edge runs from one step's
 * artwork, or explains why the edge carries no pitch at all.
 */
export function estimateStudPitch(
  runs: readonly EdgeRun[],
  options: Partial<StudPitchOptions> = {},
): StudPitchEstimate {
  const settings = { ...STUD_PITCH_DEFAULTS, ...options };
  const columnsUsed = runs.reduce((total, run) => total + run.rows.length, 0);
  const prepared = runs
    .map((run) => prepareRun(run, settings))
    .filter((run): run is PreparedRun => run !== null);

  if (prepared.length === 0) {
    const longest = runs.reduce((most, run) => Math.max(most, run.rows.length), 0);
    return refuse(
      `No run of the highlight's upper edge is usable: the longest of ${runs.length} run(s) spans ${longest} columns and ${settings.minSamples} are needed to see even the shortest searched pitch of ${settings.minPitchPx} px`,
      prepared,
      columnsUsed,
    );
  }

  const { longest, maxPitchPx } = usablePitchRange(prepared, settings);
  if (maxPitchPx < settings.minPitchPx) {
    return refuse(
      `The longest straight piece of edge spans ${Math.round(longest)} columns, which holds fewer than the ${settings.windowPeriods + settings.minCyclesMeasured} periods of the shortest searched pitch (${settings.minPitchPx} px) this comb needs`,
      prepared,
      columnsUsed,
    );
  }

  const peaks = coarsePeaks(prepared, settings);
  if (peaks.length === 0) {
    return refuse(
      `No period between ${settings.minPitchPx} and ${Math.round(maxPitchPx)} px stands out at all across ${prepared.reduce((total, run) => total + run.segments.length, 0)} straight piece(s) of edge totalling ${columnsUsed} columns; the edge climbs or falls smoothly and carries no scallops`,
      prepared,
      columnsUsed,
    );
  }

  const evaluated: Evaluated[] = [];
  for (const peak of peaks) {
    const reading = refinePeak(prepared, peak.pitchPx, settings);
    if (reading === null) continue;
    const duplicate = evaluated.find(
      (other) => Math.abs(other.pitchPx - reading.pitchPx) / reading.pitchPx < 0.015,
    );
    if (duplicate === undefined) evaluated.push(reading);
  }
  if (evaluated.length === 0) {
    return refuse(
      `None of the ${peaks.length} candidate period(s) near ${peaks.map((peak: { pitchPx: number }) => peak.pitchPx.toFixed(1)).join(", ")} px could be measured: too little edge survives the high-pass at that width`,
      prepared,
      columnsUsed,
    );
  }

  const accepted = evaluated.filter(
    (item) =>
      item.combShare >= settings.minCombShare &&
      item.fundamentalShare >= settings.minFundamentalShare &&
      item.halfShare <= settings.maxHalfShare &&
      item.rippleRows >= settings.minRippleRows,
  );

  if (accepted.length === 0) {
    const strongest = evaluated.reduce((best, item) =>
      item.combPower > best.combPower ? item : best,
    );
    const failed = strongest.rippleRows < settings.minRippleRows;
    return refuse(
      failed
        ? `The edge repeats every ${strongest.pitchPx.toFixed(2)} px but only moves ${strongest.rippleRows.toFixed(2)} rows peak to peak there, and a stud must clear ${settings.minRippleRows}. Rounding a sloped line into whole rows makes a staircase, and a staircase repeats for that reason alone — which is what this profile looks like`
        : `The best period found, ${strongest.pitchPx.toFixed(2)} px, gathers ${(strongest.combShare * 100).toFixed(0)}% of the edge's wobble into its harmonics (${(settings.minCombShare * 100).toFixed(0)}% needed), holds ${(strongest.fundamentalShare * 100).toFixed(0)}% of that on its own frequency (${(settings.minFundamentalShare * 100).toFixed(0)}% needed) and leaves ${(strongest.halfShare * 100).toFixed(0)}% on the half-multiples where a true period leaves none (${(settings.maxHalfShare * 100).toFixed(0)}% allowed)`,
      prepared,
      columnsUsed,
    );
  }

  // A signal that repeats every P repeats every 2P as well, so the shortest
  // period that explains the edge as well as the best one does is the pitch.
  const strongest = accepted.reduce((best, item) =>
    item.combPower > best.combPower ? item : best,
  );
  const chosen = accepted
    .filter((item) => item.combPower >= 0.85 * strongest.combPower)
    .reduce((shortest, item) => (item.pitchPx < shortest.pitchPx ? item : shortest));

  return {
    schemaVersion: STUD_PITCH_SCHEMA_VERSION,
    pitchPx: chosen.pitchPx,
    rejected: null,
    combShare: chosen.combShare,
    fundamentalShare: chosen.fundamentalShare,
    halfShare: chosen.halfShare,
    rippleRows: chosen.rippleRows,
    segmentsUsed: prepared.reduce((total, run) => total + run.segments.length, 0),
    columnsUsed,
  };
}
