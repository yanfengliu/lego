"""Run the depletion walk over the published booklet artifacts and score it.

Reads only. It opens the retained identification and coverage artifacts, hands
their plain data to `booklet_depletion_walk`, and writes one report to
`output/booklet-depletion-walk.json` with the digest of every input beside every
number, so a later reader can tell whether a figure came from the artifacts they
are looking at.

It does not admit a part, does not touch the catalog, does not rewrite an
identification artifact, and does not override a pair-judged verdict. The two
refused callouts at printed steps 5 and 7 stay refused; what this produces for
them is a narrowed candidate list and the evidence behind it, which is a
different claim from a verdict.

    python -B scripts/booklet_depletion_report.py
    python -B scripts/booklet_depletion_report.py --coverage <path>   # any retained coverage

The second form is how the method is tested against ground truth: the retained
pre-fix coverage under `output/real-build/history/` still carries the four
mis-read multiplier labels as part art, so walking it says whether the walk
would have found them.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
from dataclasses import asdict
from pathlib import Path

from booklet_depletion_walk import (
    Claim,
    Cluster,
    consumed_before,
    infeasible_clusters,
    narrow_cluster,
    narrowing_score,
    walk_inventory,
)

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
INVENTORY = REPOSITORY_ROOT / "output/part-identification/element-resolution.json"
MATCH = REPOSITORY_ROOT / "output/part-identification/match.json"
DISTANCES = REPOSITORY_ROOT / "output/part-identification/distances.json"
FEATURES = REPOSITORY_ROOT / "output/part-identification/features.json"
COVERAGE = REPOSITORY_ROOT / "output/real-build/catalog-coverage.json"
REPORT = REPOSITORY_ROOT / "output/booklet-depletion-walk.json"

SCHEMA_VERSION = "lego.booklet-depletion-walk/1"

# The two callouts blind pair judging refused. They are named here so the report
# always carries their narrowed candidate set, and never so anything overrides
# the refusal: this file only ever reads their claim.
REFUSED_CALLOUTS = ("p12|q1|x108.829|y453.870", "p13|q1|x83.311|y434.390")

# Ground truth, resolved by a hand read of the printed pages: four labels the
# publication once classified as part art are repeat multipliers, and the two
# pieces each claimed were never in the set. They are preregistered here so the
# walk can be scored against a known answer rather than against its own output.
# Walking the retained pre-fix coverage under output/real-build/history/ is the
# test; walking the current coverage should find them absent.
KNOWN_MISREAD_MULTIPLIER_LABELS = (
    "p59|q2|x124.683|y55.056",
    "p85|q2|x662.244|y445.465",
    "p96|q2|x125.941|y478.298",
    "p109|q2|x723.002|y319.540",
)


def read_json(path: Path) -> tuple[dict, str]:
    """The artifact and its digest, or a refusal naming the file that is missing."""

    try:
        data = path.resolve(strict=True).read_bytes()
    except OSError as error:
        raise FileNotFoundError(
            f"{path} could not be read ({error.strerror or error}). The depletion walk reads "
            f"retained run artifacts, which are ignored by Git and therefore absent on a fresh "
            f"clone. Re-run the identification and coverage publication that produces it, or "
            f"pass a retained copy with --coverage."
        ) from error
    return json.loads(data.decode("utf-8")), "sha256:" + hashlib.sha256(data).hexdigest()


def claims_from_coverage(coverage: dict) -> list[Claim]:
    by_callout = coverage.get("byCallout")
    if not isinstance(by_callout, dict) or not by_callout:
        raise ValueError(
            "the coverage artifact has no non-empty `byCallout` map, so there are no claims to "
            "walk. This report reads `lego.real-build-catalog-coverage/1`; point --coverage at "
            "such a file."
        )
    return [
        Claim(
            callout_key=key,
            step_number=row.get("stepNumber"),
            element_id=row.get("elementId"),
            quantity=int(row.get("quantity", 0)),
            confidence=row.get("identificationConfidence"),
        )
        for key, row in sorted(by_callout.items())
    ]


def clusters_from_match(match: dict, features: dict) -> tuple[list[Cluster], dict[int, str]]:
    """Clusters keyed by callout identity, plus each cluster's lead file name."""

    callouts = features.get("callouts")
    if not isinstance(callouts, list):
        raise ValueError(
            "the features artifact has no `callouts` list, so a cluster's member indices cannot "
            "be resolved to callout identities. This report reads "
            "`lego.part-identification-features/3`."
        )
    clusters: list[Cluster] = []
    leads: dict[int, str] = {}
    for row in match.get("clusters", []):
        members = row.get("members", [])
        keys = []
        for member in members:
            if not isinstance(member, int) or not 0 <= member < len(callouts):
                raise ValueError(
                    f"cluster {row.get('clusterIndex')} names member index {member!r}, which is "
                    f"not a position in the {len(callouts)}-entry features callout list. The "
                    f"match artifact and the features artifact disagree about the callout set; "
                    f"republish them from the same features digest."
                )
            keys.append(callouts[member]["identity"])
        clusters.append(
            Cluster(
                index=int(row["clusterIndex"]),
                demand=int(row["pieces"]),
                callout_keys=tuple(sorted(keys)),
                shortlist=tuple(c["elementId"] for c in row.get("candidates", [])),
            )
        )
        leads[int(row["clusterIndex"])] = str(row.get("lead", ""))
    return clusters, leads


