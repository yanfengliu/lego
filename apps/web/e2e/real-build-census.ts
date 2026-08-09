import type { RealBuildResult, RealBuildStepReport, StepFailure } from "./real-build-safety";

/**
 * What every requested printed step did, and why, in one block a run prints
 * before anything downstream can throw.
 *
 * A run that stops reports one blocker; a run that stops and says nothing about
 * the forty-nine steps it also examined costs a whole run per defect. Everything
 * here is already in the retained rows — the refusal code and its message
 * verbatim, the numbers that message quotes, the panel face, whether the panel's
 * highlight closed, the candidate counts, and the pieces placed against the
 * pieces the ledger declares. Printing it is what turns a failing run into a
 * survey, so defects can be fixed by class instead of chased one at a time.
 */

/** How many distinct failure lines one step may print before the rest are counted. */
const MAXIMUM_STEP_CAUSES = 6;

const face = (step: RealBuildStepReport): string => step.panelFace ?? "face-unknown";

const highlightPhrase = (step: RealBuildStepReport): string =>
  `highlight ${step.highlight.regions} region(s) ${
    step.highlight.regions === 0
      ? "none"
      : step.highlight.closedContourRate >= 1
        ? "closed"
        : step.highlight.closedContourRate <= 0
          ? "open"
          : `closed ${step.highlight.closedContourRate}`
  } ${step.highlight.strokePx}px`;

const candidatePhrase = (step: RealBuildStepReport): string => {
  const enumerated = step.pieces.reduce((total, piece) => total + piece.enumerated, 0);
  const rendered = step.pieces.reduce((total, piece) => total + piece.rendered, 0);
  const deferred =
    step.deferral === null
      ? ""
      : `, deferred ${step.deferral.wholeStepCandidates} whole-step candidate(s) rendered ${step.deferral.rendered}`;
  return `candidates ${enumerated} enumerated ${rendered} rendered${deferred}`;
};

const causeLine = (failure: StepFailure): string => `${failure.code}: ${failure.message}`;

/** Every retained cause that names this printed step, in the order the run produced them. */
function stepCauses(result: RealBuildResult, step: RealBuildStepReport): readonly string[] {
  const own = step.outcome.status === "failed" ? [causeLine(step.outcome.failure)] : [];
  const named = [...result.inputFailures, ...result.completionFailures]
    .filter((failure) => failure.stepNumber === step.stepNumber)
    .map(causeLine);
  return [...new Set([...own, ...named])];
}

export function realBuildStepCensus(result: RealBuildResult): string {
  const complete = result.steps.filter(({ outcome }) => outcome.status === "complete").length;
  const placed = result.steps.reduce((total, step) => total + step.placedPieces, 0);
  const declared = result.steps.reduce((total, step) => total + step.expectedAssembledPieces, 0);
  // Causes that name no step at all still belong to the census: an unledgered
  // prefix refuses once for the whole run, and that refusal is the reason every
  // row below it says nothing.
  const unscoped = [...result.inputFailures, ...result.completionFailures].filter(
    ({ stepNumber }) => stepNumber === undefined,
  );
  const byCode = new Map<string, number>();
  const lines = result.steps.map((step) => {
    const causes = stepCauses(result, step);
    for (const cause of causes) {
      const code = cause.slice(0, cause.indexOf(":"));
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
    }
    const head =
      `  step ${step.stepNumber} p${step.pageNumber} ${face(step)} ` +
      `${step.outcome.status}/${step.outcome.mechanism} ${step.placedPieces}/${step.expectedAssembledPieces} piece(s) ` +
      `[${highlightPhrase(step)}; arrows ${step.arrows.kept} kept ${step.arrows.rejected} rejected; ` +
      `${candidatePhrase(step)}]`;
    const shown = causes.slice(0, MAXIMUM_STEP_CAUSES);
    const remainder =
      causes.length > shown.length
        ? [`      … and ${causes.length - shown.length} further cause(s) naming this step`]
        : [];
    return [head, ...shown.map((cause) => `      — ${cause}`), ...remainder].join("\n");
  });
  const tally = [...byCode.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([code, count]) => `${code} x${count}`);
  return [
    `census: ${result.status}; ${result.steps.length} requested printed step(s), ${complete} complete; ` +
      `${placed} piece(s) placed against ${declared} the ledger declares for them; ` +
      `${result.inputFailures.length} input failure(s), ${result.completionFailures.length} completion failure(s).`,
    ...lines,
    ...unscoped.map((failure) => `  run-wide — ${causeLine(failure)}`),
    tally.length === 0
      ? "  no refusal class was recorded."
      : `  refusal classes: ${tally.join(", ")}`,
  ].join("\n");
}
