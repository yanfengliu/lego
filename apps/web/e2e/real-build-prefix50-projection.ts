import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  readOpaqueRealBuildPrefix50Occurrence30ActionBinding,
  readOpaqueRealBuildPrefix50VerifiedProjection,
  readSyntheticRealBuildPrefix50ProjectionForTest,
} from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { SET_6651557_OCCURRENCE_BINDINGS } from "./real-build-prefix50-projection-bindings";

export const REAL_BUILD_PREFIX50_LAST_STEP = 50;
export const REAL_BUILD_PREFIX50_OCCURRENCE_COUNT = 320;
export const REAL_BUILD_PREFIX50_TRANSITION_STEP = 44;

export interface RealBuildPrefix50ProjectionStep {
  readonly printedStepNumber: number;
  readonly name: string;
  readonly sourceActionDigest: `sha256:${string}`;
}

export interface RealBuildPrefix50ProjectionOccurrence {
  readonly ordinal: number;
  readonly printedStepNumber: number;
  readonly colorId: string;
  readonly partIdentity: RealBuildPrefix50OccurrencePartIdentity;
  readonly sourceWorldTransform: RigidTransform;
}

export interface RealBuildPrefix50OccurrencePartIdentity {
  /** Published callout identity is retained as counterevidence, never compiled. */
  readonly publishedCatalogPartId: string;
  /** Exact occurrence/member reconciliation; this is the only compiled ID. */
  readonly reconciledCatalogPartId: string;
  readonly officialDesignId: string;
  readonly officialDesignRevision: string;
  /** Exact Builder/LDraw source root, without the inert .dat suffix. */
  readonly sourceLDrawPartId: string;
  /** Exact catalog geometry root, without the inert .dat suffix. */
  readonly catalogLDrawPartId: string;
  /** Present only for a pinned official-archive identity redirect. */
  readonly identityProofId: string | null;
  readonly basis:
    "published-exact" | "official-member-revision" | "official-archive-identity-moved-root";
}

export interface RealBuildPrefix50VerifiedProjection {
  readonly schemaVersion: "lego.real-build-prefix50-verified-projection/1";
  readonly sourceSetId: string;
  readonly sourceArtifactDigest: `sha256:${string}`;
  readonly steps: readonly RealBuildPrefix50ProjectionStep[];
  readonly occurrences: readonly RealBuildPrefix50ProjectionOccurrence[];
}

/** Minted only after the current opaque action and world verifiers both succeed. */
export interface RealBuildPrefix50VerifiedProjectionReader {
  readonly readVerifiedPrefix50Projection: () => RealBuildPrefix50VerifiedProjection;
}

export interface RealBuildPrefix50Occurrence30ActionBinding {
  readonly occurrenceOrdinal: 30;
  readonly printedStepNumber: 14;
  readonly phaseSequence: 18;
  readonly actionKind: "direct";
  readonly calloutIdentity: "p18|q1|x29.480|y468.911";
  readonly builderBrickRef: "40304bdc-7c5b-46cf-bdcc-61a53aeae2c4";
  readonly officialDesignId: "77844";
  readonly designRevision: "77844;B";
}

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const SOURCE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:;/-]*$/u;
const MOVED_ROOT_PROOF = /^\d+[a-z0-9]*\.dat->\d+[a-z0-9]*\.dat$/u;
const verifiedProjectionValues = new WeakSet<object>();

function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let keys: readonly string[];
  try {
    keys = Object.keys(value).sort();
  } catch {
    throw new TypeError(`${label} could not be inspected safely.`);
  }
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 128 || !IDENTIFIER.test(value)) {
    throw new TypeError(`${label} must be a bounded protocol Identifier.`);
  }
  return value;
}

function sourceIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 128 || !SOURCE_IDENTITY.test(value)) {
    throw new TypeError(`${label} must be a bounded inert source identity.`);
  }
  return value;
}

function transform(value: unknown, label: string): RigidTransform {
  exactKeys(value, ["orientationId", "positionLdu"], label);
  const position = ownData(value, "positionLdu", label);
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        Number.isSafeInteger(coordinate * 2),
    )
  ) {
    throw new TypeError(
      `${label}.positionLdu must contain exactly three bounded integer or half-LDU coordinates.`,
    );
  }
  return deepFreeze({
    positionLdu: [...position] as [number, number, number],
    orientationId: identifier(ownData(value, "orientationId", label), `${label}.orientationId`),
  });
}

