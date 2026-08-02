import type { LatticeBasisPx, PixelBoxPx, StudTextureField } from "./camera-fit-lattice.ts";

/**
 * Where the fitted grid actually sits on the page, and how far the picture
 * departs from it.
 *
 * A grid basis says how big the steps are; it does not say where the first stud
 * is. That is the lattice phase, and it is what turns "the camera looks like
 * this" into marks that can be drawn over the panel and looked at.
 *
 * The phase is also the honest place to measure error. Take the fundamental
 * Fourier component of the picture at the fitted grid frequency over a window,
 * and its argument is where that window thinks the grid sits. If the panel is
 * one orthographic projection, every window agrees. If it is a perspective
 * render, or the fitted pitch is a hair wrong, the windows walk — and the walk,
 * converted back through the basis, is a reprojection error in pixels.
 *
 * One confound has to be named rather than averaged away, and it is worse than
 * it first looks: a plate one brick higher draws its studs at the same grid
 * shifted straight up the page. A window seeing only that plate reports a purely
 * vertical offset, which the basis carries through as purely vertical, so it is
 * separable. A window seeing two heights at once does not — the argument of a
 * sum of two components is not a linear blend of their arguments, and the two
 * grid directions blend by different amounts, which leaks into the horizontal.
 * Measured on the sample booklet at 6 to 15px of horizontal spread on panels
 * whose predicted studs land within a pixel of the drawn ones.
 *
 * So this is an upper bound on how far one camera fails to explain a panel, not
 * the panel's reprojection error. `latticeSiteResiduals` is that measurement,
 * and comparing the basis fitted on one half of the art against the other half
 * is the layer-free test for a projection that changes across the page.
 */

export interface LatticeReciprocal {
  /** Cycles per pixel along each grid direction: `f1 . a = 1`, `f1 . b = 0`. */
  readonly f1XPx: number;
  readonly f1YPx: number;
  readonly f2XPx: number;
  readonly f2YPx: number;
}

export function latticeReciprocal(basis: LatticeBasisPx): LatticeReciprocal | null {
  const determinant = basis.a.xPx * basis.b.yPx - basis.a.yPx * basis.b.xPx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return null;
  return {
    f1XPx: basis.b.yPx / determinant,
    f1YPx: -basis.b.xPx / determinant,
    f2XPx: -basis.a.yPx / determinant,
    f2YPx: basis.a.xPx / determinant,
  };
}

/** Where a grid sits, in cycles along each direction. */
export interface LatticePhaseOffset {
  readonly phase1: number;
  readonly phase2: number;
}

export interface LatticePhase extends LatticePhaseOffset {
  /** Grid offset in cycles, each in (-0.5, 0.5]. */
  readonly phase1: number;
  readonly phase2: number;
  /**
   * How much of the window's contrast lines up with the grid at all, in 0..1.
   * Text, arrows and the printed outlines all push it down, so it is a floor on
   * how grid-like the window is rather than a measure of the fit alone.
   */
  readonly coherence1: number;
  readonly coherence2: number;
  readonly samples: number;
}

const TAU = Math.PI * 2;

/**
 * The fundamental Fourier component of the texture at the grid frequencies.
 *
 * A window is tapered, not cut. A hard edge across a periodic pattern leaks a
 * whole cycle's worth of phase depending on whether the window happens to hold
 * a whole number of periods, and that leakage is indistinguishable from the
 * drift the windows exist to measure — measured at over a pixel of phantom
 * scatter on a panel with no scatter in it at all.
 */
