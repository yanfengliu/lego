from __future__ import annotations

from dataclasses import dataclass



REQUIRED_LEAF_IDS = tuple(
    """
    2310 2449 2450 2453 2877 3039 3040 3044 3245 3386 3573 3626 3814 3818 3819 3820
    4032 4070 4216 4304 4519 4569 4585 4733 4740 5092 6019 6141 6143 6254 6801 7126
    7236 7302 7324 7562 8172 10201 11090 11211 11212 11253 11610 13547 14716 14719 15254 15571
    15706 18654 18674 20482 23443 24482 25269 26603 26604 28192 30136 30162 30357 30374 30414 31510
    32028 32064 32828 32952 33909 35395 35464 35480 35787 36036 36840 36841 37846 38583 38585 41682
    43898 44237 44728 49307 50746 51739 52394 58176 59900 60478 60481 61406 63868 63965 64644 64647
    67095 67329 73109 73230 73825 73831 77844 77850 78258 78329 78443 78444 79491 86876 86996 87087
    87994 89680 93273 93274 93888 98283 99207 99563 99780
    """.split()
)

REQUIRED_LEAF_SET_SHA256 = (
    "sha256:6d4b2f1bbff91928da9f8315c77ae757d8f138842ac974b9a017099b54a16e49"
)

EXPECTED_AUDIT_COUNTS = {
    "requiredLeaves": 121,
    "resolvedRoutes": 117,
    "unresolvedRoutes": 4,
    "officialExactRoots": 113,
    "unofficialExactRoots": 3,
    "officialKeywordMappings": 1,
    "uniqueClosureSourceFiles": 439,
    "uniqueClosureSourceBytes": 896_002,
}


@dataclass(frozen=True)
class LicenseDocumentPin:
    path: str
    byte_length: int
    sha256: str


LICENSE_DOCUMENT_PINS = (
    LicenseDocumentPin(
        path="calicense.txt",
        byte_length=12_698,
        sha256="487265d3a122b2e54e460954cd2eca34ac2e545bcb1b2ac23cbda2a27e49a6c2",
    ),
    LicenseDocumentPin(
        path="calicense4.txt",
        byte_length=18_657,
        sha256="9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
    ),
    LicenseDocumentPin(
        path="careadme.txt",
        byte_length=4_151,
        sha256="c67a824bdab18e646337b5b26f7f039c84b0be71273c0c878e2749e648820497",
    ),
)


@dataclass(frozen=True)
class ArchivePin:
    archive_id: str
    logical_name: str
    byte_length: int
    sha256: str
    entry_count: int
    max_entry_count: int
    license_documents: tuple[LicenseDocumentPin, ...]


ARCHIVE_PINS = (
    ArchivePin(
        archive_id="official",
        logical_name="ldraw-complete-2026-07.zip",
        byte_length=144_722_356,
        sha256="6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
        entry_count=36_896,
        max_entry_count=50_000,
        license_documents=LICENSE_DOCUMENT_PINS,
    ),
    ArchivePin(
        archive_id="unofficial",
        logical_name="ldraw-unofficial-2026-08-02.zip",
        byte_length=87_377_883,
        sha256="09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4",
        entry_count=9_137,
        max_entry_count=20_000,
        license_documents=LICENSE_DOCUMENT_PINS,
    ),
)

ROOT_OVERRIDES = {
    "3814": {
        "archiveId": "official",
        "path": "parts/973.dat",
        "identityKind": "header-keyword-cross-catalog",
        "identityEvidenceLine": "0 !KEYWORDS Rebrickable 3814",
    },
    "6801": {
        "archiveId": "unofficial",
        "path": "parts/6801.dat",
        "identityKind": "exact-design-filename",
    },
    "7236": {
        "archiveId": "unofficial",
        "path": "parts/7236.dat",
        "identityKind": "exact-design-filename",
    },
    "7302": {
        "archiveId": "unofficial",
        "path": "parts/7302.dat",
        "identityKind": "exact-design-filename",
    },
}

UNRESOLVED_ROUTES = {
    "3245": {
        "reason": "ldraw-variant-not-proven",
        "exactPathsRequiredAbsent": ["parts/3245.dat"],
        "reviewedCandidates": [
            {"archiveId": "official", "path": "parts/3245a.dat"},
            {"archiveId": "official", "path": "parts/3245b.dat"},
            {"archiveId": "official", "path": "parts/3245c.dat"},
        ],
        "evidence": {
            "builderRevision": "M",
            "expectedBuilderManifestMd5": "a679d0929e777a86573469a63ce841dd",
            "observedBuilderBundleMd5": "bdce3745e99adf9c3bfb0708161c6875",
            "conclusion": "three materially distinct official LDraw variants and no primary element-to-variant mapping",
        },
    },
    "7562": {
        "reason": "no-authoritative-ldraw-alias",
        "exactPathsRequiredAbsent": ["parts/7562.dat"],
        "reviewedCandidates": [
            {"archiveId": "official", "path": "parts/61678.dat"},
            {"archiveId": "official", "path": "parts/11153.dat"},
        ],
        "evidence": {
            "builderRevision": "A",
            "builderSuperDesignId": "11219483",
            "rejectedAliasDeclarations": {
                "61678": ["61678", "63323", "63971"],
                "11153": ["11153"],
            },
            "conclusion": "similar primary-source geometry is not an alias declaration",
        },
    },
    "8172": {
        "reason": "no-ldraw-file-or-alias-in-pinned-archives",
        "exactPathsRequiredAbsent": ["parts/8172.dat"],
        "reviewedCandidates": [],
        "evidence": {
            "builderRevision": "A",
            "builderSuperDesignId": "11220621",
            "builderName": "WIG, W/ ACCESSORY, NO. 19",
        },
    },
    "89680": {
        "reason": "no-ldraw-file-or-alias-in-pinned-archives",
        "exactPathsRequiredAbsent": ["parts/89680.dat"],
        "reviewedCandidates": [],
        "evidence": {
            "builderRevision": "F",
            "builderSuperDesignId": "11214037",
            "builderName": "BRICK 4X16 W/ BOW AND ANGLE",
        },
    },
}


def planned_route(design_id: str) -> dict[str, object]:
    unresolved = UNRESOLVED_ROUTES.get(design_id)
    if unresolved is not None:
        return {"designId": design_id, "state": "unresolved-source-route", **unresolved}
    override = ROOT_OVERRIDES.get(design_id)
    if override is not None:
        return {
            "designId": design_id,
            "state": "ldraw-root-and-closure-resolved-not-admitted",
            **override,
        }
    return {
        "designId": design_id,
        "state": "ldraw-root-and-closure-resolved-not-admitted",
        "archiveId": "official",
        "path": f"parts/{design_id}.dat",
        "identityKind": "exact-design-filename",
    }


SOURCE_AUDIT_PLAN = tuple(planned_route(design_id) for design_id in REQUIRED_LEAF_IDS)
