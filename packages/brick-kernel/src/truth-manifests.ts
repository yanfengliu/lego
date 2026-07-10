export const MAX_COLLISION_COMPARISONS = 50_000 as const;
export const MAX_COLLISION_FINDINGS = 5_000 as const;
export const MAX_EVIDENCE_IDS_PER_ISSUE = 256 as const;
export const MAX_VALIDATION_ISSUES = 10_000 as const;
export const VALIDATOR_SET_VERSION = "lego.kernel-validators/1" as const;

/**
 * Reviewed, deterministic inputs for the validator-set truth snapshot.
 * Any behavioral validator or hard-limit change must update this manifest.
 */
export const VALIDATOR_SET_DIGEST_INPUT = Object.freeze({
  schemaVersion: "lego.validator-set-manifest/1",
  validatorSetVersion: VALIDATOR_SET_VERSION,
  rules: Object.freeze([
    "protocol-schema-closed-and-bounded",
    "truth-snapshot-exact-match",
    "stable-identifiers-unique",
    "build-step-indices-unique",
    "document-part-budget",
    "catalog-part-and-color-allowlists",
    "catalog-allowlist-entries-canonical-and-known",
    "catalog-legal-orientations",
    "submodel-step-and-semantic-membership",
    "connection-part-and-port-existence",
    "connection-stud-clutch-compatibility",
    "connection-transform-coincidence-and-opposition",
    "connection-port-capacity-one",
    "single-connected-component",
    "catalog-body-and-stud-collision-primitives",
    "validated-connection-collision-allowances-only",
    "validation-evidence-and-issue-bounds",
  ]),
  limits: Object.freeze({
    maxCollisionComparisons: MAX_COLLISION_COMPARISONS,
    maxCollisionFindings: MAX_COLLISION_FINDINGS,
    maxEvidenceIdsPerIssue: MAX_EVIDENCE_IDS_PER_ISSUE,
    maxValidationIssues: MAX_VALIDATION_ISSUES,
  }),
});