export function latticePhase(
  field: StudTextureField,
  reciprocal: LatticeReciprocal,
  box?: PixelBoxPx,
): LatticePhase | null {
  const { sampleX, sampleY, texture, width } = field;
  const spanX = box === undefined ? 0 : box.maxXPx - box.minXPx;
  const spanY = box === undefined ? 0 : box.maxYPx - box.minYPx;
  let real1 = 0;
  let imaginary1 = 0;
  let real2 = 0;
  let imaginary2 = 0;
  let magnitude = 0;
  let samples = 0;
  for (let index = 0; index < sampleX.length; index += 1) {
    const x = sampleX[index]!;
    const y = sampleY[index]!;
    let taper = 1;
    if (box !== undefined) {
      if (x < box.minXPx || x > box.maxXPx || y < box.minYPx || y > box.maxYPx) continue;
      if (spanX <= 0 || spanY <= 0) continue;
      taper =
        0.25 *
        (1 - Math.cos((TAU * (x - box.minXPx)) / spanX)) *
        (1 - Math.cos((TAU * (y - box.minYPx)) / spanY));
      if (taper <= 0) continue;
    }
    const value = taper * texture[y * width + x]!;
    const angle1 = -TAU * (reciprocal.f1XPx * x + reciprocal.f1YPx * y);
    const angle2 = -TAU * (reciprocal.f2XPx * x + reciprocal.f2YPx * y);
    real1 += value * Math.cos(angle1);
    imaginary1 += value * Math.sin(angle1);
    real2 += value * Math.cos(angle2);
    imaginary2 += value * Math.sin(angle2);
    magnitude += Math.abs(value);
    samples += 1;
  }
  if (samples === 0 || magnitude === 0) return null;
  // A pattern peaking at p0 makes the transform's argument -2*pi*f.p0, so the
  // phase that names a grid site is the negated argument. Sign it the other way
  // and every mark drawn from the fit lands mirrored about the panel's centre.
  return {
    phase1: -Math.atan2(imaginary1, real1) / TAU,
    phase2: -Math.atan2(imaginary2, real2) / TAU,
    coherence1: Math.hypot(real1, imaginary1) / magnitude,
    coherence2: Math.hypot(real2, imaginary2) / magnitude,
    samples,
  };
}

/**
 * A predicted stud centre for the fitted grid and phase.
 *
 * The phase to draw with is not the one `latticePhase` returns. That is the
 * argument of a Fourier component, which lands where the pattern's fundamental
 * peaks — on a printed panel that came out half a cell from the studs, and the
 * marks drawn from it sat neatly in the gaps. `foldedStudShape` gives the phase
 * that means the stud: it is the centre of the folded ring itself.
 */
export function latticeSite(
  basis: LatticeBasisPx,
  phase: LatticePhaseOffset,
  m: number,
  n: number,
): { readonly xPx: number; readonly yPx: number } {
  const u = phase.phase1 + m;
  const v = phase.phase2 + n;
  return {
    xPx: basis.a.xPx * u + basis.b.xPx * v,
    yPx: basis.a.yPx * u + basis.b.yPx * v,
  };
}

/** Every predicted stud centre inside a box, in drawing order. */
export function latticeSitesInBox(
  basis: LatticeBasisPx,
  phase: LatticePhaseOffset,
  box: PixelBoxPx,
): readonly { readonly xPx: number; readonly yPx: number }[] {
  const reciprocal = latticeReciprocal(basis);
  if (reciprocal === null) return [];
  const corners = [
    [box.minXPx, box.minYPx],
    [box.maxXPx, box.minYPx],
    [box.minXPx, box.maxYPx],
    [box.maxXPx, box.maxYPx],
  ];
  const coordinates = corners.map(([x, y]) => [
    reciprocal.f1XPx * x! + reciprocal.f1YPx * y! - phase.phase1,
    reciprocal.f2XPx * x! + reciprocal.f2YPx * y! - phase.phase2,
  ]);
  const minM = Math.floor(Math.min(...coordinates.map(([m]) => m!)));
  const maxM = Math.ceil(Math.max(...coordinates.map(([m]) => m!)));
  const minN = Math.floor(Math.min(...coordinates.map(([, n]) => n!)));
  const maxN = Math.ceil(Math.max(...coordinates.map(([, n]) => n!)));
  const sites: { xPx: number; yPx: number }[] = [];
  for (let m = minM; m <= maxM; m += 1) {
    for (let n = minN; n <= maxN; n += 1) {
      const site = latticeSite(basis, phase, m, n);
      if (
        site.xPx >= box.minXPx &&
        site.xPx <= box.maxXPx &&
        site.yPx >= box.minYPx &&
        site.yPx <= box.maxYPx
      ) {
        sites.push(site);
      }
    }
  }
  return sites;
}

