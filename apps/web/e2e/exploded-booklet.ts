import type { HighlightRegionBounds } from "../src/instructions/highlight-region";

/**
 * The synthetic exploded booklet, and the measurement run against it, as one
 * function so `page.evaluate` can serialise it.
 *
 * It closes over nothing: everything it needs arrives in its single argument,
 * which is what lets it live in its own module instead of inline in the spec.
 * The spec owns the scoreboard and the assertions; this owns the booklet, the
 * candidate sweep, and the numbers.
 */

export interface ExplodedRunOptions {
  readonly kernelUrl: string;
  readonly renderingUrl: string;
  readonly commandsUrl: string;
  readonly assemblyUrl: string;
  readonly width: number;
  readonly height: number;
}

export interface MetricRanking {
  readonly trueScore: number;
  /** Distinct wrong placements that outscored the true one. */
  readonly trueRank: number;
  readonly bestWrongScore: number | null;
  readonly margin: number | null;
  readonly tiedWithTrue: number;
  readonly uniquelyFirst: boolean;
}

export interface ExplodedStepReport {
  readonly stepNumber: number;
  readonly catalogPartId: string;
  readonly exploded: boolean;
  readonly nextPanelExploded: boolean;
  readonly nextPanelIsFinishedModel: boolean;
  readonly distinctCandidates: number;
  readonly enumeratedCandidates: number;
  readonly truePlacementEnumerated: boolean;
  /** Only one legal placement exists, so nothing had to be separated from it. */
  readonly degenerate: boolean;
  readonly emergedPx: number;
  readonly changedPx: number;
  readonly emergedBounds: HighlightRegionBounds | null;
  readonly survivingDeltaPrune: number;
  readonly truePlacementSurvivesDeltaPrune: boolean | null;
  readonly results: Record<string, MetricRanking>;
  readonly topByExplodedScore: readonly unknown[];
}

export interface ExplodedRunResult {
  readonly schemaVersion: string;
  readonly panelWidthPx: number;
  readonly panelHeightPx: number;
  readonly ghostOffsetLdu: readonly number[];
  readonly misregistrationPx: number;
  readonly metrics: readonly string[];
  readonly totalRendered: number;
  readonly elapsedMs: number;
  readonly patterns: readonly { exploded: readonly boolean[]; steps: ExplodedStepReport[] }[];
}

