import {
  createFartherOriginFrontier,
  findFirstRevealingPanel,
  type FartherFrontier,
  type FartherOriginCandidateInput,
  type FartherOriginEvidence,
  type FartherPanelObservationInput,
  type FartherRefusal,
  type FirstRevealingPanelResult,
} from "./real-build-farther-panel";
import type { FartherPanelRenderReservation } from "./real-build-farther-driver";

export type FartherOriginProbeCandidate<D> = FartherOriginCandidateInput<D>;

export interface FartherOriginProbeDecision {
  readonly originCandidateId: string;
  readonly revealingStepNumber: number;
  readonly survivingCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
  readonly descendantSettled: true;
}

export interface FartherOriginProbeResult<
  D,
  O extends FartherOriginProbeCandidate<D>,
  S extends { readonly observation: FartherPanelObservationInput },
> {
  readonly decision: FartherOriginProbeDecision | null;
  readonly refusal: FartherRefusal | null;
  readonly frontier: FartherFrontier<D> | null;
  readonly origins: readonly O[];
  readonly score: S | null;
  readonly evidence: FirstRevealingPanelResult["evidence"];
}

const frozen = <T>(values: readonly T[]): readonly T[] => Object.freeze([...values]);

const refusal = (
  code: FartherRefusal["code"],
  stage: FartherRefusal["stage"],
  stepNumber: number,
  message: string,
): FartherRefusal => Object.freeze({ code, stage, stepNumber, message });

const thrownMessage = (error: unknown): string => {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return "an uninspectable thrown value";
  }
};

/**
 * Scores exact step-N origins at K=N+2 before constructing intervening N+1.
 *
 * The coordinator reserves every score row before invoking the asynchronous
 * callback, rebinds every document hash around it, and admits only an origin
 * decision. An inconclusive probe is a typed bounded refusal; callers that want
 * the more expensive constructed-frontier policy opt out and use the ordinary
 * farther driver instead.
 */
export async function runFartherOriginPanelProbe<
  D,
  O extends FartherOriginProbeCandidate<D>,
  S extends { readonly observation: FartherPanelObservationInput },
