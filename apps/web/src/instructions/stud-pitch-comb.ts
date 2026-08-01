/**
 * Scores a candidate period with a comb: the sum of the power on every
 * harmonic of it, less the power on the half-multiples between them, where a
 * signal whose real period is twice as long would put its own.
 */
import {
  median,
  residualBlocks,
  type Evaluated,
  type PreparedRun,
  type ResidualBlock,
  type StudPitchOptions,
} from "./stud-pitch-profile";

interface CombReading {
  readonly powers: Float64Array;
  readonly variance: number;
  readonly samples: number;
}

/**
 * Power on each requested frequency, pooled over the runs.
 *
 * Blocks of the same run are summed coherently — they are one edge with one
 * stud lattice, and holding the phase across a corner is what buys the long
 * baseline that makes the estimate precise. Separate runs are pooled as power
 * only, since two stretches of outline need not start on the same stud.
 */
function combSpectrum(
  prepared: readonly PreparedRun[],
  blocks: readonly (readonly ResidualBlock[])[],
  freqs: readonly number[],
): CombReading {
  const teeth = freqs.length;
  const powers = new Float64Array(teeth);
  let pooledVariance = 0;
  let pooledWeight = 0;
  let pooledSamples = 0;

  const cosR = new Float64Array(teeth);
  const sinR = new Float64Array(teeth);
  const cosW = new Float64Array(teeth);
  const sinW = new Float64Array(teeth);
  const cosNow = new Float64Array(teeth);
  const sinNow = new Float64Array(teeth);
  const cosStep = new Float64Array(teeth);
  const sinStep = new Float64Array(teeth);
  for (let t = 0; t < teeth; t += 1) {
    cosStep[t] = Math.cos(2 * Math.PI * freqs[t]!);
    sinStep[t] = Math.sin(2 * Math.PI * freqs[t]!);
  }

  for (let runIndex = 0; runIndex < prepared.length; runIndex += 1) {
    const values = prepared[runIndex]!.scratch;
    const taper = prepared[runIndex]!.taper;
    cosR.fill(0);
    sinR.fill(0);
    cosW.fill(0);
    sinW.fill(0);
    let samples = 0;
    let weight = 0;
    let sum = 0;
    let sumSquares = 0;

    for (const block of blocks[runIndex]!) {
      for (let t = 0; t < teeth; t += 1) {
        const angle = 2 * Math.PI * freqs[t]! * block.x0;
        cosNow[t] = Math.cos(angle);
        sinNow[t] = Math.sin(angle);
      }
      for (let i = 0; i < block.count; i += 1) {
        const share = taper[block.from + i]!;
        const value = values[block.from + i]!;
        const weighted = share * value;
        weight += share;
        sum += weighted;
        sumSquares += weighted * value;
        for (let t = 0; t < teeth; t += 1) {
          const cosine = cosNow[t]!;
          const sine = sinNow[t]!;
          cosR[t]! += weighted * cosine;
          sinR[t]! += weighted * sine;
          cosW[t]! += share * cosine;
          sinW[t]! += share * sine;
          cosNow[t] = cosine * cosStep[t]! - sine * sinStep[t]!;
          sinNow[t] = sine * cosStep[t]! + cosine * sinStep[t]!;
        }
        // Rotating is cheaper than two trig calls a sample; the angle is
        // restated every 256 steps so the rotation cannot drift.
        if ((i & 255) === 255) {
          for (let t = 0; t < teeth; t += 1) {
            const angle = 2 * Math.PI * freqs[t]! * (block.x0 + i + 1);
            cosNow[t] = Math.cos(angle);
            sinNow[t] = Math.sin(angle);
          }
        }
      }
      samples += block.count;
    }

    if (samples < 2 || weight <= 0) continue;
    const mean = sum / weight;
    const variance = Math.max(0, sumSquares / weight - mean * mean);
    for (let t = 0; t < teeth; t += 1) {
      const real = cosR[t]! - mean * cosW[t]!;
      const imaginary = sinR[t]! - mean * sinW[t]!;
      powers[t]! += (2 * (real * real + imaginary * imaginary)) / weight;
    }
    pooledVariance += variance * weight;
    pooledWeight += weight;
    pooledSamples += samples;
  }

  if (pooledWeight === 0) return { powers, variance: 0, samples: 0 };
  for (let t = 0; t < teeth; t += 1) powers[t]! /= pooledWeight;
  return { powers, variance: pooledVariance / pooledWeight, samples: pooledSamples };
}

