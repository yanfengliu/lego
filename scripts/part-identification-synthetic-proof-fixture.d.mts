import type {
  AuthenticatedJsonArtifact,
  PartIdentificationAnswer,
} from "./part-identification-artifacts.mjs";

export function syntheticPartIdentificationAnswerClosure(input: {
  readonly cardId: string;
  readonly image: Uint8Array;
  readonly cardsDigest: string;
  readonly matchDigest: string;
  readonly answer: PartIdentificationAnswer;
}): {
  readonly answersArtifact: AuthenticatedJsonArtifact;
  readonly traceArtifacts: Readonly<Record<string, Uint8Array>>;
};
