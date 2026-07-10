import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  runDeterministicMakerPopulation,
  type DeterministicMakerPopulationInput,
} from "@lego-studio/generation";

export const CANDIDATE_LAB_VERIFIER_VERSION = "lego.web-candidate-lab-verifier/1" as const;

export interface TrustedPopulationDigest {
  readonly verifierVersion: typeof CANDIDATE_LAB_VERIFIER_VERSION;
  readonly requestHash: ReturnType<typeof canonicalDigest>;
  readonly expectedCanonicalDigest: ReturnType<typeof canonicalDigest>;
  readonly expectedOk: boolean;
  readonly verificationDurationMs: number;
}

export function computeTrustedPopulationDigest(
  input: DeterministicMakerPopulationInput,
): TrustedPopulationDigest {
  const started = performance.now();
  const expected = runDeterministicMakerPopulation(input);
  return {
    verifierVersion: CANDIDATE_LAB_VERIFIER_VERSION,
    requestHash: canonicalDigest(input),
    expectedCanonicalDigest: canonicalDigest(expected),
    expectedOk: expected.ok,
    verificationDurationMs: performance.now() - started,
  };
}