export function usablePitchRange(
  prepared: readonly PreparedRun[],
  settings: StudPitchOptions,
): { readonly longest: number; readonly maxPitchPx: number } {
  let longest = 0;
  for (const run of prepared) {
    for (const segment of run.segments) longest = Math.max(longest, segment.to - segment.from);
  }
  // A piece of length L keeps L - windowPeriods·P samples after high-passing,
  // and minCyclesMeasured of those periods have to survive.
  const maxPitchPx = longest / (settings.windowPeriods + settings.minCyclesMeasured);
  return { longest, maxPitchPx: Math.min(settings.maxPitchPx, maxPitchPx) };
}

/** Total power the comb's teeth stand on, and how many samples spoke to it. */
function readComb(
  prepared: readonly PreparedRun[],
  pitchPx: number,
  windowPx: number,
  teeth: readonly number[],
): CombReading {
  const blocks = prepared.map((run) => residualBlocks(run, windowPx));
  return combPowers(prepared, blocks, pitchPx, teeth);
}

/**
 * Power the comb's teeth stand on, with anything past the raster's own limit
 * discarded — a tooth above half a cycle per column is aliasing, not a stud.
 */
function combPowers(
  prepared: readonly PreparedRun[],
  blocks: readonly (readonly ResidualBlock[])[],
  pitchPx: number,
  teeth: readonly number[],
): CombReading {
  const freqs = teeth.map((tooth) => tooth / pitchPx);
  const reading = combSpectrum(prepared, blocks, freqs);
  for (let t = 0; t < freqs.length; t += 1) if (freqs[t]! >= 0.45) reading.powers[t] = 0;
  return reading;
}

/**
 * Every period the fundamental tooth stands up at.
 *
 * The scan is the first tooth alone, which is the one measurement whose peaks
 * are the periods themselves: a multiple 2P puts nothing on its own
 * fundamental, so it never becomes a peak here in the first place.
 */
export function coarsePeaks(
  prepared: readonly PreparedRun[],
  settings: StudPitchOptions,
): { readonly pitchPx: number; readonly power: number }[] {
  const { maxPitchPx } = usablePitchRange(prepared, settings);
  if (maxPitchPx < settings.minPitchPx) return [];

  const pitches: number[] = [];
  for (
    let pitch = settings.minPitchPx;
    pitch <= maxPitchPx;
    pitch *= 1 + settings.coarseStepRatio
  ) {
    pitches.push(pitch);
  }
  const power = pitches.map((pitch) => {
    const reading = readComb(prepared, pitch, settings.windowPeriods * pitch, [1]);
    return reading.samples >= Math.max(settings.minSamples, settings.minCyclesMeasured * pitch)
      ? reading.powers[0]!
      : 0;
  });

  const peaks: { pitchPx: number; power: number }[] = [];
  for (let i = 1; i < pitches.length - 1; i += 1) {
    if (power[i]! > power[i - 1]! && power[i]! >= power[i + 1]! && power[i]! > 0) {
      peaks.push({ pitchPx: pitches[i]!, power: power[i]! });
    }
  }
  peaks.sort((left, right) => right.power - left.power);
  return peaks.slice(0, settings.peaksExamined);
}

/**
 * Walks a coarse peak in to the period itself.
 *
 * The high-pass window is frozen at the coarse period for the whole refinement,
 * and that is what makes the reading unbiased. A window that tracked the trial
 * period would change the filter under the measurement — passing a little more
 * signal at one end of the sweep than the other and dragging the peak with it,
 * worth a third of a percent at fourteen periods and over a percent at eight.
 * Held still, the filter is one fixed gain on the edge's own frequency, so the
 * peak of the sweep sits where the edge actually repeats.
 */