def build_report(
    *,
    inventory: dict[str, int],
    claims: list[Claim],
    clusters: list[Cluster],
    universe: tuple[str, ...],
    element_facts: dict[str, dict],
    digests: dict[str, str],
    coverage_path: str,
) -> dict:
    by_key = {claim.callout_key: claim for claim in claims}
    first_steps: dict[int, int | None] = {}
    assignment: dict[int, str] = {}
    for cluster in clusters:
        steps = [
            by_key[k].step_number
            for k in cluster.callout_keys
            if k in by_key and by_key[k].step_number is not None
        ]
        first_steps[cluster.index] = min(steps) if steps else None
        claimed = {
            by_key[k].element_id
            for k in cluster.callout_keys
            if k in by_key and by_key[k].element_id is not None
        }
        if len(claimed) == 1:
            assignment[cluster.index] = str(next(iter(claimed)))

    all_claims = walk_inventory(inventory, claims)
    trusted = walk_inventory(inventory, claims, trusted_only=True)
    refuted = infeasible_clusters(inventory, clusters, assignment, first_steps)

    narrowings = []
    for cluster in clusters:
        step = first_steps[cluster.index]
        residue = (
            collections.Counter()
            if step is None
            else consumed_before(claims, step, exclude=frozenset(cluster.callout_keys))
        )
        narrowings.append(narrow_cluster(inventory, universe, cluster, step, residue))

    cluster_of: dict[str, int] = {}
    for cluster in clusters:
        for key in cluster.callout_keys:
            cluster_of[key] = cluster.index
    by_index = {n.index: n for n in narrowings}

    refused_report = []
    for key in REFUSED_CALLOUTS:
        index = cluster_of.get(key)
        if index is None:
            refused_report.append(
                {
                    "calloutKey": key,
                    "note": (
                        f"{key} is not in any published cluster of this match artifact, so the "
                        f"walk has no drawing group to narrow. Republish the match artifact "
                        f"against the callout manifest this coverage was identified from."
                    ),
                }
            )
            continue
        narrowing = by_index[index]
        refused_report.append(
            {
                "calloutKey": key,
                "clusterIndex": index,
                "printedStep": by_key[key].step_number if key in by_key else None,
                "claimedElementId": by_key[key].element_id if key in by_key else None,
                "identificationConfidence": by_key[key].confidence if key in by_key else None,
                "verdictIsNotOverridden": (
                    "This entry narrows candidates only. The blind pair-judged refusal stands; "
                    "nothing here promotes a candidate to an identity."
                ),
                "clusterDemand": narrowing.demand,
                "shortlist": [
                    {
                        "elementId": element,
                        "inventory": inventory.get(element, 0),
                        "partNum": element_facts.get(element, {}).get("partNum"),
                        "name": element_facts.get(element, {}).get("name"),
                        "survivesCapacity": element in narrowing.shortlist_capacity_survivors,
                        "survivesExactDemand": element in narrowing.shortlist_exact_survivors,
                    }
                    for element in narrowing.shortlist
                ],
                "exactDemandCandidates": len(narrowing.exact_survivors),
                "exactDemandSharingShortlistMould": [
                    {
                        "elementId": element,
                        "inventory": inventory.get(element, 0),
                        "partNum": element_facts.get(element, {}).get("partNum"),
                        "colorId": element_facts.get(element, {}).get("colorId"),
                        "name": element_facts.get(element, {}).get("name"),
                    }
                    for element in narrowing.exact_survivors
                    if element_facts.get(element, {}).get("partNum")
                    in {
                        element_facts.get(s, {}).get("partNum") for s in narrowing.shortlist
                    }
                ],
            }
        )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "what": (
            "Walking the printed booklet in order and spending its back-matter inventory. The "
            "deliverable is the first printed step at which the published claims cannot be "
            "supplied, and the callouts responsible."
        ),
        "inputs": {"coveragePath": coverage_path, **digests},
        "inventory": {
            "elements": len(inventory),
            "pieces": sum(inventory.values()),
            "candidateUniverse": len(universe),
            "elementsOutsideUniverse": sorted(set(inventory) - set(universe)),
        },
        "walks": {
            name: {
                "firstInconsistentStep": report.first_inconsistent_step,
                "stepsWalked": report.steps_walked,
                "claimsWalked": report.claims_walked,
                "piecesWalked": report.pieces_walked,
                "piecesOverdrawn": report.pieces_overdrawn,
                "piecesLeftOver": report.pieces_left_over,
                "overdraftCount": len(report.overdrafts),
                "skippedClaims": len(report.skipped),
                "firstOverdraft": asdict(report.overdrafts[0]) if report.overdrafts else None,
                "overdrafts": [asdict(o) for o in report.overdrafts],
                "suspectSets": [asdict(s) for s in report.suspects],
                "leftover": [
                    {
                        "elementId": element,
                        "pieces": count,
                        "partNum": element_facts.get(element, {}).get("partNum"),
                        "name": element_facts.get(element, {}).get("name"),
                    }
                    for element, count in report.leftover
                ],
            }
            for name, report in (("allClaims", all_claims), ("trustedOnly", trusted))
        },
        "refutedClusters": {
            "count": len(refuted),
            "clusters": [asdict(c) for c in refuted],
        },
        "narrowing": narrowing_score(narrowings),
        "refusedCallouts": refused_report,
        "groundTruthLocalisation": localisation_score(all_claims, by_key),
    }


