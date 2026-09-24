import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { PartBlueprint } from "./part-blueprint-types.ts";

export const offsetKey = ([x, z]: readonly [number, number]): string => `${x},${z}`;
const hasPinnedDigest = (value: string, algorithm: "md5" | "sha256"): boolean =>
  new RegExp(`^${algorithm}:[0-9a-f]{${algorithm === "md5" ? 32 : 64}}$`).test(value);
const normalizedOffsetSetSha256 = (
  offsets: readonly (readonly [number, number])[],
): `sha256:${string}` => {
  const normalized = JSON.stringify(
    [...offsets].sort(([leftX, leftZ], [rightX, rightZ]) => leftX - rightX || leftZ - rightZ),
  );
  return `sha256:${bytesToHex(sha256(utf8ToBytes(normalized)))}`;
};

export const validatePinnedClutchOffsets = (
  ldrawId: string,
  clutchOffsetsLdu: readonly (readonly [number, number])[],
  partialOverhangClutchEvidence: NonNullable<PartBlueprint["partialOverhangClutchEvidence"]>,
): void => {
  const digestChecks = [
    [partialOverhangClutchEvidence.manifestSha256, "sha256", "manifestSha256"],
    [partialOverhangClutchEvidence.manifestMd5, "md5", "manifestMd5"],
    [partialOverhangClutchEvidence.bundleSha256, "sha256", "bundleSha256"],
    [partialOverhangClutchEvidence.primitiveXmlSha256, "sha256", "primitiveXmlSha256"],
    [partialOverhangClutchEvidence.independentPartSha256, "sha256", "independentPartSha256"],
    [partialOverhangClutchEvidence.independentSubpartSha256, "sha256", "independentSubpartSha256"],
    [
      partialOverhangClutchEvidence.normalizedClutchOffsetsSha256,
      "sha256",
      "normalizedClutchOffsetsSha256",
    ],
  ] as const;
  for (const [value, algorithm, field] of digestChecks) {
    if (!hasPinnedDigest(value, algorithm)) {
      throw new Error(
        `${ldrawId} partial-overhang evidence ${field} must be a lowercase ${algorithm} digest`,
      );
    }
  }
  if (
    partialOverhangClutchEvidence.sourceId.length === 0 ||
    partialOverhangClutchEvidence.sourceRevision.length === 0 ||
    partialOverhangClutchEvidence.independentSourceId.length === 0 ||
    partialOverhangClutchEvidence.independentSourceRevision.length === 0
  ) {
    throw new Error(
      `${ldrawId} partial-overhang evidence must name both exact source identities and revisions`,
    );
  }
  const normalizedClutchOffsetsSha256 = normalizedOffsetSetSha256(clutchOffsetsLdu);
  if (
    normalizedClutchOffsetsSha256 !== partialOverhangClutchEvidence.normalizedClutchOffsetsSha256
  ) {
    throw new Error(
      `${ldrawId} explicit clutch offsets digest ${normalizedClutchOffsetsSha256} does not match source-extracted normalized digest ${partialOverhangClutchEvidence.normalizedClutchOffsetsSha256}`,
    );
  }
  const offsets = new Set(clutchOffsetsLdu.map(offsetKey));
  for (const [index, override] of partialOverhangClutchEvidence.overrides.entries()) {
    if (
      !override.positionLdu.every(Number.isFinite) ||
      !Number.isFinite(override.maximumOuterOverhangLdu) ||
      override.maximumOuterOverhangLdu <= 0
    ) {
      throw new Error(`${ldrawId} partial-overhang override ${index} has invalid geometry`);
    }
    if (!offsets.has(offsetKey(override.positionLdu))) {
      throw new Error(
        `${ldrawId} partial-overhang override ${index} names [${override.positionLdu.join(", ")}], which is not one of the ${clutchOffsetsLdu.length} pinned clutch offsets`,
      );
    }
  }
};

export const validatePartialOverhangClutchEvidence = (blueprint: PartBlueprint): void => {
  const { bodyArc, clutchOffsetsLdu, partialOverhangClutchEvidence } = blueprint;
  if (partialOverhangClutchEvidence === undefined) return;
  if (bodyArc === undefined || clutchOffsetsLdu === undefined) {
    throw new Error(
      `${blueprint.ldrawId} partial-overhang clutch evidence requires an analytic bodyArc and explicit clutchOffsetsLdu`,
    );
  }
  validatePinnedClutchOffsets(blueprint.ldrawId, clutchOffsetsLdu, partialOverhangClutchEvidence);
};

/**
 * A blueprint's source-verified partial-overhang overrides keyed by clutch
 * offset, after checking that its explicit clutch offsets are unique and that
 * each override names one of them, once, with a positive finite maximum.
 */
export const partialOverhangOverridesByOffset = (blueprint: PartBlueprint) => {
  const { clutchOffsetsLdu, partialOverhangClutchEvidence } = blueprint;
  const partialOverhangOverrides = new Map<
    string,
    NonNullable<PartBlueprint["partialOverhangClutchEvidence"]>["overrides"][number]
  >();
  if (partialOverhangClutchEvidence !== undefined && clutchOffsetsLdu !== undefined) {
    const clutchKeys = new Set(clutchOffsetsLdu.map(offsetKey));
    if (clutchKeys.size !== clutchOffsetsLdu.length) {
      throw new Error(
        `${blueprint.ldrawId} partial-overhang evidence requires unique explicit clutch offsets`,
      );
    }
    for (const override of partialOverhangClutchEvidence.overrides) {
      const key = offsetKey(override.positionLdu);
      if (partialOverhangOverrides.has(key)) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang evidence repeats clutch offset [${override.positionLdu.join(", ")}]`,
        );
      }
      if (!clutchKeys.has(key)) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang evidence names [${override.positionLdu.join(", ")}] but clutchOffsetsLdu does not`,
        );
      }
      if (
        !Number.isFinite(override.maximumOuterOverhangLdu) ||
        override.maximumOuterOverhangLdu <= 0
      ) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang maximum for [${override.positionLdu.join(", ")}] must be a positive finite LDU distance`,
        );
      }
      partialOverhangOverrides.set(key, override);
    }
  }
  return partialOverhangOverrides;
};