>(input: {
  readonly originStepNumber: number;
  readonly origins: readonly O[];
  readonly originEvidence: FartherOriginEvidence;
  readonly originPanelObservation: FartherPanelObservationInput;
  readonly fartherStepNumber: number;
  readonly minimumAgreement: number;
  readonly minimumMargin: number;
  readonly maximumPanelRenders: number;
  readonly maximumReachSteps: number;
  readonly hashDocument: (document: D) => string;
  /** Additional exact state used by scoring, such as the camera anchor document. */
  readonly verifyExternalState?: () => string | null;
  readonly scoreOriginPanel: (input: {
    readonly stepNumber: number;
    readonly origins: readonly O[];
    readonly reservation: FartherPanelRenderReservation;
  }) => Promise<S>;
}): Promise<FartherOriginProbeResult<D, O, S>> {
  const origins = frozen(
    input.origins.map((origin) =>
      Object.freeze({
        ...origin,
        pieces: frozen(
          origin.pieces.map((piece) =>
            Object.freeze({
              ...piece,
              transform: Object.freeze({
                ...piece.transform,
                positionLdu: frozen(piece.transform.positionLdu) as readonly [
                  number,
                  number,
                  number,
                ],
              }),
            }),
          ),
        ),
      }),
    ),
  );
  let evidence: FirstRevealingPanelResult["evidence"] = Object.freeze({
    origin: Object.freeze({ ...input.originEvidence }),
    panels: frozen([]),
    panelRenders: 0,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
  });
  const finish = (values: {
    readonly decision?: FartherOriginProbeDecision | null;
    readonly refusal?: FartherRefusal | null;
    readonly frontier?: FartherFrontier<D> | null;
    readonly score?: S | null;
  }): FartherOriginProbeResult<D, O, S> =>
    Object.freeze({
      decision: values.decision ?? null,
      refusal: values.refusal ?? null,
      frontier:
        values.refusal === null || values.refusal === undefined ? (values.frontier ?? null) : null,
      origins,
      score: values.score ?? null,
      evidence,
    });
  const failInput = (message: string) =>
    finish({
      refusal: refusal("farther-input-invalid", "input", input.fartherStepNumber, message),
    });
  if (
    input.fartherStepNumber !== input.originStepNumber + 2 ||
    !Number.isSafeInteger(input.maximumPanelRenders) ||
    input.maximumPanelRenders < 1 ||
    !Number.isSafeInteger(input.maximumReachSteps) ||
    input.maximumReachSteps < 1
  ) {
    return failInput(
      `Origin farther probe requires K=${input.originStepNumber + 2}, positive panel budget and positive ` +
        `reach; received K=${input.fartherStepNumber}, panel budget ${input.maximumPanelRenders}, and ` +
        `reach ${input.maximumReachSteps}.`,
    );
  }
  const verifyHashes = (): string | null => {
    for (const origin of origins) {
      let actual: string;
      try {
        actual = input.hashDocument(origin.document);
      } catch (error) {
        return `Origin ${JSON.stringify(origin.candidateId)} could not be hashed: ${thrownMessage(error)}.`;
      }
      if (actual !== origin.documentHash) {
        return (
          `Origin ${JSON.stringify(origin.candidateId)} declares document hash ` +
          `${JSON.stringify(origin.documentHash)}, but hashDocument returned ${JSON.stringify(actual)}.`
        );
      }
    }
    if (input.verifyExternalState === undefined) return null;
    try {
      return input.verifyExternalState();
    } catch (error) {
      return `Origin farther probe external state could not be verified: ${thrownMessage(error)}.`;
    }
  };
  const initialHashError = verifyHashes();
  if (initialHashError !== null) return failInput(initialHashError);
  const created = createFartherOriginFrontier({
    stepNumber: input.originStepNumber,
    candidates: origins.map(({ candidateId, document, documentHash, pieces }) => ({
      candidateId,
      document,
      documentHash,
      pieces,
    })),
  });
  if (created.frontier === null) return finish({ refusal: created.refusal });
  const first = findFirstRevealingPanel({
    frontier: created.frontier,
    originEvidence: input.originEvidence,
    panels: [input.originPanelObservation],
    minimumAgreement: input.minimumAgreement,
    minimumMargin: input.minimumMargin,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
    fartherPanelsAvailable: true,
  });
  evidence = first.evidence;
  if (first.decision !== null) {
    return finish({
      decision: Object.freeze({ ...first.decision, descendantSettled: true }),
      frontier: created.frontier,
    });
  }
  if (first.refusal?.code !== "farther-panel-limit-reached") {
    return finish({ refusal: first.refusal });
  }
  if (input.maximumReachSteps < 2) {
    return finish({
      refusal: refusal(
        "farther-panel-limit-reached",
        "budget",
        input.fartherStepNumber,
        `Origin step ${input.originStepNumber} reached its ${input.maximumReachSteps}-step farther-panel ` +
          `limit before panel ${input.fartherStepNumber}; the scoring callback was not invoked.`,
      ),
    });
  }
  const renderedBefore = first.evidence.panelRenders;
  const reservedForPanel = origins.length;
  const renderedAfter = renderedBefore + reservedForPanel;
  if (renderedAfter > input.maximumPanelRenders) {
    return finish({
      refusal: refusal(
        "panel-render-budget-exhausted",
        "budget",
        input.fartherStepNumber,
        `Panel ${input.fartherStepNumber} would raise farther-panel renders from ${renderedBefore} to ` +
          `${renderedAfter}, above aggregate ${input.maximumPanelRenders} limit. The scoring callback was ` +
          `not invoked and no intervening branch was constructed.`,
      ),
    });
  }
  const reservation = Object.freeze({
    renderedBefore,
    reservedForPanel,
    renderedAfter,
    maximumPanelRenders: input.maximumPanelRenders,
  }) satisfies FartherPanelRenderReservation;
  let score: S;
  try {
    score = await input.scoreOriginPanel({
      stepNumber: input.fartherStepNumber,
      origins,
      reservation,
    });
  } catch (error) {
    const hashError = verifyHashes();
    if (hashError !== null) return failInput(hashError);
    return finish({
      refusal: refusal(
        "incomplete-panel-evidence",
        "evidence",
        input.fartherStepNumber,
        `Panel ${input.fartherStepNumber} origin scoring callback threw: ${thrownMessage(error)}. ` +
          `Required exactly one finite agreement score for each of the ${reservedForPanel} reserved origins; ` +
          `the N+1 observation was retained and no intervening branch was constructed.`,
      ),
    });
  }
  const finalHashError = verifyHashes();
  if (finalHashError !== null) return failInput(finalHashError);
  const final = findFirstRevealingPanel({
    frontier: created.frontier,
    originEvidence: input.originEvidence,
    panels: [input.originPanelObservation, score.observation],
    minimumAgreement: input.minimumAgreement,
    minimumMargin: input.minimumMargin,
    maximumPanelRenders: input.maximumPanelRenders,
    maximumReachSteps: input.maximumReachSteps,
    fartherPanelsAvailable: false,
  });
  evidence = final.evidence;
  if (final.decision === null) return finish({ refusal: final.refusal, score });
  return finish({
    decision: Object.freeze({ ...final.decision, descendantSettled: true }),
    frontier: created.frontier,
    score,
  });
}
