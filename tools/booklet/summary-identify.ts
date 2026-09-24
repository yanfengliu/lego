import type { AlignmentCounts, AlignStage } from "./align-stage.ts";
import type { IdentityScore } from "./identify-score.ts";
import type { IdentifyStage } from "./identify-stage.ts";

/**
 * Console lines and headline counts for identification, the alignment it
 * drives, and identification scored against the official model. Counts only
 * leave for Git; the lines name element ids and step numbers, never poses.
 */
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const list = (values: readonly (string | number)[], max = 6) =>
  values.length <= max
    ? values.join(", ")
    : `${values.slice(0, max).join(", ")} … (+${values.length - max})`;

export function identifyHeadline(identify: IdentifyStage, score: IdentityScore | null) {
  return {
    stepCallouts: identify.summary.stepCallouts,
    stepCalloutPieces: identify.summary.stepCalloutPieces,
    drawings: identify.summary.drawings,
    assignmentProvenOptimal: identify.assignment.provenOptimal,
    flaggedCallouts: identify.flaggedCallouts,
    flaggedSteps: identify.flaggedSteps,
    stepsDisagreeingWithRead: identify.stepsCountsOnly.length,
    againstModel: score && {
      stepsWithCallouts: score.stepsWithCallouts,
      stepsAgreeingByRunOrder: score.stepsAgreeingByRunOrder,
      stepsMovedByBooklet: score.stepsMovedByBooklet,
      stepsUnexplained: score.stepsUnexplained,
      callouts: score.callouts,
      calloutsAgreeing: score.calloutsAgreeing,
    },
  };
}

function countsHeadline(counts: AlignmentCounts) {
  return {
    matchedByRunOrder: counts.matchedByRunOrder,
    fittedByRepair: counts.fittedByRepair,
    unmatched: counts.mismatchedSteps.length,
    runOrderMatchedBeforeRepair: counts.runMatchedSteps,
    repairWindows: counts.windows.length,
    solvedWindows: counts.windows.filter(({ solved }) => solved).length,
    unsolvedWindows: counts.windows.filter(({ solved }) => !solved).map(({ outcome }) => outcome),
  };
}

export function alignHeadline(a: AlignStage) {
  return {
    steps: a.steps.length,
    basis: a.basis,
    ...(a.identity ? { identity: { ...a.identity } } : {}),
    ...countsHeadline(a),
    ...(a.byCounts
      ? {
          byCounts: countsHeadline(a.byCounts),
          partsChangedFromCounts: a.partsChangedFromCounts.length,
        }
      : {}),
    bricksAssigned: sum(a.steps.map(({ bricks }) => bricks.length)),
    unplacedBricks: a.unplaced.length,
    inventoryMismatches: a.inventory.mismatches.length + a.inventory.missingFromInventory.length,
    bagViolations: a.bagViolations.length,
  };
}

export function identifyLines(identify: IdentifyStage, ms: number): string[] {
  const s = identify.summary;
  return [
    `[identify] ${seconds(ms)} · ${s.stepCallouts} step callouts (${s.stepCalloutPieces} pieces), ${s.drawings} drawings, assignment ${identify.assignment.provenOptimal ? "proven optimal" : "NOT proven optimal"} · ${identify.flaggedCallouts} callouts flagged in ${identify.flaggedSteps} steps, aligned by count there · steps whose callouts differ from the text read: ${identify.stepsCountsOnly.length === 0 ? "none" : list(identify.stepsCountsOnly)}`,
  ];
}

function windowsText(counts: AlignmentCounts): string {
  const solved = counts.windows.filter(({ solved: done }) => done);
  const unsolved = counts.windows.filter(({ solved: done }) => !done);
  return `repair: ${counts.windows.length} windows, ${solved.length} solved (moved ${sum(solved.map(({ moved }) => moved))} bricks)${unsolved.length > 0 ? `, ${unsolved.map(({ outcome, firstStep, lastStep }) => `${outcome} at steps ${firstStep}-${lastStep}`).join(", ")}` : ""}`;
}