export interface LatticeDriftWindow extends PixelBoxPx {
  readonly samples: number;
  readonly coherence: number;
  /** Where this window puts the grid relative to the whole panel's phase. */
  readonly offsetXPx: number;
  readonly offsetYPx: number;
  /** False for a window that barely sees the grid; excluded from the totals. */
  readonly counted: boolean;
}

export interface LatticeDrift {
  readonly windows: readonly LatticeDriftWindow[];
  /**
   * Spread of the grid's phase across the panel, weighted by how loudly each
   * window states it. An upper bound on how far one camera fails to explain the
   * panel: a multi-layer building drifts without the camera changing.
   */
  readonly horizontalRmsPx: number;
  readonly horizontalMaxPx: number;
  /** The same vertically, where a layer offset lands most of its shift. */
  readonly verticalRmsPx: number;
  readonly verticalMaxPx: number;
  readonly globalCoherence: number;
  readonly failure: string | null;
}

function wrapToCycle(value: number): number {
  return value - Math.round(value);
}

export interface LatticeDriftOptions {
  /** Windows per axis across the art. Defaults to 4, giving up to 16 windows. */
  readonly gridSize?: number;
  /** Minimum sampled pixels for a window to count. Defaults to 400. */
  readonly minimumSamples?: number;
  /** Minimum grid coherence for a window to count. Defaults to 0.02. */
  readonly minimumCoherence?: number;
}

/**
 * How far apart the panel's own regions place the fitted grid.
 *
 * This is the measurement that decides whether one camera describes the whole
 * picture. It needs no part identities and no model: a projection either
 * explains every corner of the panel with the same two vectors or it does not.
 */
export function latticeDrift(
  field: StudTextureField,
  basis: LatticeBasisPx,
  options: LatticeDriftOptions = {},
): LatticeDrift {
  const gridSize = options.gridSize ?? 4;
  const minimumSamples = options.minimumSamples ?? 400;
  const minimumCoherence = options.minimumCoherence ?? 0.02;
  const reciprocal = latticeReciprocal(basis);
  const empty = {
    windows: [],
    horizontalRmsPx: 0,
    horizontalMaxPx: 0,
    verticalRmsPx: 0,
    verticalMaxPx: 0,
    globalCoherence: 0,
  };
  if (reciprocal === null) {
    return {
      ...empty,
      failure: `The fitted basis is degenerate: a=(${basis.a.xPx}, ${basis.a.yPx}) and b=(${basis.b.xPx}, ${basis.b.yPx}) are collinear, so there is no grid to take a phase against.`,
    };
  }
  if (field.bounds === null) {
    return { ...empty, failure: "The field has no art pixels, so there is no region to window." };
  }
  const global = latticePhase(field, reciprocal);
  if (global === null) {
    return {
      ...empty,
      failure: `No sampled pixel carried contrast, so the panel has no phase; ${field.artArea} art pixels were keyed but the local-contrast image is flat.`,
    };
  }

  const { minXPx, minYPx, maxXPx, maxYPx } = field.bounds;
  const stepX = (maxXPx - minXPx + 1) / gridSize;
  const stepY = (maxYPx - minYPx + 1) / gridSize;
  const measured: (Omit<LatticeDriftWindow, "counted"> & { counted: boolean })[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const box: PixelBoxPx = {
        minXPx: Math.round(minXPx + column * stepX),
        maxXPx: Math.round(minXPx + (column + 1) * stepX) - 1,
        minYPx: Math.round(minYPx + row * stepY),
        maxYPx: Math.round(minYPx + (row + 1) * stepY) - 1,
      };
      const phase = latticePhase(field, reciprocal, box);
      if (phase === null || phase.samples < minimumSamples) continue;
      const coherence = Math.min(phase.coherence1, phase.coherence2);
      if (coherence < minimumCoherence) continue;
      const delta1 = wrapToCycle(phase.phase1 - global.phase1);
      const delta2 = wrapToCycle(phase.phase2 - global.phase2);
      measured.push({
        ...box,
        samples: phase.samples,
        coherence,
        offsetXPx: basis.a.xPx * delta1 + basis.b.xPx * delta2,
        offsetYPx: basis.a.yPx * delta1 + basis.b.yPx * delta2,
        counted: true,
      });
    }
  }

  // A window clipping the corner of the art is mostly outline and barely sees
  // the grid; its phase is noise, and left in the totals it is the number.
  // Half the panel's own median coherence is the floor, because what counts as
  // grid-like depends on how much ink the panel spends on things that are not
  // the grid.
  const coherences = measured.map((entry) => entry.coherence).sort((left, right) => left - right);
  const median = coherences[Math.floor(coherences.length / 2)] ?? 0;
  const windows = measured.map((entry) => ({
    ...entry,
    counted: entry.coherence >= median * 0.5,
  }));
  const counted = windows.filter((entry) => entry.counted);

  if (counted.length < 2) {
    return {
      ...empty,
      windows,
      globalCoherence: Math.min(global.coherence1, global.coherence2),
      failure:
        `Only ${counted.length} of ${gridSize * gridSize} windows carried enough grid-aligned contrast to take a phase (needs ${minimumSamples} samples and ${minimumCoherence} coherence), so drift across the panel could not be measured. ` +
        `A panel whose art is one small cluster is expected to fail this; lower gridSize before lowering the thresholds.`,
    };
  }

  // Weighted by how loudly each window states its phase. The uncertainty in the
  // argument of a Fourier component goes as one over its amplitude, and that
  // amplitude is the window's coherence times the ink it had to work with, so a
  // corner window holding two studs and a long straight edge should not count
  // as much as one holding forty studs.
  const weightOf = (entry: LatticeDriftWindow) => entry.coherence * entry.samples;
  const totalWeight = counted.reduce((total, entry) => total + weightOf(entry), 0);
  const rms = (pick: (entry: LatticeDriftWindow) => number): number =>
    totalWeight <= 0
      ? 0
      : Math.sqrt(
          counted.reduce((total, entry) => total + weightOf(entry) * pick(entry) ** 2, 0) /
            totalWeight,
        );
  return {
    windows,
    horizontalRmsPx: rms((entry) => entry.offsetXPx),
    horizontalMaxPx: Math.max(...counted.map((entry) => Math.abs(entry.offsetXPx))),
    verticalRmsPx: rms((entry) => entry.offsetYPx),
    verticalMaxPx: Math.max(...counted.map((entry) => Math.abs(entry.offsetYPx))),
    globalCoherence: Math.min(global.coherence1, global.coherence2),
    failure: null,
  };
}

