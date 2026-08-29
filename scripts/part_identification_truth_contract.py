"""Bounded field declarations for exact pair-judged truth/3."""


MAX_TRUTH_ROWS = 4_000
MAX_TRUTH_TEXT = 2_000
MAX_SAFE_INTEGER = (1 << 53) - 1
RATER_CONFIDENCE = frozenset({"low", "medium", "high"})
TRUTH_TOP_LEVEL_FIELDS = frozenset(
    {
        "schemaVersion",
        "note",
        "method",
        "judgedBy",
        "raters",
        "lastStep",
        "source",
        "assignment",
        "pairsJudged",
        "pairsUnjudgeable",
        "verdicts",
        "unjudgeable",
        "keyNote",
    }
)
TRUTH_VERDICT_FIELDS = frozenset(
    {"n", "judgedCropSha256", "elementId", "same", "note", "raterConfidence"}
)
TRUTH_UNJUDGEABLE_FIELDS = frozenset(
    {"n", "judgedCropSha256", "elementId", "reason", "callouts", "pieces"}
)
TRUTH_RATERS_FIELDS = frozenset(
    {
        "agreement",
        "primary",
        "secondary",
        "descriptionDivergenceAdjudicated",
        "adjudicationNote",
    }
)