def localisation_score(report, by_key: dict) -> dict:
    """Score the walk against the four labels already known to be mis-read.

    The walk blames the claim that crossed the inventory line, which is the last
    one to arrive and not usually the wrong one. This measures that gap on a
    known answer: how many of the four the walk names outright, and how many it
    merely lands inside a suspect set, together with how large that set is.
    """

    blamed: set[str] = set()
    for overdraft in report.overdrafts:
        blamed.update(overdraft.callout_keys)
    suspect: set[str] = set()
    for suspect_set in report.suspects:
        suspect.update(claim[1] for claim in suspect_set.claims)

    rows = []
    for key in KNOWN_MISREAD_MULTIPLIER_LABELS:
        if key not in by_key:
            rows.append(
                {
                    "calloutKey": key,
                    "presentInCoverage": False,
                    "note": (
                        f"{key} is not a part-art claim in this coverage, so the walk is not "
                        f"being asked about it. That is the expected result once it is "
                        f"classified as a repeat multiplier."
                    ),
                }
            )
            continue
        rows.append(
            {
                "calloutKey": key,
                "presentInCoverage": True,
                "printedStep": by_key[key].step_number,
                "claimedElementId": by_key[key].element_id,
                "blamedByAnOverdraft": key in blamed,
                "insideASuspectSet": key in suspect,
            }
        )
    present = [row for row in rows if row["presentInCoverage"]]
    return {
        "what": (
            "Four labels a hand read of the printed pages resolved as repeat multipliers rather "
            "than parts-bin quantities. Preregistered so the walk is scored against a known "
            "answer."
        ),
        "labels": rows,
        "presentInCoverage": len(present),
        "blamedByAnOverdraft": sum(1 for row in present if row["blamedByAnOverdraft"]),
        "insideASuspectSet": sum(1 for row in present if row["insideASuspectSet"]),
        "calloutsBlamed": len(blamed),
        "calloutsInsideASuspectSet": len(suspect),
        "calloutsWalked": report.claims_walked,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--coverage", default=str(COVERAGE))
    parser.add_argument("--out", default=str(REPORT))
    args = parser.parse_args()

    inventory_raw, inventory_digest = read_json(INVENTORY)
    match, match_digest = read_json(MATCH)
    features, features_digest = read_json(FEATURES)
    distances, distances_digest = read_json(DISTANCES)
    coverage, coverage_digest = read_json(Path(args.coverage))

    inventory = {e: int(v["quantity"]) for e, v in inventory_raw.items()}
    universe = tuple(distances["elementIds"])
    clusters, _ = clusters_from_match(match, features)
    claims = claims_from_coverage(coverage)

    report = build_report(
        inventory=inventory,
        claims=claims,
        clusters=clusters,
        universe=universe,
        element_facts=inventory_raw,
        digests={
            "inventoryDigest": inventory_digest,
            "matchDigest": match_digest,
            "featuresDigest": features_digest,
            "distancesDigest": distances_digest,
            "coverageDigest": coverage_digest,
        },
        coverage_path=str(Path(args.coverage).as_posix()),
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")

    for name, walk in report["walks"].items():
        print(
            f"{name:<12} first inconsistent step {str(walk['firstInconsistentStep']):<6}"
            f" overdrafts {walk['overdraftCount']:<4} pieces overdrawn "
            f"{walk['piecesOverdrawn']:<4} left over {walk['piecesLeftOver']}"
        )
        if walk["firstOverdraft"] is not None:
            print("             ", walk["firstOverdraft"]["reason"])
    print(f"refuted clusters {report['refutedClusters']['count']}")
    localisation = report["groundTruthLocalisation"]
    print(
        f"known mis-read labels present {localisation['presentInCoverage']}/4"
        f"  blamed {localisation['blamedByAnOverdraft']}"
        f"  in a suspect set {localisation['insideASuspectSet']}"
        f"  (suspect sets hold {localisation['calloutsInsideASuspectSet']} of "
        f"{localisation['calloutsWalked']} walked callouts)"
    )
    print("narrowing", json.dumps(report["narrowing"]))
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
