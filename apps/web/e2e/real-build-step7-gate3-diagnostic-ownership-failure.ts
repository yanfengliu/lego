import { normalizeThrownWithoutProbing } from "./non-probing-error";

interface RetainedUnverifiedEnvelope {
  readonly fileRelative: string;
}

interface OwnershipFailureEnvelopeInput {
  readonly outputRoot: string;
  readonly stage: "publication";
  readonly failure: unknown;
  readonly counterevidence: Readonly<Record<string, unknown>>;
}

export function throwUnverifiedOwnershipCreationFailure(input: {
  readonly outputRoot: string;
  readonly primary: unknown;
  readonly stagingRelative: string;
  readonly runRelative: string;
  readonly beforeEnvelopeRetention?: (paths: {
    readonly stagingRelative: string;
    readonly runRelative: string;
  }) => void;
  readonly retainEnvelope: (envelope: OwnershipFailureEnvelopeInput) => RetainedUnverifiedEnvelope;
}): never {
  const primary = normalizeThrownWithoutProbing(
    input.primary,
    "Gate-3 staging ownership creation failed without a readable error.",
  );
  let retained: RetainedUnverifiedEnvelope;
  try {
    input.beforeEnvelopeRetention?.({
      stagingRelative: input.stagingRelative,
      runRelative: input.runRelative,
    });
    retained = input.retainEnvelope({
      outputRoot: input.outputRoot,
      stage: "publication",
      failure: primary,
      counterevidence: {
        schemaVersion: "lego.step7-gate3-unverified-staging-ownership/1",
        verification: "ownership-unverified-path-retention",
        authority: "none",
        completeRun: false,
        publicationEligible: false,
        stagingRelative: input.stagingRelative,
        runRelative: input.runRelative,
        directoryCreated: true,
        ownershipVerified: false,
        directoryOwnershipVerified: false,
        ownerTokenVerified: false,
        ownerMarkerVerified: false,
        automaticPathnameDeletionAttempted: false,
      },
    });
  } catch (retentionError) {
    throw new AggregateError(
      [
        primary,
        normalizeThrownWithoutProbing(
          retentionError,
          "Gate-3 unverified ownership-envelope retention failed without a readable error.",
        ),
      ],
      `Gate-3 staging ownership failed and its authority-none envelope could not be retained; the exact unverified staging pathname ${input.stagingRelative} was retained without automatic deletion.`,
      { cause: retentionError },
    );
  }
  throw new Error(
    `Gate-3 staging ownership remained unverified at ${input.stagingRelative}. Authority-none counterevidence was retained at ${retained.fileRelative}; the staging pathname was not deleted.`,
    { cause: primary },
  );
}
