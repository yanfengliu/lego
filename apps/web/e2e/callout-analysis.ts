import type { PanelBounds } from "../src/instructions/step-panels";
import { CALLOUT_RECOVERY_BY_IDENTITY } from "./callout-recovery-fixture";
import type {
  BoxMethod,
  CalloutTarget,
  EvidenceKind,
  QuantityLabel,
  RegionKind,
} from "./callout-types";

export function stableIdentity(
  pageNumber: number,
  quantity: number,
  xPt: number,
  yPt: number,
): string {
  return `p${pageNumber}|q${quantity}|x${xPt.toFixed(3)}|y${yPt.toFixed(3)}`;
}

export function fileStem(identity: string): string {
  return identity.replaceAll("|", "-").replaceAll(".", "d");
}

export function contains(bounds: PanelBounds, xPt: number, yPt: number): boolean {
  return xPt >= bounds.minXPt && xPt < bounds.maxXPt && yPt >= bounds.minYPt && yPt < bounds.maxYPt;
}

export function area(bounds: PanelBounds): number {
  return (bounds.maxXPt - bounds.minXPt) * (bounds.maxYPt - bounds.minYPt);
}

export function evidenceContract(
  identity: string,
  boxMethod: BoxMethod,
): { readonly evidenceKind: EvidenceKind; readonly regionKind: RegionKind } | null {
  const fixed = CALLOUT_RECOVERY_BY_IDENTITY.get(identity);
  if (fixed && fixed.evidenceKind !== "part-art") {
    return { evidenceKind: fixed.evidenceKind, regionKind: fixed.regionKind };
  }
  if (boxMethod === "panel-neighbor-cell") return null;
  return { evidenceKind: "part-art", regionKind: "isolated-component" };
}

/**
 * Derives an unboxed label's cell only from its step panel and peer labels.
 * No booklet-specific page coordinate participates in this construction.
 */
export function recoverPanelNeighbourCell(
  label: QuantityLabel,
  panel: PanelBounds,
  boxedPeers: readonly CalloutTarget[],
): PanelBounds | null {
  let minXPt = panel.minXPt;
  let maxXPt = panel.maxXPt;
  let minYPt = panel.minYPt;
  let maxYPt = panel.maxYPt;

  for (const peer of boxedPeers) {
    if (peer.identity === label.identity) continue;
    if (Math.abs(label.xPt - peer.xPt) >= 24) {
      const cut = (label.xPt + peer.xPt) / 2;
      if (peer.xPt < label.xPt) minXPt = Math.max(minXPt, cut);
      else maxXPt = Math.min(maxXPt, cut);
    }
    if (Math.abs(label.yPt - peer.yPt) >= 24) {
      const cut = (label.yPt + peer.yPt) / 2;
      if (peer.yPt < label.yPt) minYPt = Math.max(minYPt, cut);
      else maxYPt = Math.min(maxYPt, cut);
    }
  }

  if (maxXPt - minXPt < 25 || maxYPt - minYPt < 25) return null;
  return { minXPt, maxXPt, minYPt, maxYPt };
}

export function parseRequestedPages(raw: string | undefined): readonly number[] | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim() === "") {
    throw new Error("CALLOUT_PAGES is empty; provide one or more comma-separated step pages.");
  }
  const tokens = raw.split(",").map((value) => value.trim());
  const invalid = tokens.filter((value) => !/^\d+$/.test(value) || Number(value) < 1);
  if (invalid.length > 0) {
    throw new Error(
      `CALLOUT_PAGES contains invalid page token(s) ${invalid.join(", ")}; use positive integers.`,
    );
  }
  const pages = tokens.map(Number);
  const duplicates = pages.filter((value, index) => pages.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `CALLOUT_PAGES repeats page(s) ${[...new Set(duplicates)].join(", ")}; each step page must appear once.`,
    );
  }
  return pages;
}

export function selectStepPages(
  allStepPages: readonly number[],
  requestedPages: readonly number[] | undefined,
  pageLimit: number,
): readonly number[] {
  if (!Number.isInteger(pageLimit) || pageLimit < 0) {
    throw new Error(`CALLOUT_PAGE_LIMIT is ${pageLimit}; use 0 for full or a positive integer.`);
  }
  const stepPageSet = new Set(allStepPages);
  if (requestedPages !== undefined) {
    const nonStep = requestedPages.filter((pageNumber) => !stepPageSet.has(pageNumber));
    if (nonStep.length > 0) {
      throw new Error(
        `CALLOUT_PAGES includes non-step page(s) ${nonStep.join(", ")}; no manifest was published.`,
      );
    }
    if (requestedPages.length === 0) {
      throw new Error("CALLOUT_PAGES selected no step pages; no manifest was published.");
    }
    return requestedPages;
  }
  const selected = pageLimit === 0 ? [...allStepPages] : allStepPages.slice(0, pageLimit);
  if (selected.length === 0) {
    throw new Error("The booklet selection contains no step pages; no manifest was published.");
  }
  return selected;
}