function partIdentity(value: unknown, label: string): RealBuildPrefix50OccurrencePartIdentity {
  exactKeys(
    value,
    [
      "basis",
      "catalogLDrawPartId",
      "identityProofId",
      "officialDesignId",
      "officialDesignRevision",
      "publishedCatalogPartId",
      "reconciledCatalogPartId",
      "sourceLDrawPartId",
    ],
    label,
  );
  const publishedCatalogPartId = identifier(
    ownData(value, "publishedCatalogPartId", label),
    `${label}.publishedCatalogPartId`,
  );
  const reconciledCatalogPartId = identifier(
    ownData(value, "reconciledCatalogPartId", label),
    `${label}.reconciledCatalogPartId`,
  );
  const officialDesignId = identifier(
    ownData(value, "officialDesignId", label),
    `${label}.officialDesignId`,
  );
  const officialDesignRevision = sourceIdentity(
    ownData(value, "officialDesignRevision", label),
    `${label}.officialDesignRevision`,
  );
  const sourceLDrawPartId = identifier(
    ownData(value, "sourceLDrawPartId", label),
    `${label}.sourceLDrawPartId`,
  );
  const catalogLDrawPartId = identifier(
    ownData(value, "catalogLDrawPartId", label),
    `${label}.catalogLDrawPartId`,
  );
  const identityProofId = ownData(value, "identityProofId", label);
  if (
    identityProofId !== null &&
    (typeof identityProofId !== "string" || !MOVED_ROOT_PROOF.test(identityProofId))
  ) {
    throw new TypeError(`${label}.identityProofId must be null or one exact moved-root proof ID.`);
  }
  const basis = ownData(value, "basis", label);
  if (
    basis !== "published-exact" &&
    basis !== "official-member-revision" &&
    basis !== "official-archive-identity-moved-root"
  ) {
    throw new TypeError(`${label}.basis does not name one exact reconciliation basis.`);
  }
  if (basis === "published-exact" && publishedCatalogPartId !== reconciledCatalogPartId) {
    throw new TypeError(
      `${label} cannot claim published-exact while changing the catalog identity.`,
    );
  }
  if (
    basis === "official-member-revision" &&
    (publishedCatalogPartId === reconciledCatalogPartId || identityProofId !== null)
  ) {
    throw new TypeError(`${label} does not retain an exact official member correction.`);
  }
  if (
    basis === "official-archive-identity-moved-root" &&
    (publishedCatalogPartId !== reconciledCatalogPartId ||
      sourceLDrawPartId === catalogLDrawPartId ||
      identityProofId !== `${sourceLDrawPartId}.dat->${catalogLDrawPartId}.dat`)
  ) {
    throw new TypeError(`${label} does not retain one exact official-archive moved-root proof.`);
  }
  if (basis !== "official-archive-identity-moved-root" && identityProofId !== null) {
    throw new TypeError(`${label} cannot attach a moved-root proof to another basis.`);
  }
  const identity: RealBuildPrefix50OccurrencePartIdentity = deepFreeze({
    publishedCatalogPartId,
    reconciledCatalogPartId,
    officialDesignId,
    officialDesignRevision,
    sourceLDrawPartId,
    catalogLDrawPartId,
    identityProofId,
    basis,
  });
  return identity;
}

function requireFrozenProjection(value: unknown): void {
  if (value === null || typeof value !== "object" || !Object.isFrozen(value)) {
    throw new TypeError(
      "Verified prefix-50 projection must be frozen by its opaque-source reader.",
    );
  }
  const steps = ownData(value, "steps", "Verified prefix-50 projection");
  const occurrences = ownData(value, "occurrences", "Verified prefix-50 projection");
  if (!Object.isFrozen(steps) || !Object.isFrozen(occurrences)) {
    throw new TypeError("Verified prefix-50 projection arrays must be frozen before compilation.");
  }
}