/** The first align line and the comparison beneath it, by identity or by counts. */
export function alignHeadLines(align: AlignStage, ms: number, identifyNote: string): string[] {
  const unmatched = align.mismatchedSteps.length;
  if (!align.identity || !align.byCounts) {
    return [
      `[align] ${seconds(ms)} · by counts (${identifyNote}), ${align.steps.length} steps: ${align.matchedByRunOrder} matched by run order, ${align.fittedByRepair} fitted by repair, ${unmatched} unmatched · ${windowsText(align)}`,
      `  a match compares callout counts only, never which elements; the inventory check sees per-element totals, not the split into steps`,
    ];
  }
  const i = align.identity;
  const c = align.byCounts;
  return [
    `[align] ${seconds(ms)} · by identity, ${align.steps.length} steps: ${i.exact} exact identity (${i.exactByRunOrder} by run order, ${i.exactByRepair} re-laid by repair; ${i.exactWithoutCallouts} print no callouts), ${i.countFallback} count fallback (flagged callouts), ${i.mismatched} mismatch · ${windowsText(align)}`,
    `  by counts only (the comparison): ${c.matchedByRunOrder} matched by run order, ${c.fittedByRepair} fitted by repair, ${c.mismatchedSteps.length} unmatched${c.mismatchedSteps.length > 0 ? ` (${list(c.mismatchedSteps, 4)})` : ""}; identity gives ${align.partsChangedFromCounts.length} steps other parts: ${list(align.partsChangedFromCounts, 8) || "none"}`,
  ];
}

/** Identification against the official model: run-order agreement, the booklet's moves, callouts. */
export function scoreLines(score: IdentityScore): string[] {
  const earlier = score.moves.filter(({ direction }) => direction === "booklet earlier");
  const later = score.moves.filter(({ direction }) => direction === "booklet later");
  const flagged = score.calloutDifferences.filter(({ flagged: isFlagged }) => isFlagged).length;
  const moved = score.differences.filter(({ explanation }) => explanation === "moved");
  const unexplained = score.differences.filter(({ explanation }) => explanation === "unexplained");
  const lines = [
    `[identify vs model] ${score.stepsAgreeingByRunOrder} of ${score.stepsWithCallouts} steps with callouts agree with the model's run order; ${score.stepsMovedByBooklet} differ only where the booklet moves an element (${sum(earlier.map(({ pieces }) => pieces))} pieces printed earlier than the model builds them, ${sum(later.map(({ pieces }) => pieces))} later); ${score.stepsUnexplained} unexplained · callouts after alignment: ${score.calloutsAgreeing}/${score.callouts} agree${score.calloutDifferences.length > 0 ? ` (${flagged} of the ${score.calloutDifferences.length} that differ were flagged)` : ""}`,
    `  moved by the booklet: ${
      moved.length === 0
        ? "none"
        : list(
            moved.map(({ step }) => {
              const here = score.moves.filter(({ bookletStep }) => bookletStep === step);
              return `${step} ← ${here.map(({ pieces, element, modelStep }) => `${pieces}x${element} (model ${modelStep})`).join(" ")}`;
            }),
            4,
          )
    }`.slice(0, 300),
  ];
  if (unexplained.length > 0) {
    lines.push(
      `  unexplained: ${list(
        unexplained.map(
          ({ step, identifiedOnly, modelOnly }) =>
            `${step} (identified ${Object.entries(identifiedOnly)
              .map(([element, pieces]) => `${pieces}x${element}`)
              .join(" ")} vs model ${Object.entries(modelOnly)
              .map(([element, pieces]) => `${pieces}x${element}`)
              .join(" ")})`,
        ),
        3,
      )}`.slice(0, 300),
    );
  }
  return lines;
}
