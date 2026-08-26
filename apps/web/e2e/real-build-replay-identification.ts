import {
  identifyRealBuildIdentificationMode,
  rawJsonArtifactFromBytes,
  verifyRealBuildIdentificationClosure,
} from "./real-build-identification-closure";
import {
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  type RealBuildRunContract,
} from "./real-build-run-contract";

export const MANDATORY_IDENTIFICATION_ROLES = [
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged,
] as const;

export const CURRENT_MANDATORY_IDENTIFICATION_ROLES = [
  ...MANDATORY_IDENTIFICATION_ROLES,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound,
] as const;

export const CONDITIONAL_IDENTIFICATION_ROLES = [
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cards,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cardImages,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.answers,
] as const;

function requiredIdentificationRoles(
  source: "deterministic" | "adjudicated",
  requireSourceArtRebound: boolean,
): readonly string[] {
  const mandatory = requireSourceArtRebound
    ? CURRENT_MANDATORY_IDENTIFICATION_ROLES
    : MANDATORY_IDENTIFICATION_ROLES;
  return source === "adjudicated" ? [...mandatory, ...CONDITIONAL_IDENTIFICATION_ROLES] : mandatory;
}

export function assertSourceExactIdentificationRoles(
  roleNames: ReadonlySet<string>,
  source: "deterministic" | "adjudicated",
  requireSourceArtRebound = false,
): void {
  const missing = requiredIdentificationRoles(source, requireSourceArtRebound).filter(
    (role) => !roleNames.has(role),
  );
  if (missing.length > 0) {
    throw new TypeError(
      `${source === "adjudicated" ? "Adjudicated" : "Deterministic"} replay closure is missing source-required identification roles: ${missing.join(", ")}.`,
    );
  }
  if (
    !requireSourceArtRebound &&
    roleNames.has(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound)
  ) {
    throw new TypeError(
      "A legacy replay closure must omit the future source-art-rebound role entirely.",
    );
  }
  if (
    source === "deterministic" &&
    CONDITIONAL_IDENTIFICATION_ROLES.some((role) => roleNames.has(role))
  ) {
    throw new TypeError(
      "Deterministic replay closure must omit identification-card, card-image, and answer roles entirely.",
    );
  }
}

/** Reconstructs coverage exclusively from retained raw roles and the digest-bound contract. */
export function reconstructRealBuildIdentificationReplay(
  roleBytes: ReadonlyMap<string, Buffer>,
  contract: RealBuildRunContract,
): Promise<unknown> {
  const artifact = (role: string) => {
    const bytes = roleBytes.get(role);
    if (bytes === undefined) throw new TypeError(`Replay closure has no retained ${role} bytes.`);
    return rawJsonArtifactFromBytes(bytes, `Replay role ${role}`);
  };
  const binaryArtifact = (role: string, digest: string) => {
    const bytes = roleBytes.get(role);
    if (bytes === undefined) throw new TypeError(`Replay closure has no retained ${role} bytes.`);
    return { bytes, digest };
  };
  const coverage = artifact(REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage);
  const requestedLastStep =
    contract.schemaVersion === "lego.real-build-run-contract/4" ||
    contract.schemaVersion === "lego.real-build-run-contract/5"
      ? (contract.budgets.lastStep ?? Number.NaN)
      : 359;
  const mode = identifyRealBuildIdentificationMode(coverage, requestedLastStep);
  const coverageBindings = coverage.value as {
    readonly inputDigests?: {
      readonly pdf?: unknown;
      readonly calloutManifest?: unknown;
      readonly sourceArtRebound?: unknown;
    };
  };
  if (
    coverageBindings.inputDigests?.pdf !== contract.inputDigests.pdf ||
    coverageBindings.inputDigests.calloutManifest !== contract.inputDigests.calloutManifest ||
    (contract.schemaVersion === "lego.real-build-run-contract/5" &&
      coverageBindings.inputDigests.sourceArtRebound !==
        contract.identificationClosure.sourceArtRebound)
  ) {
    throw new TypeError(
      "Reconstructed coverage does not bind the run contract's retained PDF and callout-manifest roles.",
    );
  }
  if (mode.source !== contract.identificationClosure.source) {
    throw new TypeError(
      `Retained coverage declares ${mode.source} identification, but the digest-bound run contract declares ${contract.identificationClosure.source}.`,
    );
  }
  assertSourceExactIdentificationRoles(
    new Set(roleBytes.keys()),
    mode.source,
    contract.schemaVersion === "lego.real-build-run-contract/5",
  );
  const verification = verifyRealBuildIdentificationClosure({
    pdf:
      contract.schemaVersion === "lego.real-build-run-contract/5"
        ? binaryArtifact("pdf", contract.inputDigests.pdf)
        : null,
    coverage,
    manifest: artifact(REAL_BUILD_INPUT_ROLE_BY_DIGEST.calloutManifest),
    features: artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features),
    match: artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match),
    distances: artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances),
    elementResolution: artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements),
    pairJudged: artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged),
    sourceArtRebound:
      contract.schemaVersion === "lego.real-build-run-contract/5"
        ? artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound)
        : null,
    cards:
      mode.source === "adjudicated"
        ? artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cards)
        : null,
    cardImages:
      mode.source === "adjudicated"
        ? binaryArtifact(
            REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cardImages,
            contract.identificationClosure.cardImages!,
          )
        : null,
    answers:
      mode.source === "adjudicated"
        ? artifact(REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.answers)
        : null,
    requestedLastStep,
  });
  return Promise.resolve(verification).then((reproduced) => {
    const reproducedBytes = Buffer.from(`${JSON.stringify(reproduced, null, 1)}\n`);
    if (!reproducedBytes.equals(Buffer.from(coverage.bytes))) {
      throw new TypeError(
        "Replay identification reconstruction does not exactly equal the retained coverage JSON bytes.",
      );
    }
    return reproduced;
  });
}