function requireReaderShape(unsafeReader: unknown): () => unknown {
  exactKeys(
    unsafeReader,
    ["readVerifiedPrefix50Projection"],
    "Prefix-50 verified-projection reader",
  );
  const read = ownData(
    unsafeReader,
    "readVerifiedPrefix50Projection",
    "Prefix-50 verified-projection reader",
  );
  if (typeof read !== "function") {
    throw new TypeError("Prefix-50 verified-projection reader must expose a function.");
  }
  return read as () => unknown;
}

function validateProjection(projection: unknown): RealBuildPrefix50VerifiedProjection {
  requireFrozenProjection(projection);
  exactKeys(
    projection,
    ["occurrences", "schemaVersion", "sourceArtifactDigest", "sourceSetId", "steps"],
    "Verified prefix-50 projection",
  );
  if (
    ownData(projection, "schemaVersion", "Verified prefix-50 projection") !==
    "lego.real-build-prefix50-verified-projection/1"
  ) {
    throw new TypeError("Verified prefix-50 projection schema is unsupported.");
  }
  const sourceArtifactDigest = ownData(
    projection,
    "sourceArtifactDigest",
    "Verified prefix-50 projection",
  );
  if (typeof sourceArtifactDigest !== "string" || !SHA256.test(sourceArtifactDigest)) {
    throw new TypeError(
      "Verified prefix-50 source artifact digest must be an exact sha256 digest.",
    );
  }
  const sourceSetId = identifier(
    ownData(projection, "sourceSetId", "Verified prefix-50 projection"),
    "Verified prefix-50 projection.sourceSetId",
  );
  const unsafeSteps = ownData(projection, "steps", "Verified prefix-50 projection");
  if (!Array.isArray(unsafeSteps) || unsafeSteps.length !== REAL_BUILD_PREFIX50_LAST_STEP) {
    throw new TypeError(
      "Verified prefix-50 projection must contain printed steps 1 through 50 exactly once.",
    );
  }
  const steps: RealBuildPrefix50ProjectionStep[] = unsafeSteps.map((value, index) => {
    const label = `Verified prefix-50 step[${index}]`;
    exactKeys(value, ["name", "printedStepNumber", "sourceActionDigest"], label);
    const printedStepNumber = ownData(value, "printedStepNumber", label);
    const name = ownData(value, "name", label);
    const sourceActionDigest = ownData(value, "sourceActionDigest", label);
    if (printedStepNumber !== index + 1) {
      throw new TypeError(
        `Verified prefix-50 steps must be contiguous 1 through 50; found ${String(printedStepNumber)} at index ${index}.`,
      );
    }
    if (typeof name !== "string" || name.length < 1 || name.length > 256) {
      throw new TypeError(`${label}.name must contain 1 through 256 characters.`);
    }
    if (typeof sourceActionDigest !== "string" || !SHA256.test(sourceActionDigest)) {
      throw new TypeError(`${label}.sourceActionDigest must be an exact sha256 digest.`);
    }
    return deepFreeze({
      printedStepNumber,
      name,
      sourceActionDigest: sourceActionDigest as `sha256:${string}`,
    });
  });
  const unsafeOccurrences = ownData(projection, "occurrences", "Verified prefix-50 projection");
  if (
    !Array.isArray(unsafeOccurrences) ||
    unsafeOccurrences.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT
  ) {
    throw new TypeError(
      `Verified prefix-50 projection must contain exactly ${REAL_BUILD_PREFIX50_OCCURRENCE_COUNT} occurrences and no suffix rows.`,
    );
  }
  const perStep = Array.from({ length: REAL_BUILD_PREFIX50_LAST_STEP }, () => 0);
  const occurrences: RealBuildPrefix50ProjectionOccurrence[] = unsafeOccurrences.map(
    (value, index) => {
      const label = `Verified prefix-50 occurrence[${index}]`;
      exactKeys(
        value,
        ["colorId", "ordinal", "partIdentity", "printedStepNumber", "sourceWorldTransform"],
        label,
      );
      const ordinal = ownData(value, "ordinal", label);
      const printedStepNumber = ownData(value, "printedStepNumber", label);
      if (ordinal !== index + 1) throw new TypeError(`${label}.ordinal must be ${index + 1}.`);
      if (
        !Number.isSafeInteger(printedStepNumber) ||
        (printedStepNumber as number) < 1 ||
        (printedStepNumber as number) > REAL_BUILD_PREFIX50_LAST_STEP
      ) {
        throw new TypeError(
          `${label}.printedStepNumber must stay inside the exact prefix 1 through 50; suffix rows are forbidden.`,
        );
      }
      const stepNumber = printedStepNumber as number;
      perStep[stepNumber - 1] = perStep[stepNumber - 1]! + 1;
      const identity = partIdentity(ownData(value, "partIdentity", label), `${label}.partIdentity`);
      const expectedIdentity =
        sourceSetId === "6651557"
          ? SET_6651557_OCCURRENCE_BINDINGS.get(ordinal as number)
          : undefined;
      if (
        expectedIdentity !== undefined &&
        Object.entries(expectedIdentity).some(
          ([key, expectedValue]) =>
            identity[key as keyof RealBuildPrefix50OccurrencePartIdentity] !== expectedValue,
        )
      ) {
        throw new TypeError(
          `${label} must retain the exact occurrence/member reconciliation for set 6651557 ordinal ${String(ordinal)} instead of the published callout identity.`,
        );
      }
      return deepFreeze({
        ordinal: ordinal as number,
        printedStepNumber: stepNumber,
        colorId: identifier(ownData(value, "colorId", label), `${label}.colorId`),
        partIdentity: identity,
        sourceWorldTransform: transform(
          ownData(value, "sourceWorldTransform", label),
          `${label}.sourceWorldTransform`,
        ),
      });
    },
  );
  if (perStep[REAL_BUILD_PREFIX50_TRANSITION_STEP - 1] !== 0) {
    throw new TypeError(
      "Verified prefix-50 printed step 44 must be the one exact zero-piece transition.",
    );
  }
  for (let step = 1; step <= REAL_BUILD_PREFIX50_LAST_STEP; step += 1) {
    if (step !== REAL_BUILD_PREFIX50_TRANSITION_STEP && perStep[step - 1] === 0) {
      throw new TypeError(
        `Verified prefix-50 printed step ${step} must contain at least one occurrence.`,
      );
    }
  }
  const verified = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-verified-projection/1" as const,
    sourceSetId,
    sourceArtifactDigest: sourceArtifactDigest as `sha256:${string}`,
    steps,
    occurrences,
  });
  verifiedProjectionValues.add(verified);
  return verified;
}

