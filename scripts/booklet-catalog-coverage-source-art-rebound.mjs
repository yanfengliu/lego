import { isDeepStrictEqual } from "node:util";

import { assertPairJudgedTruthFromParsedJson } from "./part-identification-pair-judged.mjs";

export const SOURCE_ART_REBOUND_CONFIDENCE = "source-art-rebound";

const REBOUND_ELEMENT_ID = "4160025";
const REFERENCE = Object.freeze({
  identity: "p11|q1|x506.064|y212.112",
  stepNumber: 4,
});
const TARGET = Object.freeze({
  identity: "p11|q1|x90.511|y212.112",
  stepNumber: 2,
});
const PRESERVED = Object.freeze({
  identity: "p20|q1|x36.320|y430.691",
  stepNumber: 16,
});
const POLICY_MEMBERS = Object.freeze([TARGET, REFERENCE, PRESERVED]);

function shown(value) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

function exactMember(member, expected) {
  return member?.identity === expected.identity && member?.stepNumber === expected.stepNumber;
}

function requirePolicyRelation(projection) {
  if (
    projection?.schemaVersion !== "lego.part-identification-source-art-rebound/1" ||
    typeof projection.artifactSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(projection.artifactSha256) ||
    !exactMember(projection.reference, REFERENCE) ||
    !Array.isArray(projection.members) ||
    projection.members.length !== POLICY_MEMBERS.length
  ) {
    throw new Error(
      "Verified source-art rebound does not expose the exact bounded step-2/4/16 relation required by catalog coverage.",
    );
  }
  const members = new Map();
  for (const member of projection.members) {
    if (
      typeof member?.cropSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(member.cropSha256) ||
      typeof member.identity !== "string" ||
      members.has(member.identity)
    ) {
      throw new Error(
        "Verified source-art rebound members must retain unique identities and exact crop digests.",
      );
    }
    members.set(member.identity, member);
  }
  for (const expected of POLICY_MEMBERS) {
    if (!exactMember(members.get(expected.identity), expected)) {
      throw new Error(
        `Verified source-art rebound is missing policy member ${expected.identity} at printed step ${expected.stepNumber}.`,
      );
    }
  }
  const reference = members.get(REFERENCE.identity);
  if (!isDeepStrictEqual(projection.reference, reference)) {
    throw new Error(
      "Verified source-art rebound reference must be the exact step-4 member, not a detached or second relation anchor.",
    );
  }
  return members;
}

function requireIndexedReportMember(report, relationMember, expected) {
  const row = report.byCallout?.[expected.identity];
  if (row === undefined) {
    throw new Error(
      `Source-art rebound requires extant callout ${expected.identity} at printed step ${expected.stepNumber}; the coverage report does not contain it. Restore the complete 359-step source/index closure.`,
    );
  }
  if (
    row.identity !== expected.identity ||
    row.stepNumber !== expected.stepNumber ||
    row.cropDigest !== relationMember.cropSha256
  ) {
    throw new Error(
      `Source-art rebound source/index row ${expected.identity} conflicts with the verified relation; expected ${shown({ stepNumber: expected.stepNumber, cropDigest: relationMember.cropSha256 })}, received ${shown({ stepNumber: row.stepNumber, cropDigest: row.cropDigest })}.`,
    );
  }
  return row;
}

function requireReportMember(report, relationMember, expected, allowedConfidences) {
  const row = requireIndexedReportMember(report, relationMember, expected);
  if (
    row.elementId !== REBOUND_ELEMENT_ID ||
    row.resolution === null ||
    row.resolution === undefined ||
    !allowedConfidences.includes(row.identificationConfidence)
  ) {
    throw new Error(
      `Source-art rebound callout ${expected.identity} conflicts with its existing coverage claim; expected ${shown({ stepNumber: expected.stepNumber, cropDigest: relationMember.cropSha256, elementId: REBOUND_ELEMENT_ID, identificationConfidence: allowedConfidences })}, received ${shown({ stepNumber: row.stepNumber, cropDigest: row.cropDigest, elementId: row.elementId, identificationConfidence: row.identificationConfidence })}. The relation cannot create or replace an element/catalog resolution.`,
    );
  }
  return row;
}