export function refinePeak(
  prepared: readonly PreparedRun[],
  coarsePitchPx: number,
  settings: StudPitchOptions,
): Evaluated | null {
  const windowPx = settings.windowPeriods * coarsePitchPx;
  const blocks = prepared.map((run) => residualBlocks(run, windowPx));
  const combAt = (pitch: number, teeth: readonly number[]): CombReading =>
    combPowers(prepared, blocks, pitch, teeth);

  const scan = (
    centre: number,
    spanRatio: number,
    steps: number,
    teeth: readonly number[],
  ): number => {
    let bestPitch = centre;
    let bestPower = -1;
    const powers: number[] = [];
    const pitches: number[] = [];
    for (let s = 0; s < steps; s += 1) {
      const pitch = centre * (1 + spanRatio * ((2 * s) / (steps - 1) - 1));
      const reading = combAt(pitch, teeth);
      let total = 0;
      for (const value of reading.powers) total += value;
      pitches.push(pitch);
      powers.push(total);
      if (total > bestPower) {
        bestPower = total;
        bestPitch = pitch;
      }
    }
    // A parabola through the winning sample and its neighbours reads the peak
    // between them, which is where a period that is not a whole pixel lives.
    const at = powers.indexOf(bestPower);
    if (at > 0 && at < powers.length - 1) {
      const left = powers[at - 1]!;
      const right = powers[at + 1]!;
      const denominator = left - 2 * bestPower + right;
      if (denominator < 0) {
        const shift = (0.5 * (left - right)) / denominator;
        if (Math.abs(shift) <= 1)
          bestPitch = pitches[at]! + shift * (pitches[at]! - pitches[at - 1]!);
      }
    }
    return bestPitch;
  };

  const teeth: number[] = [];
  for (let k = 1; k <= settings.harmonics; k += 1) teeth.push(k);
  const halfTeeth = teeth.map((k) => k - 0.5);

  // The first tooth alone has one broad peak, so a wide sweep cannot land on
  // the wrong lobe; the full comb is only then let loose over a span narrower
  // than its own lobe spacing, to sharpen an answer that is already close.
  const fundamentalPitch = scan(coarsePitchPx, 0.025, 51, [1]);
  const pitchPx = scan(fundamentalPitch, 0.006, 41, teeth);

  const reading = combAt(pitchPx, teeth);
  if (reading.samples < Math.max(settings.minSamples, settings.minCyclesMeasured * pitchPx)) {
    return null;
  }
  const halfReading = combAt(pitchPx, halfTeeth);
  let combPower = 0;
  for (const value of reading.powers) combPower += value;
  let halfPower = 0;
  for (const value of halfReading.powers) halfPower += value;
  if (!(combPower > 0) || !(reading.variance > 0)) return null;

  return {
    pitchPx,
    combPower,
    combShare: combPower / reading.variance,
    fundamentalShare: reading.powers[0]! / combPower,
    halfShare: halfPower / combPower,
    rippleRows: rippleRowsAt(prepared, blocks, pitchPx),
    samples: reading.samples,
  };
}

/**
 * How far the edge actually moves over one period, in rows.
 *
 * The high-passed edge is folded onto the candidate period and each phase bin
 * reports its median, so the answer is an average of rows the edge really
 * occupied rather than the amplitude of a model fitted to it. That matters for
 * the one thing this estimator must never do: a bin median cannot exceed the
 * range of the data, so a staircase — whose deviation from its own trend is
 * bounded by rounding — cannot be talked up into a stud.
 */
function rippleRowsAt(
  prepared: readonly PreparedRun[],
  blocks: readonly (readonly ResidualBlock[])[],
  pitchPx: number,
): number {
  let samples = 0;
  for (const runBlocks of blocks) for (const block of runBlocks) samples += block.count;
  // One bin per column of the raster is as fine as the fold can honestly be
  // read, and coarser bins flatten the very peaks being measured — a stud two
  // rows deep folded into four-pixel bins reads a quarter shallower than it is.
  // Bins are widened only when the edge is too short to keep eight rows in each.
  const bins = Math.max(8, Math.min(48, Math.round(pitchPx), Math.floor(samples / 8)));
  const buckets: number[][] = Array.from({ length: bins }, () => []);
  for (let runIndex = 0; runIndex < prepared.length; runIndex += 1) {
    const values = prepared[runIndex]!.scratch;
    for (const block of blocks[runIndex]!) {
      for (let i = 0; i < block.count; i += 1) {
        const phase = (((block.x0 + i) % pitchPx) + pitchPx) % pitchPx;
        const bin = Math.min(bins - 1, Math.floor((phase / pitchPx) * bins));
        buckets[bin]!.push(values[block.from + i]!);
      }
    }
  }
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (const bucket of buckets) {
    if (bucket.length < 3) continue;
    const level = median(bucket);
    lowest = Math.min(lowest, level);
    highest = Math.max(highest, level);
  }
  return Number.isFinite(lowest) && Number.isFinite(highest) ? highest - lowest : 0;
}