export function readRealBuildPrefix50VerifiedProjection(
  unsafeReader: unknown,
): RealBuildPrefix50VerifiedProjection {
  requireReaderShape(unsafeReader);
  return validateProjection(readOpaqueRealBuildPrefix50VerifiedProjection(unsafeReader));
}

export function readRealBuildPrefix50Occurrence30ActionBinding(
  unsafeReader: unknown,
): RealBuildPrefix50Occurrence30ActionBinding {
  requireReaderShape(unsafeReader);
  return readOpaqueRealBuildPrefix50Occurrence30ActionBinding(
    unsafeReader,
  ) as RealBuildPrefix50Occurrence30ActionBinding;
}

export function readSyntheticRealBuildPrefix50DiagnosticProjectionForTest(
  unsafeReader: unknown,
): RealBuildPrefix50VerifiedProjection {
  requireReaderShape(unsafeReader);
  return validateProjection(readSyntheticRealBuildPrefix50ProjectionForTest(unsafeReader));
}

/**
 * Preserves the opaque-reader trust boundary across internal computation stages.
 * Shape-compatible or even deeply frozen caller values do not pass this check.
 */
export function requireRealBuildPrefix50VerifiedProjectionValue(
  projection: RealBuildPrefix50VerifiedProjection,
): RealBuildPrefix50VerifiedProjection {
  if (!verifiedProjectionValues.has(projection)) {
    throw new TypeError(
      "Prefix-50 computation requires the exact projection value minted by the opaque verified-projection reader; caller-shaped projections carry no repair authority.",
    );
  }
  return projection;
}

export function realBuildPrefix50ProjectionCommitment(
  projection: RealBuildPrefix50VerifiedProjection,
): `sha256:${string}` {
  return canonicalDigest(projection);
}
