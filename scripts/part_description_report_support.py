"""Validated inputs and focused calculations for the description report."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from part_action_ledger_report_contract import require_action_ledger_report_chain
from part_description_retrieval import (
    DescribedQuery,
    DescriptionWeights,
    colour_cost,
    rank_elements,
)
from part_description_truth import interleave, pixel_ranking, recall_table
from part_identification_descriptor_contract import bounded_observed
from part_identification_report_contract import (
    ArtifactContractError,
    read_binary_artifact,
    read_card_images_artifact,
    read_json_artifact,
    read_text_artifact,
    require_adjudication_chain,
    require_coverage_chain,
    require_identification_chain,
    require_truth_v3,
)
from part_identification_report_io import (
    BUILDER_GEOMETRY_EXACT_BYTES,
    MAX_BOOKLET_PDF_BYTES,
)


@dataclass(frozen=True)
class DescriptionReportInputs:
    inventory: dict
    match: dict
    features: dict
    distances: dict
    answers: dict
    truth: dict
    ledger: dict
    official_xml: str
    coverage: dict | None
    pins: dict[str, str]


REQUIRED_JSON = {
    "inventory": "output/part-identification/element-resolution.json",
    "match": "output/part-identification/match.json",
    "features": "output/part-identification/features.json",
    "distances": "output/part-identification/distances.json",
    "cards": "output/part-identification/cards/manifest.json",
    "answers": "output/part-identification/answers-claude-opus-5.json",
    "truth": "scripts/fixtures/part-identification-truth-first50.json",
    "ledger": "output/real-build/action-ledger.json",
    "builderCalibration": "output/real-build/builder-canonical-calibration.json",
    "transitionClassifications": "output/real-build/transition-classifications.json",
    "calloutManifest": "output/callout-thumbnails/manifest.json",
}
OFFICIAL_MODEL = "output/official-model/vx1087034_21066_a.xml"
BOOKLET_PDF = "recipes/6651557.pdf"
BUILDER_GEOMETRY = "output/real-build/builder-shell-geometry.bin"
COVERAGE = "output/real-build/catalog-coverage.json"
MAX_DESCRIPTION_INVENTORY_ELEMENTS = 4_096
MAX_DESCRIPTION_CLUSTERS = 4_000
MAX_DESCRIPTION_RANKING_SORT_ITEMS = 8_000_000
ELEMENT_ID = re.compile(r"^[0-9]{3,12}$")
PART_NUMBER = re.compile(r"^[0-9][0-9a-z]{0,31}$", re.IGNORECASE)
SIGNED_ASCII_INTEGER = re.compile(r"^-?[0-9]+$")


def require_description_report_work_budget(
    inventory: object, match: object, distances: object
) -> dict[str, int]:
    """Validate the full-inventory universe and charge every report ranking sort."""

    if not isinstance(inventory, dict) or not 1 <= len(inventory) <= MAX_DESCRIPTION_INVENTORY_ELEMENTS:
        count = len(inventory) if isinstance(inventory, dict) else type(inventory).__name__
        raise ArtifactContractError(
            "Description-report element resolution must contain 1 through "
            f"{MAX_DESCRIPTION_INVENTORY_ELEMENTS} records; received {count}. Retain the exact "
            "bounded official inventory resolution before ranking."
        )
    required_fields = {"colorId", "name", "partNum", "quantity"}
    for element_id, record in inventory.items():
        if not isinstance(element_id, str) or ELEMENT_ID.fullmatch(element_id) is None:
            raise ArtifactContractError(
                "Description-report element id "
                f"{bounded_observed(element_id)} must contain 3 through 12 ASCII digits."
            )
        if not isinstance(record, dict) or set(record) != required_fields:
            fields = sorted(record) if isinstance(record, dict) else type(record).__name__
            raise ArtifactContractError(
                f"Description-report element resolution {element_id} must contain exactly "
                f"{sorted(required_fields)}; received {bounded_observed(fields)}. Regenerate element-resolution.json "
                "from the pinned official inventory."
            )
        if (
            type(record["quantity"]) is not int
            or not 1 <= record["quantity"] <= 10_000
        ):
            raise ArtifactContractError(
                f"Description-report element resolution {element_id}.quantity must be an integer "
                f"from 1 through 10000; received {bounded_observed(record['quantity'])}."
            )
        if (
            not isinstance(record["partNum"], str)
            or PART_NUMBER.fullmatch(record["partNum"]) is None
        ):
            raise ArtifactContractError(
                f"Description-report element resolution {element_id}.partNum must be a bounded "
                f"published part number; received {bounded_observed(record['partNum'])}."
            )
        if not isinstance(record["name"], str) or not 1 <= len(record["name"]) <= 512:
            raise ArtifactContractError(
                f"Description-report element resolution {element_id}.name must contain 1 through "
                f"512 characters; received length {len(record['name']) if isinstance(record['name'], str) else type(record['name']).__name__}."
            )
        color_id = record["colorId"]
        valid_integer_color = (
            type(color_id) is int and -(2**53 - 1) <= color_id <= 2**53 - 1
        )
        valid_string_color = (
            isinstance(color_id, str)
            and len(color_id) <= 32
            and SIGNED_ASCII_INTEGER.fullmatch(color_id) is not None
        )
        if not valid_integer_color and not valid_string_color:
            raise ArtifactContractError(
                f"Description-report element resolution {element_id}.colorId must be a safe integer "
                f"or at most 32 signed ASCII digits; received {bounded_observed(color_id)}."
            )

    clusters = match.get("clusters") if isinstance(match, dict) else None
    if not isinstance(clusters, list) or len(clusters) > MAX_DESCRIPTION_CLUSTERS:
        count = len(clusters) if isinstance(clusters, list) else type(clusters).__name__
        raise ArtifactContractError(
            f"Description-report match must contain 0 through {MAX_DESCRIPTION_CLUSTERS} clusters "
            f"before ranking; received {count}."
        )
    element_ids = distances.get("elementIds") if isinstance(distances, dict) else None
    if (
        not isinstance(element_ids, list)
        or not 1 <= len(element_ids) <= MAX_DESCRIPTION_INVENTORY_ELEMENTS
        or any(
            not isinstance(element_id, str) or ELEMENT_ID.fullmatch(element_id) is None
            for element_id in element_ids
        )
        or len(set(element_ids)) != len(element_ids)
    ):
        count = len(element_ids) if isinstance(element_ids, list) else type(element_ids).__name__
        raise ArtifactContractError(
            "Description-report distances.elementIds must contain 1 through 4096 unique ASCII "
            f"numeric ids; received {count}."
        )
    missing = sorted(set(element_ids) - set(inventory))
    if missing:
        raise ArtifactContractError(
            "Description-report element resolution must cover every ranked distance element; "
            f"missing {bounded_observed(missing[:20])}."
        )

    cluster_count = len(clusters)
    pixel_elements = len(element_ids)
    full_inventory_elements = len(inventory)
    # Per cached cluster: pixel sort, restricted-description sort, full-inventory
    # description sort, and pixel-colour rerank. Query-less clusters do less work,
    # but charging the full four sorts keeps the bound independent of model output.
    ranking_sort_items = cluster_count * (3 * pixel_elements + full_inventory_elements)
    counts = {
        "clusters": cluster_count,
        "pixelElements": pixel_elements,
        "fullInventoryElements": full_inventory_elements,
        "rankingSortItems": ranking_sort_items,
    }
    if ranking_sort_items > MAX_DESCRIPTION_RANKING_SORT_ITEMS:
        raise ArtifactContractError(
            f"Description report would sort {ranking_sort_items} ranking items across cached "
            f"cluster rankings; the bounded maximum is {MAX_DESCRIPTION_RANKING_SORT_ITEMS}. "
            f"Breakdown: {counts}. Reduce the authenticated inventory or split the measurement."
        )
    return counts


def _json_artifact(path: Path, label: str) -> tuple[object, str]:
    try:
        return read_json_artifact(path, label)
    except ArtifactContractError as error:
        raise SystemExit(f"could not read the description-report input closure: {error}") from error


def _text_artifact(path: Path, label: str) -> tuple[str, str]:
    try:
        return read_text_artifact(path, label)
    except ArtifactContractError as error:
        raise SystemExit(f"could not read the description-report input closure: {error}") from error


def load_description_inputs(repository_root: Path) -> DescriptionReportInputs:
    """Read and require one exact report closure before any score is computed."""

    paths = {name: repository_root / relative for name, relative in REQUIRED_JSON.items()}
    artifacts = {
        name: _json_artifact(path, f"Description-report {name}")
        for name, path in paths.items()
    }
    values = {name: artifact[0] for name, artifact in artifacts.items()}
    official_path = repository_root / OFFICIAL_MODEL
    official_xml, official_digest = _text_artifact(
        official_path, "Description-report official model"
    )
    _, booklet_pdf_digest = read_binary_artifact(
        repository_root / BOOKLET_PDF,
        "Description-report instruction booklet",
        max_bytes=MAX_BOOKLET_PDF_BYTES,
    )
    _, builder_geometry_digest = read_binary_artifact(
        repository_root / BUILDER_GEOMETRY,
        "Description-report Builder shell geometry",
        max_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
        exact_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
    )
    coverage_path = repository_root / COVERAGE
    coverage_artifact = (
        _json_artifact(coverage_path, "Description-report coverage")
        if coverage_path.is_file()
        else None
    )
    coverage = None if coverage_artifact is None else coverage_artifact[0]

    pins = {
        relative: artifacts[name][1] for name, relative in REQUIRED_JSON.items()
    }
    pins[OFFICIAL_MODEL] = official_digest
    pins[BOOKLET_PDF] = booklet_pdf_digest
    pins[BUILDER_GEOMETRY] = builder_geometry_digest
    if coverage_artifact is not None:
        pins[COVERAGE] = coverage_artifact[1]

    try:
        require_description_report_work_budget(
            values["inventory"], values["match"], values["distances"]
        )
        require_identification_chain(
            values["features"],
            values["match"],
            values["distances"],
            features_digest=pins[REQUIRED_JSON["features"]],
            match_digest=pins[REQUIRED_JSON["match"]],
            distances_digest=pins[REQUIRED_JSON["distances"]],
            callout_manifest_digest=pins[REQUIRED_JSON["calloutManifest"]],
        )
        require_truth_v3(values["truth"])
        require_adjudication_chain(
            values["cards"],
            values["answers"],
            features_digest=pins[REQUIRED_JSON["features"]],
            match_digest=pins[REQUIRED_JSON["match"]],
            cards_digest=pins[REQUIRED_JSON["cards"]],
        )
        card_images_path, card_images_digest = read_card_images_artifact(
            paths["cards"].parent, values["cards"]
        )
        card_images_role = card_images_path.relative_to(repository_root).as_posix()
        pins[card_images_role] = card_images_digest
        if coverage is not None:
            require_coverage_chain(
                coverage,
                coverage_digest=pins[COVERAGE],
                features_digest=pins[REQUIRED_JSON["features"]],
                match_digest=pins[REQUIRED_JSON["match"]],
                distances_digest=pins[REQUIRED_JSON["distances"]],
                element_resolution_digest=pins[REQUIRED_JSON["inventory"]],
                consumed_role_digests={
                    "pdf": values["features"]["inputDigests"]["pdf"],
                    "calloutManifest": pins[REQUIRED_JSON["calloutManifest"]],
                    "cards": pins[REQUIRED_JSON["cards"]],
                    "cardImages": card_images_digest,
                    "answers": pins[REQUIRED_JSON["answers"]],
                    "pairJudged": pins[REQUIRED_JSON["truth"]],
                },
            )
            require_action_ledger_report_chain(
                values["ledger"],
                ledger_digest=pins[REQUIRED_JSON["ledger"]],
                coverage=coverage,
                coverage_digest=pins[COVERAGE],
                features=values["features"],
                features_digest=pins[REQUIRED_JSON["features"]],
                callout_manifest_digest=pins[REQUIRED_JSON["calloutManifest"]],
                official_model_text=official_xml,
                official_model_digest=official_digest,
                builder_calibration_digest=pins[REQUIRED_JSON["builderCalibration"]],
                transition_classifications_digest=pins[
                    REQUIRED_JSON["transitionClassifications"]
                ],
                booklet_pdf_digest=pins[BOOKLET_PDF],
                builder_geometry_digest=pins[BUILDER_GEOMETRY],
            )
        else:
            raise ArtifactContractError(
                f"Description-report coverage is absent at {COVERAGE}; accepted action pieces "
                "cannot become Builder truth without their exact compiler-derived coverage claims."
            )
    except ArtifactContractError as error:
        raise SystemExit(
            f"could not verify the description-report input closure: {error}"
        ) from error

    return DescriptionReportInputs(
        inventory=values["inventory"],
        match=values["match"],
        features=values["features"],
        distances=values["distances"],
        answers=values["answers"],
        truth=values["truth"],
        ledger=values["ledger"],
        official_xml=official_xml,
        coverage=coverage,
        pins=pins,
    )


def describe_answer(answer: object) -> DescribedQuery | None:
    """One answers row as a described query, or None when there is no row."""

    return DescribedQuery.from_answer(answer) if isinstance(answer, dict) else None


def ranking_bundle(
    index: int,
    query: DescribedQuery | None,
    *,
    distances: dict,
    survivors: dict[int, frozenset[str]],
    pixel_universe: frozenset[str],
    parsed: dict,
) -> dict:
    """Every ranking compared by the report for one cluster."""

    pixel = pixel_ranking(distances, index)
    surviving = survivors.get(index, frozenset()) & pixel_universe
    description = (
        rank_elements(query, parsed, DescriptionWeights(), restrict_to=pixel_universe)
        if query is not None
        else []
    )
    description_full = rank_elements(query, parsed, DescriptionWeights()) if query else []
    colour_reranked = sorted(
        pixel,
        key=lambda row: colour_cost(
            None if query is None else query.colour,
            parsed[row[0]].colour if row[0] in parsed else None,
        ),
    )
    return {
        "pixel": pixel,
        "pixelPlusDepletion": [row for row in pixel if row[0] in surviving],
        "description": description,
        "descriptionFullInventory": description_full,
        "descriptionPlusDepletion": [row for row in description if row[0] in surviving],
        "interleaved": interleave(pixel, description),
        "pixelColourReranked": colour_reranked,
        "survivors": surviving,
    }


def recall_tables(subset: list[dict]) -> dict:
    """All report columns over one truth subset."""

    return {
        "pixel": recall_table([row["pixelRank"] for row in subset]),
        "pixelPlusDepletion": recall_table([row["pixelPlusDepletionRank"] for row in subset]),
        "description": recall_table([row["descriptionRank"] for row in subset]),
        "descriptionOptimisticTies": recall_table(
            [row["descriptionRankOptimistic"] for row in subset]
        ),
        "descriptionOverFullInventory": recall_table(
            [row["descriptionRankFullInventory"] for row in subset]
        ),
        "descriptionPlusDepletion": recall_table(
            [row["descriptionPlusDepletionRank"] for row in subset]
        ),
        "interleavedPixelAndDescription": recall_table(
            [row["interleavedRank"] for row in subset]
        ),
        "pixelColourReranked": recall_table(
            [row["pixelColourRerankedRank"] for row in subset]
        ),
        "pixelMouldOnly": recall_table([row["pixelMouldRank"] for row in subset]),
        "descriptionMouldOnly": recall_table(
            [row["descriptionMouldRank"] for row in subset]
        ),
    }


STATIC_MEASUREMENT_LIMITS = {
    "theDescriptionColumnIsModelOutput": (
        "The pixel ranking is deterministic and needs no model call. The description "
        "ranking is derived from provider output, which this repository treats as "
        "untrusted data: it cannot declare itself valid and it varies between runs. A "
        "fused shortlist therefore changes the trust shape of retrieval as well as its "
        "recall -- half the candidates would come from a source that has to be re-earned "
        "on every republication, and the recall figures here describe one generation of "
        "that source. Read recall@6 = 1.000 as 'these two rankings are complementary on "
        "the labels we have', not as 'retrieval is solved'."
    ),
    "descriptionsWereProducedWhileSeeingSixCandidates": (
        "Every description read here came from the shipping prompt, which shows the "
        "query and six pixel-selected candidates before asking for the description. A "
        "description could in principle be pulled toward what was on offer. The two "
        "cases that matter most argue against that here: for the green Plate 2 x 4 and "
        "the green Plate 2 x 10 the call said Green while no green element was on its "
        "shortlist at all."
    ),
}


def _step_ranges(step_numbers: list[int]) -> str:
    ranges: list[str] = []
    start = end = None
    for step_number in step_numbers:
        if start is None:
            start = end = step_number
        elif step_number == end + 1:
            end = step_number
        else:
            ranges.append(str(start) if start == end else f"{start}-{end}")
            start = end = step_number
    if start is not None:
        ranges.append(str(start) if start == end else f"{start}-{end}")
    if not ranges:
        return "none"
    if len(ranges) == 1:
        return ranges[0]
    if len(ranges) == 2:
        return f"{ranges[0]} and {ranges[1]}"
    return f"{', '.join(ranges[:-1])}, and {ranges[-1]}"


def builder_selection_bias_note() -> str:
    return (
        "The 82 pair-judged verdicts were judged against the claims the pixel "
        "descriptor's own one-to-one assignment produced, so a 'same' verdict is by "
        "construction an element the pixel route had already proposed. That subset "
        "measures the pixel descriptor on the cases where it agreed with a judge, not "
        "on a sample of the booklet, and it favours the pixel route. The Builder export "
        "does not have this shape: accepted action.pieces bind official identities, its "
        "colour half never consults any claim, and refusals remain counterevidence rather "
        "than positive labels."
    )


def measurement_limits(builder_clusters: int, total_clusters: int, ledger: dict) -> dict:
    """Static limits plus exact accepted-step coverage from this ledger generation."""

    ledger_steps = [
        step["stepNumber"]
        for step in ledger.get("steps", [])
        if isinstance(step, dict) and type(step.get("stepNumber")) is int
    ]
    accepted_steps = sorted(
        step["stepNumber"]
        for step in ledger.get("steps", [])
        if isinstance(step, dict)
        and type(step.get("stepNumber")) is int
        and isinstance(step.get("action"), dict)
        and isinstance(step["action"].get("pieces"), list)
        and len(step["action"]["pieces"]) > 0
    )
    accepted_set = set(accepted_steps)
    gaps = sorted(step_number for step_number in ledger_steps if step_number not in accepted_set)

    return {
        "builderAcceptedPrintedSteps": accepted_steps,
        "builderAcceptedStepRanges": _step_ranges(accepted_steps),
        "builderStepsWithoutAcceptedPieces": gaps,
        "unbiasedTruthCoversOnlyThePrintedPrefix": (
            f"The Builder export is the only unbiased source here and it reaches "
            f"{builder_clusters} of {total_clusters} clusters through accepted action.pieces "
            f"at printed steps {_step_ranges(accepted_steps)} in this exact ledger. "
            f"Its {len(gaps)} other retained step(s) ({_step_ranges(gaps)}) carry no accepted "
            f"piece truth; omissions and refusals remain counterevidence rather than positive "
            f"labels. Nothing else measures the other clusters against an independent label; the "
            f"pair-judged subset that does reach further is conditioned on the pixel route "
            f"having already proposed the element."
        ),
        **STATIC_MEASUREMENT_LIMITS,
    }