export const measureExplodedResolution = async ({
  kernelUrl,
  renderingUrl,
  commandsUrl,
  assemblyUrl,
  width,
  height,
}: ExplodedRunOptions): Promise<ExplodedRunResult> => {
  const kernel = await import(/* @vite-ignore */ kernelUrl);
  const rendering = await import(/* @vite-ignore */ renderingUrl);
  const commands = await import(/* @vite-ignore */ commandsUrl);
  const assembly = await import(/* @vite-ignore */ assemblyUrl);

  const COLOR = "builtin:light-bluish-gray";
  const PROBE_COLOR = "builtin:magenta";
  const PROBE_HEX = 0x923978;
  const BACKGROUND_HEX = rendering.INSTRUCTION_BACKGROUND_HEX as number;
  const AREA = width * height;
  /**
   * Registration error to test the score under. A booklet's panels are
   * separate drawings and the camera is fitted to each, so two panels line
   * up to about a pixel; `scoreStepDelta` already allows two or three.
   */
  const MISREGISTRATION_PX = 2;

  const layout = [
    { part: "builtin:plate-6x6", at: [0, 8, 0] },
    { part: "builtin:brick-2x4", at: [-20, -8, -20] },
    { part: "builtin:brick-2x2", at: [20, -8, 20] },
    { part: "builtin:brick-1x6", at: [-50, -8, 0] },
    { part: "builtin:plate-1x2", at: [-10, -24, -40] },
    { part: "builtin:brick-1x1", at: [50, -8, -50] },
  ];
  // Complementary, so every step is drawn exploded in one pattern and in
  // place in the other. Between them they cover an exploded step followed
  // by an exploded one, by an in-place one, and a last step whose only
  // lookahead is the finished-model page.
  const PATTERNS = [
    [true, true, false, true, false, true],
    [false, false, true, false, true, false],
  ];
  // Straight up, which is how a booklet draws a part about to drop on.
  // 48 LDU is two brick heights, about 112px in this panel's raster.
  const GHOST_OFFSET_LDU = [0, -48, 0];

  const place = (document: unknown, part: string, transform: unknown, colorId: string) => {
    const transaction = commands.createPlacePartTransaction(document, {
      catalogPartId: part,
      colorId,
      transform,
    });
    return {
      document: kernel.applyBuildOperations(document, transaction.operations),
      partId: transaction.partId as string,
    };
  };
  const upright = (at: number[]) => ({ positionLdu: at, orientationId: "upright-yaw-0" });

  let reference = kernel.createEmptyBrickDocument({ id: "reference", name: "Reference" });
  const steps: {
    before: unknown;
    after: unknown;
    newPartId: string;
    transform: { positionLdu: number[]; orientationId: string };
  }[] = [];
  for (const entry of layout) {
    const before = reference;
    const placed = place(reference, entry.part, upright(entry.at), COLOR);
    reference = placed.document;
    steps.push({
      before,
      after: reference,
      newPartId: placed.partId,
      transform: upright(entry.at),
    });
  }

  const renderer = rendering.createInstructionRenderer({ width, height });
  const finalScene = rendering.deriveBrickScene(reference, { finish: "instruction" });
  const frame = rendering.instructionViewFrame(finalScene.bounds, width, height);
  finalScene.dispose();
  const panelCamera = rendering.createOrthographicViewCamera(
    {
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      centerXPx: width / 2,
      centerYPx: height * 0.62,
    },
    frame,
  );

  let rendered = 0;

  /** Booklet art: fills, ink, and nothing keyed out. */
  const renderArt = (document: unknown): Uint8ClampedArray => {
    const scene = rendering.deriveBrickScene(document, { finish: "instruction" });
    const art = renderer.render(scene.root, panelCamera).slice();
    scene.dispose();
    rendered += 1;
    return art;
  };

  /**
   * The probe part's visible silhouette, and the whole assembly's. Silhouette
   * mode, not art: shading has no single hex to key, and a keyed fill with
   * outlines on comes back riddled with holes along every edge.
   */
  const renderMasks = (document: unknown, probePartId: string) => {
    const parts = (document as { parts: { id: string }[] }).parts;
    const painted = {
      ...(document as object),
      parts: parts.map((part) =>
        part.id === probePartId ? { ...part, colorId: PROBE_COLOR } : part,
      ),
    };
    const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
    rendering.setInstructionSilhouetteMode(scene.root, true);
    const pixels = renderer.render(scene.root, panelCamera);
    const probe = new Uint8Array(AREA);
    const model = new Uint8Array(AREA);
    for (let index = 0; index < AREA; index += 1) {
      const key =
        (pixels[index * 4]! << 16) | (pixels[index * 4 + 1]! << 8) | pixels[index * 4 + 2]!;
      if (key !== BACKGROUND_HEX) model[index] = 1;
      if (key === PROBE_HEX) probe[index] = 1;
    }
    scene.dispose();
    rendered += 1;
    return { probe, model };
  };

  /**
   * Lifts one placed part off its landing site for the panel art only.
   * A ghost is not a placement — nothing holds it up and the command path
   * would rightly refuse it — but a booklet draws one, and drawing is all
   * this document is ever used for.
   */
  const displace = (document: unknown, partId: string, offset: number[]) => {
    const parts = (document as { parts: { id: string; transform: unknown }[] }).parts;
    return {
      ...(document as object),
      parts: parts.map((part) => {
        if (part.id !== partId) return part;
        const transform = part.transform as { positionLdu: number[]; orientationId: string };
        return {
          ...part,
          transform: {
            ...transform,
            positionLdu: [
              transform.positionLdu[0]! + offset[0]!,
              transform.positionLdu[1]! + offset[1]!,
              transform.positionLdu[2]! + offset[2]!,
            ],
          },
        };
      }),
    };
  };

  interface Panel {
    readonly exploded: boolean;
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8ClampedArray;
    readonly highlight: unknown;
  }

  const panelOf = (pixels: Uint8ClampedArray, exploded: boolean): Panel => ({
    exploded,
    width,
    height,
    pixels,
    highlight: assembly.extractHighlightRegions(pixels, width, height, {
      minimumOutlinePx: 40,
    }),
  });

  const buildPanel = (index: number, exploded: boolean): Panel => {
    const step = steps[index]!;
    const drawn = exploded ? displace(step.after, step.newPartId, GHOST_OFFSET_LDU) : step.after;
    const art = renderArt(drawn);
    const boundary = rendering.maskBoundary(
      renderMasks(drawn, step.newPartId).probe,
      width,
      height,
    );
    for (let pixel = 0; pixel < AREA; pixel += 1) {
      if (boundary[pixel] !== 1) continue;
      art[pixel * 4] = 0xff;
      art[pixel * 4 + 1] = 0xcc;
      art[pixel * 4 + 2] = 0x00;
    }
    return panelOf(art, exploded);
  };

  /** The same panel, printed a couple of pixels off where it was expected. */
  const misregister = (panel: Panel, offset: number): Panel => {
    const shifted = new Uint8ClampedArray(AREA * 4);
    for (let index = 0; index < AREA; index += 1) {
      shifted[index * 4] = (BACKGROUND_HEX >> 16) & 0xff;
      shifted[index * 4 + 1] = (BACKGROUND_HEX >> 8) & 0xff;
      shifted[index * 4 + 2] = BACKGROUND_HEX & 0xff;
      shifted[index * 4 + 3] = 255;
    }
    for (let y = 0; y < height; y += 1) {
      const source = y - offset;
      if (source < 0 || source >= height) continue;
      for (let x = 0; x < width; x += 1) {
        const from = x - offset;
        if (from < 0 || from >= width) continue;
        const to = (y * width + x) * 4;
        const at = (source * width + from) * 4;
        shifted[to] = panel.pixels[at]!;
        shifted[to + 1] = panel.pixels[at + 1]!;
        shifted[to + 2] = panel.pixels[at + 2]!;
      }
    }
    return panelOf(shifted, panel.exploded);
  };

  const differenceOf = (left: Uint8ClampedArray, right: Uint8ClampedArray): Uint8Array => {
    const mask = new Uint8Array(AREA);
    for (let pixel = 0; pixel < AREA; pixel += 1) {
      const at = pixel * 4;
      const distance =
        Math.abs(left[at]! - right[at]!) +
        Math.abs(left[at + 1]! - right[at + 1]!) +
        Math.abs(left[at + 2]! - right[at + 2]!);
      if (distance > 8) mask[pixel] = 1;
    }
    return mask;
  };
  const iouOf = (left: Uint8Array, right: Uint8Array): number => {
    let intersection = 0;
    let union = 0;
    for (let pixel = 0; pixel < AREA; pixel += 1) {
      const inLeft = left[pixel] === 1;
      const inRight = right[pixel] === 1;
      if (inLeft && inRight) intersection += 1;
      if (inLeft || inRight) union += 1;
    }
    return union === 0 ? 0 : intersection / union;
  };
  const boxesOverlap = (
    left: { minXPx: number; minYPx: number; maxXPx: number; maxYPx: number },
    right: { minXPx: number; minYPx: number; maxXPx: number; maxYPx: number },
    margin: number,
  ) =>
    left.minXPx - margin <= right.maxXPx &&
    right.minXPx - margin <= left.maxXPx &&
    left.minYPx - margin <= right.maxYPx &&
    right.minYPx - margin <= left.maxYPx;

  const METRICS = [
    "highlightScore",
    "emergedCoverage",
    "emergedIou",
    "emergenceIou",
    "changeIou",
    "explodedScore",
    "explodedScoreMisregistered",
  ] as const;
  type Metric = (typeof METRICS)[number];
  type Row = Record<Metric, number> & {
    isTrue: boolean;
    transform: { positionLdu: number[]; orientationId: string };
    survivesDeltaPrune: boolean;
  };

  const rankBy = (rows: Row[], metric: Metric, stepNumber: number): MetricRanking => {
    const trueRow = rows.find((row) => row.isTrue);
    if (!trueRow) {
      throw new Error(
        `Step ${stepNumber} enumerated ${rows.length} distinct placements and the reference layout's own placement was not among them, ` +
          `so there is nothing to rank ${metric} against. The enumerator and the reference build have diverged.`,
      );
    }
    const trueScore = trueRow[metric];
    const wrong = rows.filter((row) => !row.isTrue);
    const bestWrong = wrong.length === 0 ? null : Math.max(...wrong.map((row) => row[metric]));
    const beatenBy = wrong.filter((row) => row[metric] > trueScore + 1e-9).length;
    const tied = wrong.filter((row) => Math.abs(row[metric] - trueScore) <= 1e-9).length;
    return {
      trueScore,
      trueRank: beatenBy,
      bestWrongScore: bestWrong,
      margin: bestWrong === null ? null : trueScore - bestWrong,
      tiedWithTrue: tied,
      uniquelyFirst: beatenBy === 0 && tied === 0,
    };
  };

  const started = performance.now();
  const patternReports: { exploded: boolean[]; steps: ExplodedStepReport[] }[] = [];
  let probe: { current: Panel; next: Panel; emerged: Uint8Array } | null = null;

  for (const pattern of PATTERNS) {
    const panels = pattern.map((exploded, index) => buildPanel(index, exploded));
    // Every booklet ends on a picture of the finished model; it is the last
    // step's only lookahead, and it carries no highlight.
    const finished: Panel = {
      exploded: false,
      width,
      height,
      pixels: renderArt(reference),
      highlight: null,
    };
    const stepReports: ExplodedStepReport[] = [];

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]!;
      const current = panels[index]!;
      const next = index + 1 < panels.length ? panels[index + 1]! : finished;
      const delta = assembly.panelDelta(current, next, { backgroundHex: BACKGROUND_HEX });
      const shiftedDelta = assembly.panelDelta(current, misregister(next, MISREGISTRATION_PX), {
        backgroundHex: BACKGROUND_HEX,
      });
      // What was already drawn before this step. A candidate landing in
      // front of it turns no page pixel into a model pixel there, so those
      // pixels cannot be evidence and must not be demanded of it.
      const beforeModel = renderMasks(step.before, "").model;
      const beforeArt = renderArt(step.before);

      const enumeration = assembly.enumeratePlacements(step.before, layout[index]!.part, {
        includeBuildPlate: (step.before as { parts: unknown[] }).parts.length === 0,
      });
      const seen = new Set<string>();
      const distinct: { transform: { positionLdu: number[]; orientationId: string } }[] = [];
      for (const candidate of enumeration.candidates as {
        catalogPartId: string;
        transform: { positionLdu: number[]; orientationId: string };
      }[]) {
        const key = assembly.placementOccupancyKey(candidate.catalogPartId, candidate.transform);
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push(candidate);
      }
      const trueKey = assembly.placementOccupancyKey(layout[index]!.part, step.transform);

      const rows: Row[] = [];
      for (const candidate of distinct) {
        const applied = place(step.before, layout[index]!.part, candidate.transform, PROBE_COLOR);
        const masks = renderMasks(applied.document, applied.partId);
        // A candidate landing in front of what was already drawn turns no page
        // pixel into a model pixel there, so only the rest of it is predicted
        // to emerge.
        const newlyVisibleMask = new Uint8Array(AREA);
        let candidateArea = 0;
        let insideEmerged = 0;
        for (let pixel = 0; pixel < AREA; pixel += 1) {
          if (masks.probe[pixel] !== 1) continue;
          candidateArea += 1;
          if (beforeModel[pixel] === 0) newlyVisibleMask[pixel] = 1;
          if (delta.emergedMask[pixel] === 1) insideEmerged += 1;
        }
        // What this candidate would change about the picture, drawn in the
        // booklet's own colour so the comparison is like for like: a probe
        // render is magenta and differs from the page everywhere.
        const drawnArt = renderArt(
          place(step.before, layout[index]!.part, candidate.transform, COLOR).document,
        );
        const changedMask = differenceOf(drawnArt, beforeArt);
        const prediction = { newlyVisibleMask, changedMask };
        const scored = assembly.scoreExplodedStep(prediction, delta);
        const shiftedScore = assembly.scoreExplodedStep(prediction, shiftedDelta);
        const projected = assembly.projectPartBounds(candidate, panelCamera, width, height);
        const pruneBox = delta.emergedBounds ?? delta.changedBounds;
        rows.push({
          isTrue:
            assembly.placementOccupancyKey(layout[index]!.part, candidate.transform) === trueKey,
          transform: candidate.transform,
          highlightScore: assembly.scoreStepDelta(masks.probe, current.highlight, {
            tolerancePx: 3,
          }).score as number,
          // The two controls that say why the score is shaped the way it is.
          // Coverage alone — every pixel I cover emerged — is bought by hiding
          // inside the region; the whole silhouette against the emerged region
          // is bought by landing where nothing was drawn before.
          emergedCoverage: candidateArea === 0 ? 0 : insideEmerged / candidateArea,
          emergedIou: iouOf(masks.probe, delta.emergedMask),
          emergenceIou: (scored.emergenceIou as number | null) ?? 0,
          changeIou: scored.changeIou as number,
          explodedScore: scored.score as number,
          explodedScoreMisregistered: shiftedScore.score as number,
          survivesDeltaPrune:
            pruneBox !== null && projected !== null && boxesOverlap(projected, pruneBox, 14),
        });
      }

      const results: Record<string, MetricRanking> = {};
      for (const metric of METRICS) results[metric] = rankBy(rows, metric, index + 1);
      const ranked = [...rows].sort((left, right) => right.explodedScore - left.explodedScore);
      stepReports.push({
        stepNumber: index + 1,
        catalogPartId: layout[index]!.part,
        exploded: current.exploded,
        nextPanelExploded: next.exploded,
        nextPanelIsFinishedModel: index + 1 >= panels.length,
        distinctCandidates: rows.length,
        enumeratedCandidates: (enumeration.candidates as unknown[]).length,
        truePlacementEnumerated: rows.some((row) => row.isTrue),
        degenerate: rows.length < 2,
        emergedPx: delta.emergedPx,
        changedPx: delta.changedPx,
        emergedBounds: delta.emergedBounds,
        survivingDeltaPrune: rows.filter((row) => row.survivesDeltaPrune).length,
        truePlacementSurvivesDeltaPrune: rows.find((row) => row.isTrue)?.survivesDeltaPrune ?? null,
        results,
        topByExplodedScore: ranked.slice(0, 3).map((row) => ({
          isTrue: row.isTrue,
          positionLdu: row.transform.positionLdu,
          orientationId: row.transform.orientationId,
          explodedScore: Math.round(row.explodedScore * 10000) / 10000,
          emergenceIou: Math.round(row.emergenceIou * 10000) / 10000,
          changeIou: Math.round(row.changeIou * 10000) / 10000,
          highlightScore: Math.round(row.highlightScore * 10000) / 10000,
        })),
      });
      if (probe === null && current.exploded && rows.length > 1) {
        probe = { current, next, emerged: delta.emergedMask };
      }
    }
    patternReports.push({ exploded: pattern, steps: stepReports });
  }
  const elapsedMs = performance.now() - started;

  const toImage = (mask: Uint8Array) => {
    const pixels = new Uint8ClampedArray(AREA * 4);
    for (let index = 0; index < AREA; index += 1) {
      const value = mask[index] === 1 ? 255 : 0;
      pixels[index * 4] = value;
      pixels[index * 4 + 1] = value;
      pixels[index * 4 + 2] = value;
      pixels[index * 4 + 3] = 255;
    }
    return pixels;
  };
  // Laid out two across and two down: a canvas hanging off the side of the
  // viewport screenshots as a padded stripe, which reads as a bug in the mask.
  const paint = (name: string, pixels: Uint8ClampedArray, left: number, top: number) => {
    const canvas = document.createElement("canvas");
    canvas.className = `probe probe-${name}`;
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = `position:fixed;top:${top}px;left:${left}px;z-index:99999`;
    document.body.append(canvas);
    canvas
      .getContext("2d")!
      .putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  };
  document.querySelectorAll("canvas.probe").forEach((canvas) => canvas.remove());
  if (probe) {
    paint("exploded", probe.current.pixels, 0, 0);
    paint("next", probe.next.pixels, width, 0);
    paint("emerged", toImage(probe.emerged), 0, height);
  }
  renderer.dispose();

  return {
    schemaVersion: "lego.exploded-resolution-score/1",
    panelWidthPx: width,
    panelHeightPx: height,
    ghostOffsetLdu: GHOST_OFFSET_LDU,
    misregistrationPx: MISREGISTRATION_PX,
    metrics: METRICS,
    totalRendered: rendered,
    elapsedMs: Math.round(elapsedMs),
    patterns: patternReports,
  };
};