function requireSuppressedReportMember(report, relationMember, expected) {
  const row = requireIndexedReportMember(report, relationMember, expected);
  if (
    row.elementId !== null ||
    row.identificationConfidence !== null ||
    row.resolution !== null ||
    row.unidentifiedBecause !== null
  ) {
    throw new Error(
      `Source-art rebound callout ${expected.identity} is outside the requested prefix and must remain source/index evidence only; received ${shown({ elementId: row.elementId, identificationConfidence: row.identificationConfidence, resolution: row.resolution, unidentifiedBecause: row.unidentifiedBecause })}.`,
    );
  }
  return row;
}

function requireSoleDirectAnchor(pairTruth, members) {
  assertPairJudgedTruthFromParsedJson(pairTruth, "Source-art rebound pair-judged truth");
  const memberCrops = new Set([...members.values()].map(({ cropSha256 }) => cropSha256));
  const relationVerdicts = pairTruth.verdicts.filter(({ judgedCropSha256 }) =>
    memberCrops.has(judgedCropSha256),
  );
  const negatives = relationVerdicts.filter(({ same }) => same === false);
  if (negatives.length > 0) {
    throw new Error(
      `Source-art rebound is blocked by ${negatives.length} direct pair-judged negative relation member(s); a pixel relation cannot override retained counterevidence.`,
    );
  }
  const positives = relationVerdicts.filter(({ same }) => same === true);
  const reference = members.get(REFERENCE.identity);
  if (
    positives.length !== 1 ||
    positives[0].judgedCropSha256 !== reference.cropSha256 ||
    positives[0].elementId !== REBOUND_ELEMENT_ID
  ) {
    throw new Error(
      `Source-art rebound requires exactly one direct same anchor at printed step 4 for element ${REBOUND_ELEMENT_ID}; received ${shown(positives.map(({ judgedCropSha256, elementId }) => ({ judgedCropSha256, elementId })))}. A second anchor, missing anchor, or conflicting element cannot be resolved by relation chaining.`,
    );
  }
}

/**
 * Upgrade only the extant step-2 claim from one verified, direct step-4 anchor.
 *
 * The inspected projection must come from the privately branded verifier in the
 * production compiler. This function never reads element, catalog, placement,
 * or completion authority from the relation: it preserves the existing target
 * resolution byte-for-byte and changes only its evidence-class label.
 */
export function applyVerifiedSourceArtReboundToCoverage({
  report,
  inspectedRebound,
  pairJudgedTruth,
  lastStep,
}) {
  const members = requirePolicyRelation(inspectedRebound);
  if (Math.min(lastStep, 50) < REFERENCE.stepNumber) return report;

  if (report.inputDigests?.sourceArtRebound !== inspectedRebound.artifactSha256) {
    throw new Error(
      `Source-art rebound coverage binds retained role ${shown(report.inputDigests?.sourceArtRebound ?? "missing")}, but the privately verified artifact is ${inspectedRebound.artifactSha256}. A confidence label cannot inherit a different relation's digest.`,
    );
  }

  requireSoleDirectAnchor(pairJudgedTruth, members);
  requireReportMember(report, members.get(REFERENCE.identity), REFERENCE, ["pair-judged-same"]);
  const target = requireReportMember(report, members.get(TARGET.identity), TARGET, [
    "geometry",
    "vision-member-unreviewed",
  ]);
  if (lastStep < PRESERVED.stepNumber) {
    requireSuppressedReportMember(report, members.get(PRESERVED.identity), PRESERVED);
  } else {
    requireReportMember(report, members.get(PRESERVED.identity), PRESERVED, [
      "geometry",
      "vision-kept",
    ]);
  }

  return {
    ...report,
    byCallout: {
      ...report.byCallout,
      [TARGET.identity]: {
        ...target,
        identificationConfidence: SOURCE_ART_REBOUND_CONFIDENCE,
        inputDigest: inspectedRebound.artifactSha256,
      },
    },
  };
}

export const __testOnly = Object.freeze({ POLICY_MEMBERS, REBOUND_ELEMENT_ID });