export interface FoldedCell {
  readonly size: number;
  /** Mean texture over one grid cell, folded from the whole panel. */
  readonly values: Float32Array;
  readonly counts: Int32Array;
  /** Peak-to-peak of the folded cell; mush means the grid is wrong. */
  readonly contrast: number;
}

/**
 * Every art pixel folded into one grid cell.
 *
 * The most direct check there is. A basis that is right to a fraction of a pixel
 * folds forty periods of picture into a crisp stud; one that is a percent out
 * smears the same pixels into grey. It costs one pass and it can be looked at.
 */
export function foldUnitCell(
  field: StudTextureField,
  basis: LatticeBasisPx,
  size: number,
): FoldedCell | null {
  if (!Number.isInteger(size) || size < 4) {
    throw new RangeError(
      `Folded cell size must be an integer of at least 4, received ${String(size)}.`,
    );
  }
  const reciprocal = latticeReciprocal(basis);
  if (reciprocal === null) return null;
  const values = new Float32Array(size * size);
  const counts = new Int32Array(size * size);
  const { width, height, mask, texture } = field;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      const u = reciprocal.f1XPx * x + reciprocal.f1YPx * y;
      const v = reciprocal.f2XPx * x + reciprocal.f2YPx * y;
      const cellU = Math.min(size - 1, Math.floor((u - Math.floor(u)) * size));
      const cellV = Math.min(size - 1, Math.floor((v - Math.floor(v)) * size));
      const cell = cellV * size + cellU;
      values[cell] = values[cell]! + texture[index]!;
      counts[cell] = counts[cell]! + 1;
    }
  }
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let cell = 0; cell < values.length; cell += 1) {
    if (counts[cell] === 0) continue;
    values[cell] = values[cell]! / counts[cell]!;
    minimum = Math.min(minimum, values[cell]!);
    maximum = Math.max(maximum, values[cell]!);
  }
  return {
    size,
    values,
    counts,
    contrast: Number.isFinite(minimum) && Number.isFinite(maximum) ? maximum - minimum : 0,
  };
}

