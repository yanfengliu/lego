import type { BuildSequenceState } from "@lego-studio/brick-kernel";

/**
 * The playback bar's second line: where the scrubber is, how many parts the
 * state holds, and what the step added.
 *
 * A step that adds nothing (a printed step that only returns from a sub-build
 * or turns the model over) draws the same parts as the step before it, so the
 * line says so in words instead of dropping the count: the known failure was a
 * zero-piece step that looked identical to its predecessor with nothing on
 * screen to tell them apart.
 */
export function playbackReadoutDetail(
  state: Pick<BuildSequenceState, "stepIndex" | "addedPartIds" | "cumulativePartCount">,
  position: number,
  lastPosition: number,
): string {
  const added =
    state.stepIndex < 0
      ? ""
      : state.addedPartIds.length > 0
        ? ` · +${state.addedPartIds.length}`
        : " · no new parts";
  return `${position} / ${lastPosition} · ${state.cumulativePartCount} parts${added}`;
}
