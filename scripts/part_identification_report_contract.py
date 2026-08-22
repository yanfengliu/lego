"""Authenticate bounded Python report inputs through canonical JavaScript replay."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping

from part_identification_descriptor_contract import bounded_observed, require_features_v3_descriptors
from part_identification_coverage_contract import require_coverage_chain
from part_identification_report_io import (
    ArtifactContractError,
    read_bounded_bytes,
)
from part_identification_verification_bridge import (
    read_binary_artifact,
    read_card_images_artifact,
    read_json_artifact,
    read_text_artifact,
    verify_adjudication,
    verify_identification,
    verify_score_summary,
)
from part_identification_truth_contract import (
    MAX_SAFE_INTEGER,
    MAX_TRUTH_ROWS,
    MAX_TRUTH_TEXT,
    RATER_CONFIDENCE,
    TRUTH_RATERS_FIELDS,
    TRUTH_TOP_LEVEL_FIELDS,
    TRUTH_UNJUDGEABLE_FIELDS,
    TRUTH_VERDICT_FIELDS,
)


FEATURES_SCHEMA = "lego.part-identification-features/3"
MATCH_SCHEMA = "lego.part-identification-match/3"
DISTANCES_SCHEMA = "lego.part-identification-distances/3"
CARDS_SCHEMA = "lego.part-identification-cards/4"
ANSWERS_SCHEMA = "lego.part-identification-answers/5"
SCORE_SCHEMA = "lego.part-identification-score/2"
SCORE_SUMMARY_SCHEMA = "lego.part-identification-score-summary/2"
TRUTH_SCHEMA = "lego.part-identification-truth/3"

SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
ELEMENT_ID = re.compile(r"^[0-9]{3,12}$")


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ArtifactContractError(f"{label} must be a JSON object, received {type(value).__name__}.")
    return value


def _schema(value: Mapping, expected: str, label: str) -> None:
    observed = value.get("schemaVersion")
    if observed != expected:
        raise ArtifactContractError(
            f"{label} declares schema {bounded_observed(observed)}; this report requires {expected}. "
            "Restore one complete retained generation rather than mixing migrations."
        )


def _digest(value: object, label: str) -> str:
    if not isinstance(value, str) or SHA256.fullmatch(value) is None:
        raise ArtifactContractError(
            f"{label} must be one exact lowercase SHA-256 digest; received {bounded_observed(value)}."
        )
    return value


def require_identification_chain(
    features: object,
    match: object,
    distances: object,
    *,
    features_digest: str,
    match_digest: str,
    distances_digest: str,
    callout_manifest_digest: str | None = None,
) -> None:
    """Require features/3 -> match/3 -> distances/3 over the bytes read."""

    features_value = _mapping(features, "Part-identification features")
    match_value = _mapping(match, "Part-identification match")
    distances_value = _mapping(distances, "Part-identification distances")
    _schema(features_value, FEATURES_SCHEMA, "Part-identification features")
    _schema(match_value, MATCH_SCHEMA, "Part-identification match")
    _schema(distances_value, DISTANCES_SCHEMA, "Part-identification distances")
    inventory_ids = require_features_v3_descriptors(features_value)
    if callout_manifest_digest is not None:
        source_inputs = _mapping(
            features_value.get("inputDigests"), "Features/3 source inputDigests"
        )
        observed_manifest = _digest(
            source_inputs.get("calloutManifest"), "Features/3 callout-manifest digest"
        )
        _digest(source_inputs.get("pdf"), "Features/3 PDF digest")
        actual_manifest = _digest(callout_manifest_digest, "Callout-manifest byte digest")
        if observed_manifest != actual_manifest:
            raise ArtifactContractError(
                f"Features/3 binds callout manifest {observed_manifest}, but the retained manifest bytes hash "
                f"to {actual_manifest}. Regenerate features from that exact manifest."
            )
    features_digest = _digest(features_digest, "Features byte digest")
    match_digest = _digest(match_digest, "Match byte digest")
    distances_digest = _digest(distances_digest, "Distances byte digest")
    if match_value.get("featuresDigest") != features_digest:
        raise ArtifactContractError(
            f"Match binds features {bounded_observed(match_value.get('featuresDigest'))}, but the retained features bytes hash to "
            f"{features_digest}. The chain is mid-republication."
        )
    if distances_value.get("featuresDigest") != features_digest:
        raise ArtifactContractError(
            f"Distances bind features {bounded_observed(distances_value.get('featuresDigest'))}, but the retained features bytes "
            f"hash to {features_digest}. The chain is mid-republication."
        )
    if distances_value.get("matchDigest") != match_digest:
        raise ArtifactContractError(
            f"Distances bind match {bounded_observed(distances_value.get('matchDigest'))}, but the retained match bytes hash to "
            f"{match_digest}. Regenerate distances from that exact match."
        )
    clusters = match_value.get("clusters")
    rows = distances_value.get("rows")
    element_ids = distances_value.get("elementIds")
    if (
        not isinstance(clusters, list)
        or len(clusters) > MAX_TRUTH_ROWS
        or not isinstance(rows, list)
        or len(rows) != len(clusters)
    ):
        raise ArtifactContractError(
            "Match clusters and distance rows must be bounded arrays of the same length; a partial or unbounded "
            "matrix cannot be scored."
        )
    if (
        not isinstance(element_ids, list)
        or not 1 <= len(element_ids) <= 4_096
        or any(not isinstance(element, str) or ELEMENT_ID.fullmatch(element) is None for element in element_ids)
        or len(set(element_ids)) != len(element_ids)
        or element_ids != sorted(element_ids)
    ):
        raise ArtifactContractError(
            "Distances must retain 1 through 4096 unique canonical numeric elementIds."
        )
    if set(element_ids) != set(inventory_ids):
        raise ArtifactContractError(
            "Distances elementIds must name exactly every validated features/3 inventory descriptor."
        )
    if any(
        not isinstance(row, list)
        or len(row) != len(element_ids)
        or any(
            not isinstance(distance, (int, float))
            or isinstance(distance, bool)
            or not math.isfinite(distance)
            for distance in row
        )
        for row in rows
    ):
        raise ArtifactContractError(
            "Every distance row must cover the complete canonical elementIds array with finite numbers; a partial "
            "or non-finite row cannot be scored."
        )
    verify_identification(
        features,
        match,
        distances,
        features_digest=features_digest,
        match_digest=match_digest,
        distances_digest=distances_digest,
    )


def require_truth_v3(truth: object) -> None:
    """Require exact full crop+element truth, including unjudgeable rows."""

    value = _mapping(truth, "Pair-judged truth")
    _schema(value, TRUTH_SCHEMA, "Pair-judged truth")
    unexpected_top_level = sorted(set(value) - TRUTH_TOP_LEVEL_FIELDS)
    if unexpected_top_level:
        raise ArtifactContractError(
            f"Truth/3 carries unsupported top-level fields {unexpected_top_level}; detached fields cannot "
            "influence a report consumer."
        )
    verdicts = value.get("verdicts")
    unjudgeable = value.get("unjudgeable")
    if not isinstance(verdicts, list) or not isinstance(unjudgeable, list):
        raise ArtifactContractError("Truth/3 must retain verdicts and unjudgeable arrays.")
    last_step = value.get("lastStep")
    if (
        not isinstance(last_step, int)
        or isinstance(last_step, bool)
        or last_step < 1
        or last_step > 359
    ):
        raise ArtifactContractError(
            "Truth/3 lastStep must be a printed step from 1 through 359; received "
            f"{bounded_observed(last_step)}."
        )
    judged_count = value.get("pairsJudged")
    unjudgeable_count = value.get("pairsUnjudgeable")
    if (
        not isinstance(judged_count, int)
        or isinstance(judged_count, bool)
        or judged_count < 0
        or not isinstance(unjudgeable_count, int)
        or isinstance(unjudgeable_count, bool)
        or unjudgeable_count < 0
        or judged_count != len(verdicts)
        or unjudgeable_count != len(unjudgeable)
    ):
        raise ArtifactContractError(
            "Truth/3 pair counts must equal the retained verdict and unjudgeable arrays; missing rows are evidence loss."
        )
    total_rows = len(verdicts) + len(unjudgeable)
    if total_rows > MAX_TRUTH_ROWS:
        raise ArtifactContractError(
            f"Truth/3 carries {total_rows} pair-sheet rows; the bounded maximum is {MAX_TRUTH_ROWS}."
        )
    for field in ("note", "method", "judgedBy", "keyNote"):
        text = value.get(field)
        if text is not None and (not isinstance(text, str) or len(text) > MAX_TRUTH_TEXT):
            raise ArtifactContractError(
                f"Truth/3 {field} must be text of at most {MAX_TRUTH_TEXT} characters when present."
            )
    source = value.get("source")
    if source is not None and source not in {"deterministic", "adjudicated"}:
        raise ArtifactContractError(
            "Truth/3 source must be deterministic or adjudicated when present; received "
            f"{bounded_observed(source)}."
        )
    assignment = value.get("assignment")
    if assignment is not None and assignment not in {
        "nearest",
        "one-to-one",
        "quantity-informed",
    }:
        raise ArtifactContractError(
            "Truth/3 assignment must be nearest, one-to-one, or quantity-informed when present; "
            f"received {bounded_observed(assignment)}."
        )
    raters = value.get("raters")
    if raters is not None:
        rater_metadata = _mapping(raters, "Truth/3 raters")
        if set(rater_metadata) != TRUTH_RATERS_FIELDS:
            raise ArtifactContractError(
                f"Truth/3 raters must contain exactly {sorted(TRUTH_RATERS_FIELDS)}; received "
                f"{sorted(rater_metadata)}."
            )
        agreement = rater_metadata.get("agreement")
        agreement_match = (
            re.fullmatch(r"([0-9]{1,4})/([0-9]{1,4})", agreement)
            if isinstance(agreement, str)
            else None
        )
        agreed_count = int(agreement_match.group(1)) if agreement_match else -1
        reviewed_count = int(agreement_match.group(2)) if agreement_match else -1
        primary = rater_metadata.get("primary")
        secondary = rater_metadata.get("secondary")
        adjudicated = rater_metadata.get("descriptionDivergenceAdjudicated")
        adjudication_note = rater_metadata.get("adjudicationNote")
        if (
            agreement_match is None
            or agreed_count > reviewed_count
            or reviewed_count != total_rows
            or not isinstance(primary, str)
            or not 1 <= len(primary) <= 200
            or not isinstance(secondary, str)
            or not 1 <= len(secondary) <= 200
            or primary == secondary
            or not isinstance(adjudicated, list)
            or len(adjudicated) > total_rows
            or any(
                not isinstance(ordinal, int)
                or isinstance(ordinal, bool)
                or ordinal < 1
                or ordinal > total_rows
                or (position > 0 and ordinal <= adjudicated[position - 1])
                for position, ordinal in enumerate(adjudicated)
            )
            or not isinstance(adjudication_note, str)
            or len(adjudication_note) < 1
            or len(adjudication_note) > MAX_TRUTH_TEXT
        ):
            raise ArtifactContractError(
                "Truth/3 raters must retain distinct bounded primary/secondary names, an agreed/reviewed count "
                "covering every row, strictly increasing in-range adjudicated ordinals, and a non-empty bounded "
                "adjudication note."
            )
    seen_keys: set[tuple[str, str | None]] = set()
    seen_ordinals: set[int] = set()
    for position, verdict in enumerate(verdicts):
        row = _mapping(verdict, f"Truth verdict at position {position}")
        unexpected = sorted(set(row) - TRUTH_VERDICT_FIELDS)
        if unexpected:
            raise ArtifactContractError(
                f"Truth verdict at position {position} carries unsupported fields {unexpected}."
            )
        digest = row.get("judgedCropSha256")
        element = row.get("elementId")
        ordinal = row.get("n")
        if not isinstance(digest, str) or SHA256.fullmatch(digest) is None:
            raise ArtifactContractError(
                f"Truth verdict at position {position} must name the exact full judged crop SHA-256; received {bounded_observed(digest)}."
            )
        if not isinstance(element, str) or ELEMENT_ID.fullmatch(element) is None:
            raise ArtifactContractError(
                f"Truth verdict at position {position} must name its claimed element; received {bounded_observed(element)}."
            )
        if type(row.get("same")) is not bool:
            raise ArtifactContractError(f"Truth verdict at position {position} must declare same as a boolean.")
        if (
            not isinstance(ordinal, int)
            or isinstance(ordinal, bool)
            or ordinal < 1
            or ordinal > MAX_TRUTH_ROWS
        ):
            raise ArtifactContractError(
                f"Truth verdict at position {position} has invalid pair ordinal {bounded_observed(ordinal)}."
            )
        note = row.get("note")
        if note is not None and (not isinstance(note, str) or len(note) > MAX_TRUTH_TEXT):
            raise ArtifactContractError(
                f"Truth verdict at position {position} note must be at most {MAX_TRUTH_TEXT} characters."
            )
        confidence = row.get("raterConfidence")
        if confidence is not None:
            confidence_value = _mapping(
                confidence, f"Truth verdict at position {position} raterConfidence"
            )
            if set(confidence_value) != {"primary", "secondary"} or any(
                confidence_value.get(rater) not in RATER_CONFIDENCE
                for rater in ("primary", "secondary")
            ):
                raise ArtifactContractError(
                    f"Truth verdict at position {position} raterConfidence must contain exactly "
                    "primary and secondary, each low, medium, or high."
                )
        key = (digest, element)
        if key in seen_keys or ordinal in seen_ordinals:
            raise ArtifactContractError(
                f"Truth/3 repeats crop+element key {bounded_observed(key)} or pair ordinal {ordinal}; file order cannot choose trust."
            )
        seen_keys.add(key)
        seen_ordinals.add(ordinal)
    for position, entry in enumerate(unjudgeable):
        row = _mapping(entry, f"Unjudgeable truth row at position {position}")
        if set(row) != TRUTH_UNJUDGEABLE_FIELDS:
            raise ArtifactContractError(
                f"Unjudgeable truth row at position {position} must contain exactly "
                f"{sorted(TRUTH_UNJUDGEABLE_FIELDS)}; received {sorted(row)}."
            )
        digest = row.get("judgedCropSha256")
        ordinal = row.get("n")
        if (
            not isinstance(digest, str)
            or SHA256.fullmatch(digest) is None
            or row.get("elementId") is not None
            or not isinstance(row.get("reason"), str)
            or len(row["reason"]) < 1
            or len(row["reason"]) > MAX_TRUTH_TEXT
            or not isinstance(ordinal, int)
            or isinstance(ordinal, bool)
            or ordinal < 1
            or ordinal > MAX_TRUTH_ROWS
            or not isinstance(row.get("callouts"), int)
            or isinstance(row.get("callouts"), bool)
            or row["callouts"] < 1
            or row["callouts"] > MAX_SAFE_INTEGER
            or not isinstance(row.get("pieces"), int)
            or isinstance(row.get("pieces"), bool)
            or row["pieces"] < 1
            or row["pieces"] > MAX_SAFE_INTEGER
        ):
            raise ArtifactContractError(
                f"Unjudgeable truth row at position {position} must retain an exact crop, null element, bounded "
                "reason, positive safe callout/piece counts, and bounded ordinal; received "
                f"{bounded_observed(dict(row))}."
            )
        key = (digest, None)
        if key in seen_keys or ordinal in seen_ordinals:
            raise ArtifactContractError(
                f"Truth/3 repeats unjudgeable crop {digest} or pair ordinal {ordinal}; every sheet row is unique."
            )
        seen_keys.add(key)
        seen_ordinals.add(ordinal)
    expected_ordinals = set(range(1, total_rows + 1))
    if seen_ordinals != expected_ordinals:
        raise ArtifactContractError(
            f"Truth/3 pair-sheet ordinals must cover 1 through {total_rows} exactly; received "
            f"{sorted(seen_ordinals)}."
        )


def require_score_summary_chain(score: object, *, digests: Mapping[str, str]) -> None:
    """Require summary/2, its score/2 headline, and every shared digest edge."""

    value = _mapping(score, "Part-identification score summary")
    _schema(value, SCORE_SUMMARY_SCHEMA, "Part-identification score summary")
    inputs = _mapping(value.get("inputs"), "Score summary inputs")
    shared = _mapping(inputs.get("inputDigests"), "Score summary shared inputDigests")
    headline = _mapping(value.get("headline"), "Score summary headline")
    _schema(headline, SCORE_SCHEMA, "Score summary headline")
    headline_bindings = _mapping(headline.get("inputDigests"), "Score headline inputDigests")

    shared_roles = (
        "features",
        "match",
        "distances",
        "inventoryLabels",
        "elementResolution",
        "truthFirstFifty",
    )
    for role in shared_roles:
        observed = _digest(shared.get(role), f"Score summary shared {role} digest")
        if role in digests and observed != _digest(digests[role], f"{role} byte digest"):
            raise ArtifactContractError(
                f"Score summary binds {role} {observed}, but the retained bytes hash to {digests[role]}. "
                "Do not compare variants from another generation."
            )
        if headline_bindings.get(role) != observed:
            raise ArtifactContractError(
                f"Score headline binds {role} {bounded_observed(headline_bindings.get(role))}, but its summary binds {observed}. "
                "The headline and variants must come from one shared generation."
            )
    for role in ("cards", "cardImages", "answers"):
        actual = _digest(digests.get(role), f"{role} byte digest")
        if headline_bindings.get(role) != actual:
            raise ArtifactContractError(
                f"Score headline binds {role} {bounded_observed(headline_bindings.get(role))}, but the retained bytes hash to "
                f"{actual}. Restore the headline's exact adjudication artifacts."
            )

    variants = value.get("variants")
    if not isinstance(variants, list) or not variants:
        raise ArtifactContractError("Score summary/2 must retain at least one scored variant.")
    for position, variant in enumerate(variants):
        row = _mapping(variant, f"Score summary variant at position {position}")
        bindings = _mapping(
            row.get("inputDigests"), f"Score summary variant {position} inputDigests"
        )
        for role in shared_roles:
            if bindings.get(role) != shared[role]:
                raise ArtifactContractError(
                    f"Score summary variant {position} binds shared {role} {bounded_observed(bindings.get(role))}, but the "
                    f"summary binds {shared[role]}. Mixed variants cannot support one retrieval report."
                )
        for role, bound_digest in bindings.items():
            _digest(bound_digest, f"Score summary variant {position} {role} digest")
    verify_score_summary(value, digests=dict(digests))


def require_adjudication_chain(
    cards: object,
    answers: object,
    *,
    features_digest: str,
    match_digest: str,
    cards_digest: str,
) -> None:
    """Require cards/4 and replay-verified answers/5 to bind the exact match generation."""

    cards_value = _mapping(cards, "Part-identification cards")
    answers_value = _mapping(answers, "Part-identification answers")
    _schema(cards_value, CARDS_SCHEMA, "Part-identification cards")
    _schema(answers_value, ANSWERS_SCHEMA, "Part-identification answers")
    features_digest = _digest(features_digest, "Features byte digest")
    match_digest = _digest(match_digest, "Match byte digest")
    cards_digest = _digest(cards_digest, "Cards byte digest")
    run_id = cards_value.get("runId")
    if (
        not isinstance(run_id, str)
        or re.fullmatch(r"[0-9a-f]{24}", run_id) is None
        or cards_value.get("imagesFile") != f"runs/{run_id}/images.bin"
    ):
        raise ArtifactContractError(
            "Cards/4 must bind one canonical runs/<24 lowercase hex>/images.bin bundle."
        )
    expected = {
        "cards.featuresDigest": (cards_value.get("featuresDigest"), features_digest),
        "cards.matchDigest": (cards_value.get("matchDigest"), match_digest),
        "answers.matchDigest": (answers_value.get("matchDigest"), match_digest),
        "answers.cardsDigest": (answers_value.get("cardsDigest"), cards_digest),
    }
    for label, (observed, required) in expected.items():
        if observed != required:
            raise ArtifactContractError(
                f"{label} is {bounded_observed(observed)}, but the exact retained role requires {required}. "
                "Regenerate cards and answers from one match."
            )
    verify_adjudication(
        cards,
        answers,
        features_digest=features_digest,
        match_digest=match_digest,
        cards_digest=cards_digest,
    )