export interface LatticeSiteResiduals {
  /** Grid sites carrying enough ink to say where their stud is. */
  readonly sites: number;
  /** Of those, the share whose ink sits within `hitRadiusCells` of the prediction. */
  readonly hitRate: number;
  /** Reprojection error over the hits, in pixels of this raster. */
  readonly rmsPx: number;
  readonly maxPx: number;
  /** The same for every measured site, hits and misses together. */
  readonly rmsAllPx: number;
}

export interface LatticeSiteResidualOptions {
  /**
   * Radius around a prediction whose ink counts as that stud's, in pitches.
   * A stud is 0.3 of a pitch, so a little over that takes the whole drawn ring
   * and none of its neighbours. Widening it to the full cell measures the
   * plate's outline instead of the stud — 4.5px against 1.4px on the same panel.
   */
  readonly studRadiusCells?: number;
  /** How far a site's ink may sit from its prediction and still be its stud. */
  readonly hitRadiusCells?: number;
  /** Ink weight a site needs, as a fraction of the median site's. Defaults to 0.4. */
  readonly minimumWeightFraction?: number;
}

/**
 * How far each predicted stud is from the ink that should be under it.
 *
 * The reprojection error, one grid site at a time. Every art pixel is assigned
 * to the nearest predicted site and its contrast accumulated there, so a site's
 * weighted centre is where the picture actually put that stud; the distance
 * back to the prediction is the error, in pixels, at that place on the page.
 *
 * A building has more than one height in it, and a plate one brick up draws its
 * studs on the same grid shifted straight up the page. Those sites are not
 * errors and are not averaged in — they are the misses, and the hit rate says
 * how much of the panel is on the layer the phase was taken from.
 */
export function latticeSiteResiduals(
  field: StudTextureField,
  basis: LatticeBasisPx,
  phase: LatticePhaseOffset,
  options: LatticeSiteResidualOptions = {},
): LatticeSiteResiduals | null {
  const studRadiusCells = options.studRadiusCells ?? 0.38;
  const hitRadiusCells = options.hitRadiusCells ?? 0.2;
  const minimumWeightFraction = options.minimumWeightFraction ?? 0.4;
  const reciprocal = latticeReciprocal(basis);
  if (reciprocal === null) return null;
  const { width, height, mask, texture } = field;
  const accumulated = new Map<string, { weight: number; sumU: number; sumV: number }>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      const weight = Math.abs(texture[index]!);
      if (weight === 0) continue;
      const u = reciprocal.f1XPx * x + reciprocal.f1YPx * y - phase.phase1;
      const v = reciprocal.f2XPx * x + reciprocal.f2YPx * y - phase.phase2;
      const m = Math.round(u);
      const n = Math.round(v);
      if (Math.hypot(u - m, v - n) > studRadiusCells) continue;
      const key = `${m}:${n}`;
      const entry = accumulated.get(key) ?? { weight: 0, sumU: 0, sumV: 0 };
      entry.weight += weight;
      entry.sumU += weight * (u - m);
      entry.sumV += weight * (v - n);
      accumulated.set(key, entry);
    }
  }
  if (accumulated.size === 0) return null;

  const weights = [...accumulated.values()]
    .map((entry) => entry.weight)
    .sort((left, right) => left - right);
  const medianWeight = weights[Math.floor(weights.length / 2)]!;
  const floor = medianWeight * minimumWeightFraction;
  const offsets: { distanceCells: number; distancePx: number }[] = [];
  for (const entry of accumulated.values()) {
    if (entry.weight < floor) continue;
    const offsetU = entry.sumU / entry.weight;
    const offsetV = entry.sumV / entry.weight;
    offsets.push({
      distanceCells: Math.hypot(offsetU, offsetV),
      distancePx: Math.hypot(
        basis.a.xPx * offsetU + basis.b.xPx * offsetV,
        basis.a.yPx * offsetU + basis.b.yPx * offsetV,
      ),
    });
  }
  if (offsets.length === 0) return null;
  const hits = offsets.filter((entry) => entry.distanceCells <= hitRadiusCells);
  const rms = (values: readonly number[]) =>
    values.length === 0
      ? 0
      : Math.sqrt(values.reduce((total, value) => total + value * value, 0) / values.length);
  return {
    sites: offsets.length,
    hitRate: hits.length / offsets.length,
    rmsPx: rms(hits.map((entry) => entry.distancePx)),
    maxPx: hits.length === 0 ? 0 : Math.max(...hits.map((entry) => entry.distancePx)),
    rmsAllPx: rms(offsets.map((entry) => entry.distancePx)),
  };
}

