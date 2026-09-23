import type { PageScan, TextRun } from "./types";

/**
 * The text a booklet prints that identification leans on: count labels ("2x"),
 * the element ids of the inventory, and the step numbers.
 *
 * The booklet overprints some labels — the same run drawn two or three times at
 * the same spot — so runs are de-duplicated first; counted twice, one "1x" would
 * become two callouts and spend two pieces.
 */
const COUNT = /^(\d{1,3})x$/;
const ELEMENT_ID = /^\d{6,7}$/;
const INTEGER = /^\d{1,4}$/;

export interface CountLabel {
  readonly page: number;
  readonly count: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly sizePt: number;
  readonly widthPt: number;
}

export interface InventoryLabel extends CountLabel {
  readonly elementId: string;
}

export interface StepNumber {
  readonly page: number;
  readonly step: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly sizePt: number;
}

/** Drops runs repeated with the same text, size and position (within 0.05pt). */
export function dedupeRuns(runs: readonly TextRun[]): { runs: TextRun[]; duplicates: number } {
  const seen = new Set<string>();
  const kept: TextRun[] = [];
  for (const run of runs) {
    const key = `${run.text}|${run.sizePt.toFixed(1)}|${(run.xPt * 20).toFixed(0)}|${(run.yPt * 20).toFixed(0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(run);
  }
  return { runs: kept, duplicates: runs.length - kept.length };
}

/** Pages printing enough element ids to be the parts inventory. */
export function inventoryPages(scans: readonly PageScan[], minElementIds = 8): number[] {
  return scans
    .filter((scan) => scan.texts.filter((run) => ELEMENT_ID.test(run.text)).length >= minElementIds)
    .map((scan) => scan.pageNumber);
}

function countOf(run: TextRun): number | null {
  const match = COUNT.exec(run.text);
  return match ? Number(match[1]) : null;
}

/**
 * Inventory cells: a count printed directly above its element id, in the same
 * column. Each count and each id is used at most once.
 */
export function inventoryLabels(
  scan: PageScan,
  maxColumnDriftPt = 0.6,
  riseRangePt: readonly [number, number] = [4, 11],
): { labels: InventoryLabel[]; unpairedIds: string[] } {
  const runs = dedupeRuns(scan.texts).runs;
  const counts = runs.filter((run) => countOf(run) !== null);
  const ids = runs
    .filter((run) => ELEMENT_ID.test(run.text))
    .sort((a, b) => b.yPt - a.yPt || a.xPt - b.xPt);
  const claimed = new Set<number>();
  const labels: InventoryLabel[] = [];
  const unpairedIds: string[] = [];
  for (const id of ids) {
    let best = -1;
    let bestRise = Infinity;
    counts.forEach((count, index) => {
      if (claimed.has(index) || Math.abs(count.xPt - id.xPt) > maxColumnDriftPt) return;
      const rise = count.yPt - id.yPt;
      if (rise >= riseRangePt[0] && rise <= riseRangePt[1] && rise < bestRise) {
        best = index;
        bestRise = rise;
      }
    });
    if (best < 0) {
      unpairedIds.push(id.text);
      continue;
    }
    claimed.add(best);
    const count = counts[best]!;
    labels.push({
      page: scan.pageNumber,
      count: countOf(count)!,
      xPt: count.xPt,
      yPt: count.yPt,
      sizePt: count.sizePt,
      widthPt: count.widthPt,
      elementId: id.text,
    });
  }
  return { labels, unpairedIds };
}

/**
 * Callout count labels on the build pages. The callout size is the most common
 * size a count label is printed at outside the inventory; larger ones mark a
 * sub-assembly built several times and are not parts.
 */
export function calloutLabels(
  scans: readonly PageScan[],
  excludedPages: ReadonlySet<number>,
): { labels: CountLabel[]; sizePt: number | null; duplicates: number; otherSizes: number } {
  const all: { page: number; run: TextRun }[] = [];
  let duplicates = 0;
  for (const scan of scans) {
    if (excludedPages.has(scan.pageNumber)) continue;
    const deduped = dedupeRuns(scan.texts);
    duplicates += deduped.duplicates;
    for (const run of deduped.runs)
      if (countOf(run) !== null) all.push({ page: scan.pageNumber, run });
  }
  const bySize = new Map<string, number>();
  for (const { run } of all)
    bySize.set(run.sizePt.toFixed(1), (bySize.get(run.sizePt.toFixed(1)) ?? 0) + 1);
  const ranked = [...bySize.entries()].sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
  if (ranked.length === 0) return { labels: [], sizePt: null, duplicates, otherSizes: 0 };
  const size = ranked[0]![0];
  const labels = all
    .filter(({ run }) => run.sizePt.toFixed(1) === size)
    .map(({ page, run }) => ({
      page,
      count: countOf(run)!,
      xPt: run.xPt,
      yPt: run.yPt,
      sizePt: run.sizePt,
      widthPt: run.widthPt,
    }));
  return { labels, sizePt: Number(size), duplicates, otherSizes: all.length - labels.length };
}

/**
 * Step numbers: the integer size whose values best run 1..N once each. Page
 * numbers also run 1..N, but are dropped first as the one integer per page equal
 * to the page and printed in that page's smallest integer size.
 */
export function stepNumbers(scans: readonly PageScan[]): StepNumber[] {
  const sightings: StepNumber[] = [];
  for (const scan of scans) {
    const integers = dedupeRuns(scan.texts).runs.filter((run) => INTEGER.test(run.text));
    const smallest = Math.min(...integers.map((run) => run.sizePt));
    let droppedPageNumber = false;
    for (const run of integers) {
      const value = Number(run.text);
      if (!droppedPageNumber && value === scan.pageNumber && run.sizePt === smallest) {
        droppedPageNumber = true;
        continue;
      }
      sightings.push({
        page: scan.pageNumber,
        step: value,
        xPt: run.xPt,
        yPt: run.yPt,
        sizePt: run.sizePt,
      });
    }
  }
  const bySize = new Map<string, StepNumber[]>();
  for (const s of sightings) {
    const key = s.sizePt.toFixed(1);
    bySize.set(key, [...(bySize.get(key) ?? []), s]);
  }
  let best: StepNumber[] = [];
  let bestScore = 0;
  for (const group of bySize.values()) {
    const values = new Set(group.map((s) => s.step));
    if (!values.has(1)) continue;
    const score = (values.size / Math.max(...values)) * (values.size / group.length) * values.size;
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return best;
}