export interface FoldedStudShape extends LatticePhaseOffset {
  /**
   * Where the drawn stud sits inside the cell, in cycles along each direction.
   * This is the phase to draw predicted studs at — see `latticeSite`.
   */
  readonly phase1: number;
  readonly phase2: number;
  /** Root mean square radius of the drawn stud, in stud pitches. */
  readonly radiusCells: number;
  /**
   * Minor over major spread of the drawn stud in grid coordinates. A stud is a
   * circle in the world, so on a genuine square grid it folds back to a circle
   * whatever the elevation: anything much below 1 says the grid is not square.
   */
  readonly circularity: number;
}

/**
 * The shape of the drawn stud, measured in the fitted grid's own coordinates.
 *
 * This is the independent check the grid solve does not provide. A residual
 * against an axonometric projection turns out to be a weak test on its own —
 * a rhombic grid that no square could project to still reads at 1% of pitch
 * once a change of basis is allowed. But the stud itself is known geometry:
 * a circle of radius 6 LDU on a 20 LDU pitch. Fold the panel onto the fitted
 * cell and that circle has to come back round, and 0.3 of a pitch across. A
 * grid fitted to the wrong repeat folds it into a smear or an ellipse.
 */
export function foldedStudShape(fold: FoldedCell): FoldedStudShape | null {
  const { size, values, counts } = fold;
  // Circular means, because the cell wraps: an arithmetic mean of coordinates
  // that straddle the seam lands on the opposite side of the cell.
  let real1 = 0;
  let imaginary1 = 0;
  let real2 = 0;
  let imaginary2 = 0;
  let weightTotal = 0;
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const cell = v * size + u;
      if (counts[cell] === 0) continue;
      const weight = Math.abs(values[cell]!);
      const angle1 = (TAU * (u + 0.5)) / size;
      const angle2 = (TAU * (v + 0.5)) / size;
      real1 += weight * Math.cos(angle1);
      imaginary1 += weight * Math.sin(angle1);
      real2 += weight * Math.cos(angle2);
      imaginary2 += weight * Math.sin(angle2);
      weightTotal += weight;
    }
  }
  if (weightTotal === 0) return null;
  const phase1 = Math.atan2(imaginary1, real1) / TAU;
  const phase2 = Math.atan2(imaginary2, real2) / TAU;

  let m11 = 0;
  let m12 = 0;
  let m22 = 0;
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const cell = v * size + u;
      if (counts[cell] === 0) continue;
      const weight = Math.abs(values[cell]!);
      const du = wrapToCycle((u + 0.5) / size - phase1);
      const dv = wrapToCycle((v + 0.5) / size - phase2);
      m11 += weight * du * du;
      m12 += weight * du * dv;
      m22 += weight * dv * dv;
    }
  }
  m11 /= weightTotal;
  m12 /= weightTotal;
  m22 /= weightTotal;
  const trace = m11 + m22;
  const gap = Math.sqrt(Math.max(0, ((m11 - m22) / 2) ** 2 + m12 * m12));
  const major = trace / 2 + gap;
  const minor = trace / 2 - gap;
  return {
    phase1,
    phase2,
    radiusCells: Math.sqrt(Math.max(0, trace)),
    circularity: major > 0 ? Math.sqrt(Math.max(0, minor) / major) : 0,
  };
}
