from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import stat
import struct
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable


OFFICIAL_MODEL_DIGEST = "c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922"
MANIFEST_DIGEST = "3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6"
CACHE_REPORT_DIGEST = "bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8"
AUDIT_REPORT_DIGEST = "ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4"
LDRAW_OFFICIAL_DIGEST = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
LDRAW_UNOFFICIAL_DIGEST = "09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4"
EXPECTED_GEOMETRY_DIGEST = "4c03dc3f534e7eab78da7e9c61bf3a539de064a01aa829b18023ac86340f8450"
CATALOG_VERSION = "builtin.basic-parts/6"
EVIDENCE_PROTOCOL = "builder-type23-frame-plus-ldraw-surface/2"

MAX_LDRAW_ZIP_ENTRIES = 100_000
MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES = 64 * 1024 * 1024
MAX_LDRAW_ZIP_ENTRY_BYTES = 8 * 1024 * 1024
MAX_LDRAW_ZIP_TOTAL_BYTES = 1_000_000_000
MAX_LDRAW_ZIP_FILENAME_BYTES = 512
MAX_LDRAW_ZIP_COMPRESSION_RATIO = 250
LDRAW_ZIP_REMEDIATION = (
    "Use the reviewed pinned official/unofficial LDraw archive or remove non-library payloads; "
    "do not raise a bound to admit an unreviewed archive."
)
ZIP_EOCD_SIGNATURE = b"PK\x05\x06"
ZIP64_EOCD_SIGNATURE = b"PK\x06\x06"
ZIP64_LOCATOR_SIGNATURE = b"PK\x06\x07"
ZIP_CENTRAL_DIRECTORY_SIGNATURE = b"PK\x01\x02"

LDRAW_CLOSURE_LICENSE = "Licensed under CC BY 4.0 : see CAreadme.txt"
LDRAW_CLOSURE_FILES = (
    ("p/1-16cyli.dat", "b60f031d9dfd0995c1741992a5695ee3789419886e8189dead961d05f75f7bfc", "Marc Klein [marckl]", "Primitive UPDATE 2005-01"),
    ("p/1-16cylo.dat", "6cef884c4f96ec15f5bd1428264af2efba4443cb1e47ead116a8a094febefc67", "Max Martin Richter [MMR1988]", "Primitive UPDATE 2014-01"),
    ("p/1-16edge.dat", "42fc4d69af1281b71cb2eb9546e99e8bca2fc231d05a0379e71d4e1c9a60c95c", "Marc Klein [marckl]", "Primitive UPDATE 2017-01"),
    ("p/1-16ring3.dat", "fc42cc8def33dca0ba2bf372688e5c373d54783041e693ec6ed79da5974e48b7", "Steve Bliss [sbliss]", "Primitive UPDATE 2024-02"),
    ("p/1-16stud4.dat", "2a95318eb2a3737f259e904565d39aff1c9bdeedaf1774c9548fe463fefea01b", "Massimo Maso [Sirio]", "Primitive UPDATE 2024-02"),
    ("p/1-4cyli.dat", "5a7168952a5a3570327873b9a5802fa7b3be40967ab78c03b6a2bfd4419a1f10", "James Jessiman", "Primitive UPDATE 2012-01"),
    ("p/1-4cylo.dat", "792a01362608c3f385dd7f01a1bd7d19cf9ed8a40f793266345cc86d1d98f3af", "Max Martin Richter [MMR1988]", "Primitive UPDATE 2010-03"),
    ("p/1-4edge.dat", "9ce2de7e67bbac575d52cfdc771b9d00856efc9b88002d97db8e665e50f4d467", "James Jessiman", "Primitive UPDATE 2017-01"),
    ("p/1-4ring3.dat", "4048b121d53509363cfaa7422648dd29b2eeb93074279feb0bcc7a45bbb7c2e1", "Willy Tschager [Holly-Wood]", "Primitive UPDATE 2024-01"),
    ("p/1-4stud4.dat", "cc27fe29307676a8f46d25ad35304ce2e576f3c8bee81c20cb461c401512b58e", "Massimo Maso [Sirio]", "Primitive UPDATE 2019-01"),
    ("p/1-8chrd.dat", "7694157b725563188a6efd69b3f558b00533b375b8a4e82f469497a03e471e74", "Orion Pobursky [OrionP]", "Primitive UPDATE 2023-05"),
    ("p/1-8cyli.dat", "46def63dc8293ad9a2dd1d1a5cb720b9ba883850e65d3280d2093c664a6140c4", "James Jessiman", "Primitive UPDATE 2005-01"),
    ("p/1-8cylo.dat", "870bbbf6052e075598de7dce7efe7a139ea5189820e7a296442fe2b3318c18bf", "Tim Gould [timgould]", "Primitive UPDATE 2012-03"),
    ("p/1-8edge.dat", "50436a0bce461198c342dccbccb658a1bffae13e44b7c48689b158c946c2c2ab", "James Jessiman", "Primitive UPDATE 2017-01"),
    ("p/1-8ndis.dat", "97e394834789794c8635261fa604ad8e69b4c6872d0cd8d7506408b80023f408", "James Jessiman", "Primitive UPDATE 2012-01"),
    ("p/1-8ring3.dat", "641f3ae7395e7d38e57ab918928ac19209ed72e8474fd1646e2d70f223c4a0ce", "Paul Easter [pneaster]", "Primitive UPDATE 2012-01"),
    ("p/1-8stud4.dat", "9395515b1e38008dab61d9a971d9564e36ea6fbe4a32a244c789e8e5a2a58f6d", "Massimo Maso [Sirio]", "Primitive UPDATE 2019-01"),
    ("p/3-16cyli.dat", "f50d12a37a22ae4a5f37a017b8e39d1e729577b0a4aa376ca685b210806b49c8", "Mark Kennedy [mkennedy]", "Primitive UPDATE 2005-01"),
    ("p/3-16cylo.dat", "a5c8370842299035a9cc14308301614c6fb169fb873a7950c888928cd8d9181c", "J.C. Tchang [tchang]", "Primitive UPDATE 2013-01"),
    ("p/3-16edge.dat", "c08dd83bb7fe90b61f7cd0b10ebef0d9a9ba33b497676dedd2e2e968cb8248f9", "Donald Sutter [technog]", "Primitive UPDATE 2017-01"),
    ("p/3-16ring3.dat", "3e0d8f9325ef96db0fa0a471240f810181a235736554c040a303f20d03294136", "Philippe Hurbain [Philo]", "Primitive UPDATE 2024-02"),
    ("p/3-16stud4.dat", "6dd3e7068ef5fe4ab07ae85e51eabfacef0886cdf0f38941618e5c36fa03e198", "Massimo Maso [Sirio]", "Primitive UPDATE 2024-02"),
    ("p/4-4cyli.dat", "4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4", "James Jessiman", "Primitive UPDATE 2005-01"),
    ("p/4-4disc.dat", "a00b5547776f61a7389d303616987c76b3c4de86ad8ec32f22857e1bd5e5e40f", "James Jessiman", "Primitive UPDATE 2002-02"),
    ("p/4-4edge.dat", "54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da", "James Jessiman", "Primitive UPDATE 2017-01"),
    ("p/4-4ring3.dat", "1f2835ac308154edc2d6f479d8e742a55be981f6167b20bfa100c195bc0731dd", "James Jessiman", "Primitive UPDATE 2009-01"),
    ("p/48/1-16cyli.dat", "b6fb5e76f958a18c4cc88866d5e6a0502b62d3abda1a72450663b82502645330", "Willy Tschager [Holly-Wood]", "48_Primitive UPDATE 2024-01"),
    ("p/48/1-16cylo.dat", "94929f851cefec060fcf3222213a1f9743f9b6549a9e7bbcf471482dc546a827", "Max Martin Richter [MMR1988]", "48_Primitive UPDATE 2013-01"),
    ("p/48/1-16edge.dat", "9b3b4df68d3c0d68fd3e5c52346871867043f67522e53aaa21991562c89bdc10", "Willy Tschager [Holly-Wood]", "48_Primitive UPDATE 2024-01"),
    ("p/48/1-16tang.dat", "3e11a94e893a58effade5f052e53d2031cb7c6d1a69cc86da882e2c9cfac76e7", "Gerald Lasser [GeraldLasser]", "48_Primitive UPDATE 2020-03"),
    ("p/48/1-24cyli.dat", "5e767152f719b094442a5e68060781c9f2b7304595c6956bf98183bda00a9a36", "Niels Karsdorp [nielsk]", "48_Primitive UPDATE 2009-01"),
    ("p/48/1-4disc.dat", "7198ee223b3a7adb03d3335233d534fa43a88bb8159d67609eea07f68e5f9120", "Willy Tschager [Holly-Wood]", "48_Primitive UPDATE 2024-01"),
    ("p/48/1-8chrd.dat", "282b0d7dd4e73d273b9cbcce88e30889cce3b44aa8574a25382fe526248d5426", "Willy Tschager [Holly-Wood]", "48_Primitive UPDATE 2024-01"),
    ("p/48/1-8edge.dat", "eec30153f06bac336ca71ae16b31c5d0c7ae432acb5e91befe37fdb7b6bb1c8e", "[PTadmin]", "48_Primitive UPDATE 2017-01"),
    ("p/box2-5.dat", "8f297b754f87da1dbe19eec8704a5ce03a23b794ccd7cd015508e3758a206174", "Steffen [Steffen]", "Primitive UPDATE 2003-03"),
    ("p/box2-7.dat", "e0474c5ad7fb9ff77b67883a5b1e327d028e3eb4e59921a626b4215632dd9f00", "Willy Tschager [Holly-Wood]", "Primitive UPDATE 2024-01"),
    ("p/box3u8p.dat", "0f6187106f023d041dcfd2a24e9f5a2a0c37b5c41b0ff171267ae776a8f16760", "James Jessiman", "Primitive UPDATE 2012-01"),
    ("p/box4-2p.dat", "a4cb5395b3ec8bba18d81e36c32f43cb9349a55fe97729c367afaa5e1e8b7f0f", "Willy Tschager [Holly-Wood]", "Primitive UPDATE 2024-01"),
    ("p/box4-4a.dat", "58c69e00462c0a74c1bd6d75d757d826ae13e98bd3928b0e685209003bfbee54", "Willy Tschager [Holly-Wood]", "Primitive UPDATE 2024-01"),
    ("p/boxjcyl4.dat", "ceb4a5fd46fbff7d2e396afbc308379b914b99556b30a136cfb578a3dc360877", "Philippe Hurbain [Philo]", "Primitive UPDATE 2024-07"),
    ("p/rect.dat", "ffeb2dd3d9b83c38841f18f1f74800fbba9e90c5fb6badfff2a795f08a96cb71", "James Jessiman", "Primitive UPDATE 2010-01"),
    ("p/rect2p.dat", "faac2b36241a9de0c0108471e59c45734df6c79813332d9cacf97f6391886acc", "Donald Sutter [technog]", "Primitive UPDATE 2010-01"),
    ("p/rect3.dat", "07ac46908b6668d993b6de0fb001a34cd996542106b80ebc7de63317d8dde865", "Mark Kennedy [mkennedy]", "Primitive UPDATE 2010-01"),
    ("p/stud.dat", "db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4", "James Jessiman", "Primitive UPDATE 2012-01"),
    ("p/stud3.dat", "d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd", "James Jessiman", "Primitive UPDATE 2012-01"),
    ("p/stud4.dat", "871cdcab26e7f5113488a24c453d6fabda75b275b06de592e0bfaad4292c12a3", "James Jessiman", "Primitive UPDATE 2009-02"),
    ("p/stug-1x2.dat", "5842fa1baf6ea7f18fe4e355238cd733ff9bdbdc3d722be5cf8988f1c5fce414", "Steffen [Steffen]", "Primitive UPDATE 2011-01"),
    ("p/stug-2x1.dat", "03d08cea230e892e1b6cbfe523c19b568a834c5888aac5c789d1fb8d6ee93d96", "Magnus Forsberg [MagFors]", "Primitive UPDATE 2011-01"),
    ("p/stug-3x3.dat", "ec81497656a4a77a32cc09b131026c9882ab2da35944f701aa7575d43667d7f0", "Steve Bliss [sbliss]", "Primitive UPDATE 2011-01"),
    ("p/stug4-2x2.dat", "cf6e68b84d37562ed1a035015c23f804157ce6a80a7632a179e4def8ddcacfcb", "Steffen [Steffen]", "Primitive UPDATE 2011-01"),
    ("p/tri3a4.dat", "8c1cf47d85e2d2b429c0ac404108a9e91048fe7c9501b527dda55e75ad11bc4e", "Magnus Forsberg [MagFors]", "Primitive UPDATE 2017-01"),
    ("parts/30565.dat", "e201a60e7f8e8ab15a86e8449c0e722a1b1ebe8015a5021ac5ca9aa1fd462f39", "Gerald Lasser [GeraldLasser]", "Part UPDATE 2024-06"),
    ("parts/80015.dat", "b2c08c34303be83aaba7ab12aecf0ce203773e32189691f2c2b59b2a789d29d5", "Gerald Lasser [GeraldLasser]", "Part UPDATE 2024-05"),
    ("parts/s/22888s01.dat", "553077491f4d2c24cb59df94f75cf3a96b5daaf42adbe33d07e91451fb39d846", "Gerald Lasser [GeraldLasser]", "Subpart UPDATE 2024-07"),
    ("parts/s/22888s02.dat", "5afa0d11ed4cfc3f4669b214f53539794f8b6547f14654a991ef67b217215c7d", "Gerald Lasser [GeraldLasser]", "Subpart UPDATE 2024-06"),
    ("parts/s/30565s01.dat", "69b36b94a6b6313e379a36b26a1a1f9a3f18b452bf98547a7e16f21b3ecf086b", "Gerald Lasser [GeraldLasser]", "Subpart UPDATE 2024-06"),
    ("parts/s/80015s01.dat", "08baa9987359d51ddd8954ae8983a3aa0b5d47b063c497f4e43e520d3b2aa36b", "Gerald Lasser [GeraldLasser]", "Subpart UPDATE 2024-05"),
)
LDRAW_CLOSURE_MANIFEST = {
    "schemaVersion": "lego.builder-ldraw-closure/1",
    "archiveSha256": f"sha256:{LDRAW_OFFICIAL_DIGEST}",
    "roots": ["30565.dat", "80015.dat"],
    "license": f"0 !LICENSE {LDRAW_CLOSURE_LICENSE}",
    "files": [list(record) for record in LDRAW_CLOSURE_FILES],
}
LDRAW_CLOSURE_DIGEST = "588e47260fc03cdc0fc2fea3bf8a0c5eef62818b0b41dd028aea859031af3fa6"

ORIENTATIONS = [
    ("upright-yaw-0", (1, 0, 0, 0, 1, 0, 0, 0, 1)),
    ("upright-yaw-90", (0, 0, 1, 0, 1, 0, -1, 0, 0)),
    ("upright-yaw-180", (-1, 0, 0, 0, 1, 0, 0, 0, -1)),
    ("upright-yaw-270", (0, 0, -1, 0, 1, 0, 1, 0, 0)),
]


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha_value(value: object) -> str:
    return f"sha256:{sha256(canonical_json(value))}"


def canonical_json(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode(
        "utf-8"
    )


def bounded_bytes(path: Path, maximum: int, label: str) -> bytes:
    resolved = path.resolve(strict=True)
    with resolved.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError(
                f"{label} {resolved} is not a regular file. Copy the exact reviewed source "
                "to a stable local file before calibration."
            )
        if before.st_size > maximum:
            raise ValueError(
                f"{label} has {before.st_size} bytes; limit is {maximum}. Use the exact pinned "
                "source or a smaller reviewed input; do not raise the limit for unreviewed data."
            )
        payload = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    if (
        len(payload) > maximum
        or len(payload) != before.st_size
        or after.st_size != before.st_size
    ):
        raise ValueError(
            f"{label} changed while the same open handle was being captured or exceeded its "
            f"{maximum}-byte limit. Retry from a stable local copy; the captured bytes were "
            "discarded."
        )
    return payload


def verified_bytes(path: Path, expected: str, label: str, maximum: int) -> bytes:
    payload = bounded_bytes(path, maximum, label)
    actual = sha256(payload)
    if actual != expected:
        raise ValueError(
            f"{label} SHA-256 differs: {actual} != {expected}. Use the exact reviewed source; "
            "changing the expected digest does not authorize replacement bytes."
        )
    return payload


def write_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def transform_point(matrix: tuple[int, ...], translation: tuple[float, ...], point: tuple[float, ...]):
    return tuple(
        translation[row]
        + sum(matrix[row * 3 + column] * point[column] for column in range(3))
        for row in range(3)
    )


def derive_frame(catalog: list[list[int]], builder: list[list[int]]) -> dict[str, object]:
    expected = sorted(map(tuple, builder))
    candidates: dict[str, dict[str, object]] = {}
    for orientation_id, matrix in ORIENTATIONS:
        rotated_first = transform_point(matrix, (0, 0, 0), tuple(catalog[0]))
        for target in expected:
            translation = tuple(target[axis] - rotated_first[axis] for axis in range(3))
            transformed = sorted(
                transform_point(matrix, translation, tuple(point)) for point in catalog
            )
            if transformed == expected:
                candidate = {
                    "positionLdu": list(map(int, translation)),
                    "orientationId": orientation_id,
                }
                candidates[json.dumps(candidate, separators=(",", ":"))] = candidate
    if len(candidates) != 1:
        raise ValueError(f"Connector sets derive {len(candidates)} frames; expected exactly one")
    return next(iter(candidates.values()))


DESIGNS = [
    {
        "designRevision": "30565;E",
        "designId": "30565",
        "catalogPartId": "builtin:corner-plate-4x4-round",
        "sourceIdentity": {
            "bundleSha256": "sha256:955ce425a8ddf4b12d320260d627df3f3fb46c52fedaf70f1d562b0e1efa7c93",
            "manifestMd5": "md5:a586e0381c918e42b21b0360cdfe94cc",
            "primitiveXmlSha256": "sha256:ecbaf1354eeb1fb7f001508869228ba19f44268ca8aaab7bd6312f57e3db6578",
            "shellPathId": "-2382827459408350605",
            "shellCanonicalSha256": "sha256:8b41bc4bed4f2e9ee8ddd49b6ed74b52035c1b4f86507d838db56bb55deec8b2",
            "shellVertexCount": 294,
            "shellTriangleCount": 236,
            "ldrawOfficialArchiveSha256": f"sha256:{LDRAW_OFFICIAL_DIGEST}",
            "ldrawUnofficialArchiveSha256": f"sha256:{LDRAW_UNOFFICIAL_DIGEST}",
            "ldrawClosureSha256": f"sha256:{LDRAW_CLOSURE_DIGEST}",
        },
        "builderGeometry": {
            "format": "lego.builder-shell-triangles-f32le/1",
            "byteOffset": 0,
            "byteLength": 8_496,
            "digest": "sha256:e6f4de945ace46a977e9b250ad3c10398415d1240c6524182a95fbb45cc6cb3a",
            "triangleCount": 236,
        },
        "ldrawReferenceGeometry": {
            "format": "lego.ldraw-expanded-triangles-f32le/1",
            "byteOffset": 37_440,
            "byteLength": 49_248,
            "digest": "sha256:46aa56e00a305b75690fcaf8493e296d999648053f28953c5572fd8a638ec64d",
            "triangleCount": 1_368,
        },
        "ldrawToCatalogLocalTransform": {"positionLdu": [0, -4, 0], "orientationId": "upright-yaw-0"},
        "builderStudCentersLdu": [
            [0, -8, -60], [0, -8, -40], [0, -8, -20], [0, -8, 0],
            [20, -8, -40], [20, -8, -20], [20, -8, 0],
            [40, -8, -40], [40, -8, -20], [40, -8, 0], [60, -8, 0],
        ],
        "builderStudCentersDigest": "sha256:7533437f380d7a9f23d1150ca08a8ee58fa1608c96108f2279ea5db7e524b59f",
        "uniqueBuilderVertexCount": 127,
        "expectedCatalogDefinitionDigest": "sha256:6b003a4cf99b82400f11253e63372607252fc99020db82e66242639e7138415f",
        "expectedCatalogGeometryDigest": "sha256:8f1673f6e9d8d8cd605ae0523477a7fb315d267e2ca139f3cf11a77aeb4fac58",
        "expectedCatalogConnectorDigest": "sha256:e1c23184c8a3ae2dc50a4d0b71fae3bf4fee414d2c041490ae60436d735bb86a",
        "expectedCatalogCollisionDigest": "sha256:a220fecc8192e1b28018a732b89047ca24c0ebd101f32ac4f4ee239f6c8f05d8",
        "catalogStudCenters": [
            [-30, -4, -30], [-30, -4, -10], [-30, -4, 10], [-30, -4, 30],
            [-10, -4, -10], [-10, -4, 10], [-10, -4, 30],
            [10, -4, -10], [10, -4, 10], [10, -4, 30], [30, -4, 30],
        ],
    },
    {
        "designRevision": "80015;E",
        "designId": "80015",
        "catalogPartId": "builtin:corner-plate-5x5-quarter-ring",
        "sourceIdentity": {
            "bundleSha256": "sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
            "manifestMd5": "md5:bb72d5b5609e411392df36903c8c5daa",
            "primitiveXmlSha256": "sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
            "shellPathId": "3328116897400514273",
            "shellCanonicalSha256": "sha256:946c5c5782c36a44883200cc57e150c43bef2f4b8e8444257cfcb49952327723",
            "shellVertexCount": 928,
            "shellTriangleCount": 804,
            "ldrawOfficialArchiveSha256": f"sha256:{LDRAW_OFFICIAL_DIGEST}",
            "ldrawUnofficialArchiveSha256": f"sha256:{LDRAW_UNOFFICIAL_DIGEST}",
            "ldrawClosureSha256": f"sha256:{LDRAW_CLOSURE_DIGEST}",
        },
        "builderGeometry": {
            "format": "lego.builder-shell-triangles-f32le/1",
            "byteOffset": 8_496,
            "byteLength": 28_944,
            "digest": "sha256:130309ee4bf88b886982d6c81f79584a55b161e165220f2b0328e1d3a1529b33",
            "triangleCount": 804,
        },
        "ldrawReferenceGeometry": {
            "format": "lego.ldraw-expanded-triangles-f32le/1",
            "byteOffset": 86_688,
            "byteLength": 36_000,
            "digest": "sha256:685a8ad17a0882dc5fc8493abd7280c7962956f88c6c662859c80957bd1ed463",
            "triangleCount": 1_000,
        },
        "ldrawToCatalogLocalTransform": {"positionLdu": [0, -4, 0], "orientationId": "upright-yaw-0"},
        "builderStudCentersLdu": [
            [-80, -8, 80], [-60, -8, 80], [-20, -8, 60], [0, -8, 0], [0, -8, 20],
        ],
        "builderStudCentersDigest": "sha256:fcb9e7ebe34ecd586ea7e2ce826005bf22b0227b892261173263c49ae3e30f2f",
        "uniqueBuilderVertexCount": 430,
        "expectedCatalogDefinitionDigest": "sha256:928a4e6bf5b850dc8a91f5bf6eab54a64472a409fef4953323a6f2361523d26c",
        "expectedCatalogGeometryDigest": "sha256:219faec905cef376d05b5769ef055041875ba1a01ae8ebec81b864f24c9664e4",
        "expectedCatalogConnectorDigest": "sha256:e63591f952a84357a7c4fd2462ee1828d9b1510bc02e799292be1d879fcb8b97",
        "expectedCatalogCollisionDigest": "sha256:26bcf626f81a915874df281b8a4bb1f586c322ae23e27990cc184caf27f85950",
        "catalogStudCenters": [
            [-10, -4, -70], [10, -4, -70], [50, -4, -50], [70, -4, -10], [70, -4, 10],
        ],
    },
]

CASES = [
    {"brickRef": "a12d1753-e853-4589-bc67-e1cb4e784fa7", "builderTransformationDigest": "sha256:ba9b5cb293247b9222b123c4d95b66e4ba7d6752fc60de74feb35d31aeef34ad", "expectedTransform": {"positionLdu": [270, -16, 244], "orientationId": "upright-yaw-0"}},
    {"brickRef": "da6a6d03-1c34-43ff-97e9-5939ccf26777", "builderTransformationDigest": "sha256:6e6e61a4b108dde4eadc59ecff258a2c87658727a9117af2a9d8db1d2160c1d2", "expectedTransform": {"positionLdu": [270, -580, 104], "orientationId": "upright-yaw-90"}},
    {"brickRef": "d63813bf-f3b6-4059-b5de-6605e8baf320", "builderTransformationDigest": "sha256:65d39c9641261db0a54ce361f501594ba6d0f1fc660be10ed5ed5869430d61ec", "expectedTransform": {"positionLdu": [390, -572, 104], "orientationId": "upright-yaw-180"}},
    {"brickRef": "55506c77-f293-40f5-8aa7-ea85501f07f1", "builderTransformationDigest": "sha256:aa2a689c493fc4d244e55c72eb122791350195c40fc252a6adaf4d38138aa25b", "expectedTransform": {"positionLdu": [410, -580, 104], "orientationId": "upright-yaw-270"}},
]

ORIGIN_POLICY = {
    "protocol": "first-ordered-direct-empty-enumeration/1",
    "anchorBrickRef": "76092bf0-3d72-474a-baf3-06b837082f6a",
    "anchorBuilderTransformationDigest": "sha256:b17eb49ceb81e036753fd1bc9a1a4d0cf60c945cf8a98311c589e6e981dd7f82",
    "expectedComposedTransform": {"positionLdu": [540, -4, 194], "orientationId": "upright-yaw-180"},
    "expectedEmptyEnumerationTransform": {"positionLdu": [0, 8, 0], "orientationId": "upright-yaw-180"},
}


def preflight_zip_directory(payload: bytes, label: str) -> None:
    """Bounds central-directory allocation before ZipFile materializes ZipInfo rows."""
    minimum_eocd_size = 22
    search_start = max(0, len(payload) - (65_535 + minimum_eocd_size))
    cursor = len(payload)
    eocd_offset = -1
    eocd: tuple[object, ...] | None = None
    while cursor > search_start:
        candidate = payload.rfind(ZIP_EOCD_SIGNATURE, search_start, cursor)
        if candidate < 0:
            break
        if candidate + minimum_eocd_size <= len(payload):
            parsed = struct.unpack_from("<4s4H2LH", payload, candidate)
            comment_length = parsed[7]
            if candidate + minimum_eocd_size + comment_length == len(payload):
                eocd_offset = candidate
                eocd = parsed
                break
        cursor = candidate
    if eocd is None:
        raise ValueError(
            f"{label} has no terminal ZIP end-of-central-directory record within the bounded "
            f"65,535-byte comment window. {LDRAW_ZIP_REMEDIATION}"
        )

    disk_number = int(eocd[1])
    central_disk = int(eocd[2])
    entries_on_disk = int(eocd[3])
    entry_count = int(eocd[4])
    central_size = int(eocd[5])
    central_offset = int(eocd[6])
    directory_end_limit = eocd_offset
    zip64 = (
        entries_on_disk == 0xFFFF
        or entry_count == 0xFFFF
        or central_size == 0xFFFFFFFF
        or central_offset == 0xFFFFFFFF
    )
    if zip64:
        locator_offset = eocd_offset - 20
        if locator_offset < 0:
            raise ValueError(
                f"{label} advertises ZIP64 metadata but has no ZIP64 locator before the "
                f"end record. {LDRAW_ZIP_REMEDIATION}"
            )
        locator = struct.unpack_from("<4sLQL", payload, locator_offset)
        if locator[0] != ZIP64_LOCATOR_SIGNATURE or locator[1] != 0 or locator[3] != 1:
            raise ValueError(
                f"{label} has missing or multi-disk ZIP64 locator metadata. Split archives and "
                f"multi-disk sources are unsupported. {LDRAW_ZIP_REMEDIATION}"
            )
        zip64_offset = int(locator[2])
        if zip64_offset < 0 or zip64_offset + 56 > locator_offset:
            raise ValueError(
                f"{label} ZIP64 end record offset {zip64_offset} is outside the captured bytes. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        zip64_eocd = struct.unpack_from("<4sQ2H2L4Q", payload, zip64_offset)
        zip64_record_size = int(zip64_eocd[1])
        if (
            zip64_eocd[0] != ZIP64_EOCD_SIGNATURE
            or zip64_record_size < 44
            or zip64_offset + 12 + zip64_record_size > locator_offset
            or zip64_eocd[4] != 0
            or zip64_eocd[5] != 0
            or zip64_eocd[6] != zip64_eocd[7]
        ):
            raise ValueError(
                f"{label} has malformed, inconsistent, or multi-disk ZIP64 end metadata. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        disk_number = int(zip64_eocd[4])
        central_disk = int(zip64_eocd[5])
        entries_on_disk = int(zip64_eocd[6])
        entry_count = int(zip64_eocd[7])
        central_size = int(zip64_eocd[8])
        central_offset = int(zip64_eocd[9])
        directory_end_limit = zip64_offset
    if disk_number != 0 or central_disk != 0 or entries_on_disk != entry_count:
        raise ValueError(
            f"{label} is a split or multi-disk ZIP ({entries_on_disk}/{entry_count} entries on "
            f"disk {disk_number}/{central_disk}); only one complete archive is allowed. "
            f"{LDRAW_ZIP_REMEDIATION}"
        )
    if entry_count > MAX_LDRAW_ZIP_ENTRIES:
        raise ValueError(
            f"{label} declares {entry_count} ZIP entries; limit is {MAX_LDRAW_ZIP_ENTRIES}. "
            f"The count is rejected before ZipInfo allocation. {LDRAW_ZIP_REMEDIATION}"
        )
    if central_size > MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES:
        raise ValueError(
            f"{label} central directory is {central_size} bytes; limit is "
            f"{MAX_LDRAW_ZIP_CENTRAL_DIRECTORY_BYTES}. {LDRAW_ZIP_REMEDIATION}"
        )
    if entry_count > 0 and central_size < entry_count * 46:
        raise ValueError(
            f"{label} central directory declares {entry_count} entries in only {central_size} "
            f"bytes; at least {entry_count * 46} bytes are required. "
            f"{LDRAW_ZIP_REMEDIATION}"
        )
    if central_offset < 0 or central_size < 0 or central_offset + central_size > directory_end_limit:
        raise ValueError(
            f"{label} central directory range {central_offset}+{central_size} exceeds its "
            f"captured end boundary {directory_end_limit}. {LDRAW_ZIP_REMEDIATION}"
        )
    directory_end = central_offset + central_size
    if directory_end != directory_end_limit:
        raise ValueError(
            f"{label} central directory ends at byte {directory_end}, but its end record begins "
            f"at byte {directory_end_limit}. Trailing or prepended archive records are not "
            f"accepted. {LDRAW_ZIP_REMEDIATION}"
        )

    actual_entry_count = 0
    cursor = central_offset
    while cursor < directory_end:
        if cursor + 46 > directory_end:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} has fewer than the "
                f"required 46 header bytes at offset {cursor}. {LDRAW_ZIP_REMEDIATION}"
            )
        if payload[cursor : cursor + 4] != ZIP_CENTRAL_DIRECTORY_SIGNATURE:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} at offset {cursor} "
                f"does not start with a file-header signature. {LDRAW_ZIP_REMEDIATION}"
            )
        filename_size, extra_size, comment_size = struct.unpack_from(
            "<3H", payload, cursor + 28
        )
        row_size = 46 + filename_size + extra_size + comment_size
        if cursor + row_size > directory_end:
            raise ValueError(
                f"{label} central-directory row {actual_entry_count + 1} declares {row_size} "
                f"bytes at offset {cursor}, beyond directory end {directory_end}. "
                f"{LDRAW_ZIP_REMEDIATION}"
            )
        actual_entry_count += 1
        if actual_entry_count > MAX_LDRAW_ZIP_ENTRIES:
            raise ValueError(
                f"{label} contains more than {MAX_LDRAW_ZIP_ENTRIES} central-directory rows; "
                f"the raw count is rejected before ZipInfo allocation. {LDRAW_ZIP_REMEDIATION}"
            )
        cursor += row_size
    if actual_entry_count != entry_count:
        raise ValueError(
            f"{label} end metadata declares {entry_count} ZIP entries, but the bounded raw "
            f"central directory contains {actual_entry_count}; rejected before ZipInfo "
            f"allocation. {LDRAW_ZIP_REMEDIATION}"
        )


class LDrawLibrary:
    def __init__(
        self,
        sources: list[tuple[str, bytes]],
        closure_files: tuple[tuple[str, str, str, str], ...] | None = None,
    ) -> None:
        self.buffers: list[io.BytesIO] = []
        self.archives: list[zipfile.ZipFile] = []
        self.maps: list[dict[str, zipfile.ZipInfo]] = []
        self.labels: list[str] = []
        try:
            for label, payload in sources:
                preflight_zip_directory(payload, label)
                buffer = io.BytesIO(payload)
                self.buffers.append(buffer)
                try:
                    archive = zipfile.ZipFile(buffer, mode="r", allowZip64=True)
                except (zipfile.BadZipFile, zipfile.LargeZipFile) as error:
                    raise ValueError(
                        f"{label} is not a readable bounded ZIP archive: {error}. "
                        f"{LDRAW_ZIP_REMEDIATION}"
                    ) from error
                self.archives.append(archive)
                self.labels.append(label)
                infos = archive.infolist()
                if len(infos) > MAX_LDRAW_ZIP_ENTRIES:
                    raise ValueError(
                        f"{label} contains {len(infos)} ZIP entries; limit is "
                        f"{MAX_LDRAW_ZIP_ENTRIES}. {LDRAW_ZIP_REMEDIATION}"
                    )
                mapping: dict[str, zipfile.ZipInfo] = {}
                aggregate_size = 0
                for info in infos:
                    encoded_name_size = len(info.filename.encode("utf-8", "surrogatepass"))
                    if encoded_name_size > MAX_LDRAW_ZIP_FILENAME_BYTES:
                        raise ValueError(
                            f"{label} ZIP entry name is {encoded_name_size} bytes; limit is "
                            f"{MAX_LDRAW_ZIP_FILENAME_BYTES}: {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    normalized_name = info.filename.replace("\\", "/")
                    normalized_path = PurePosixPath(normalized_name)
                    if (
                        normalized_path.is_absolute()
                        or ".." in normalized_path.parts
                        or ":" in normalized_name
                    ):
                        raise ValueError(
                            f"{label} contains unsafe ZIP entry path {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    unix_mode = info.external_attr >> 16
                    if unix_mode != 0 and stat.S_ISLNK(unix_mode):
                        raise ValueError(
                            f"{label} contains symbolic-link ZIP entry {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.is_dir():
                        continue
                    if info.flag_bits & 0x1:
                        raise ValueError(
                            f"{label} contains encrypted ZIP entry {info.filename!r}; encrypted "
                            f"library members are unsupported. {LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} uses unsupported compression "
                            f"method {info.compress_type}; only stored or deflated members are "
                            f"allowed. {LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size < 0 or info.compress_size < 0:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} has negative size metadata. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size > MAX_LDRAW_ZIP_ENTRY_BYTES:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} expands to {info.file_size} "
                            f"bytes; per-entry limit is {MAX_LDRAW_ZIP_ENTRY_BYTES}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    if info.file_size > 0 and info.compress_size == 0:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} declares {info.file_size} "
                            f"expanded bytes from zero compressed bytes. {LDRAW_ZIP_REMEDIATION}"
                        )
                    compression_ratio = info.file_size / max(1, info.compress_size)
                    if compression_ratio > MAX_LDRAW_ZIP_COMPRESSION_RATIO:
                        raise ValueError(
                            f"{label} ZIP entry {info.filename!r} has compression ratio "
                            f"{compression_ratio:.2f}; limit is "
                            f"{MAX_LDRAW_ZIP_COMPRESSION_RATIO}. {LDRAW_ZIP_REMEDIATION}"
                        )
                    aggregate_size += info.file_size
                    if aggregate_size > MAX_LDRAW_ZIP_TOTAL_BYTES:
                        raise ValueError(
                            f"{label} expands to more than {MAX_LDRAW_ZIP_TOTAL_BYTES} bytes in "
                            f"aggregate (limit crossed at {info.filename!r}). "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    normalized = normalized_name.removeprefix("ldraw/").lower()
                    if normalized in mapping:
                        raise ValueError(
                            f"{label} repeats case-normalized entry {normalized!r} at "
                            f"{mapping[normalized].filename!r} and {info.filename!r}. "
                            f"{LDRAW_ZIP_REMEDIATION}"
                        )
                    mapping[normalized] = info
                self.maps.append(mapping)
        except BaseException:
            self.close()
            raise
        self.closure_by_path = (
            {record[0]: record for record in closure_files} if closure_files is not None else None
        )
        self.cache: dict[str, list[tuple[tuple[float, ...], ...]]] = {}
        self.used_closure_files: set[str] = set()

    def close(self) -> None:
        for archive in self.archives:
            archive.close()
        for buffer in self.buffers:
            buffer.close()

    @staticmethod
    def candidates(reference: str) -> list[str]:
        normalized = reference.replace("\\", "/").lower()
        path = PurePosixPath(normalized)
        if path.is_absolute() or ".." in path.parts or ":" in normalized:
            raise ValueError(f"Unsafe LDraw reference {reference!r}")
        if normalized.startswith("s/"):
            candidates = [f"parts/{normalized}", normalized]
        elif normalized.startswith(("8/", "48/")):
            candidates = [f"p/{normalized}", normalized]
        else:
            candidates = [f"parts/{normalized}", f"p/{normalized}", normalized]
        return list(dict.fromkeys(candidates))

    def read(self, reference: str) -> tuple[str, str]:
        for index, (archive, mapping) in enumerate(zip(self.archives, self.maps, strict=True)):
            for candidate in self.candidates(reference):
                stored = mapping.get(candidate)
                if stored is not None:
                    try:
                        with archive.open(stored, mode="r") as stream:
                            payload = stream.read(stored.file_size + 1)
                    except (OSError, RuntimeError, zipfile.BadZipFile) as error:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} failed bounded "
                            f"read/CRC verification: {error}. Re-acquire the exact pinned archive."
                        ) from error
                    if len(payload) != stored.file_size:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} yielded "
                            f"{len(payload)} bytes; central-directory size is {stored.file_size}. "
                            "Re-acquire the exact pinned archive; truncated or overlong members "
                            "are rejected."
                        )
                    try:
                        text = payload.decode("utf-8")
                    except UnicodeDecodeError as error:
                        raise ValueError(
                            f"{self.labels[index]} ZIP entry {stored.filename!r} is not UTF-8 at "
                            f"byte {error.start}. Re-acquire a standards-conforming pinned LDraw "
                            "archive; replacement decoding would change source text."
                        ) from error
                    expected = (
                        self.closure_by_path.get(candidate)
                        if self.closure_by_path is not None
                        else None
                    )
                    if self.closure_by_path is not None and (index != 0 or expected is None):
                        raise ValueError(
                            f"LDraw closure reached unpinned file {candidate!r} in "
                            f"{self.labels[index]}. Only the metadata-pinned 30565/80015 official "
                            "closure may contribute calibration geometry; review and pin any "
                            "source-graph change before rerunning."
                        )
                    if expected is not None:
                        _, expected_sha256, expected_author, expected_organization = expected
                        actual_sha256 = sha256(payload)
                        if actual_sha256 != expected_sha256:
                            raise ValueError(
                                f"LDraw closure file {candidate!r} SHA-256 is {actual_sha256}; "
                                f"expected {expected_sha256}. Re-acquire the exact pinned archive; "
                                "do not update the closure for replacement bytes."
                            )
                        required_headers = (
                            f"0 Author: {expected_author}",
                            f"0 !LICENSE {LDRAW_CLOSURE_LICENSE}",
                            f"0 !LDRAW_ORG {expected_organization}",
                        )
                        stripped_lines = [line.strip() for line in text.splitlines()]
                        for required_header in required_headers:
                            count = stripped_lines.count(required_header)
                            if count != 1:
                                raise ValueError(
                                    f"LDraw closure file {candidate!r} contains {count} exact "
                                    f"{required_header!r} headers; expected 1. Re-acquire the exact "
                                    "pinned archive and preserve file-level author/license/status "
                                    "provenance."
                                )
                        self.used_closure_files.add(candidate)
                    return f"zip:{index}:{candidate}", text
        raise FileNotFoundError(
            f"LDraw reference not found: {reference}. Verify the reviewed root identifier and "
            "both pinned archives; substitution is not allowed."
        )

    def assert_complete_closure(self) -> None:
        if self.closure_by_path is None:
            return
        expected = set(self.closure_by_path)
        if self.used_closure_files != expected:
            missing = sorted(expected - self.used_closure_files)
            unexpected = sorted(self.used_closure_files - expected)
            raise ValueError(
                f"LDraw 30565/80015 transitive closure differs from its metadata pin; "
                f"missing={missing}, unexpected={unexpected}. Re-acquire the exact archives or "
                "review and pin the complete changed graph before generating evidence."
            )

    def triangles(self, reference: str, stack: tuple[str, ...] = ()):
        key, text = self.read(reference)
        if key in self.cache:
            return self.cache[key]
        if key in stack:
            raise ValueError(f"Recursive LDraw reference: {' -> '.join((*stack, key))}")
        if len(stack) >= 64:
            raise ValueError(f"LDraw recursion exceeds 64 at {reference}")
        result: list[tuple[tuple[float, ...], ...]] = []
        for line_number, raw in enumerate(text.splitlines(), 1):
            fields = raw.strip().split()
            if not fields:
                continue
            try:
                if fields[0] == "1" and len(fields) >= 15:
                    translation = tuple(map(float, fields[2:5]))
                    matrix = tuple(map(float, fields[5:14]))
                    child = self.triangles(" ".join(fields[14:]), (*stack, key))
                    result.extend(
                        tuple(transform_point(matrix, translation, point) for point in triangle)
                        for triangle in child
                    )
                elif fields[0] == "3" and len(fields) >= 11:
                    values = list(map(float, fields[2:11]))
                    result.append(tuple(tuple(values[index : index + 3]) for index in (0, 3, 6)))
                elif fields[0] == "4" and len(fields) >= 14:
                    values = list(map(float, fields[2:14]))
                    quad = [tuple(values[index : index + 3]) for index in (0, 3, 6, 9)]
                    result.extend(((quad[0], quad[1], quad[2]), (quad[0], quad[2], quad[3])))
            except ValueError as error:
                raise ValueError(f"Malformed LDraw numeric record {key}:{line_number}: {error}") from error
            if len(result) > 2_000_000:
                raise ValueError(f"Expanded LDraw triangle cap exceeded for {reference}")
        self.cache[key] = result
        return result


def encode_shell(report: dict[str, object], design: dict[str, object]) -> tuple[bytes, list[tuple[float, ...]]]:
    source = design["sourceIdentity"]
    expected_keys = {"schemaVersion", "bundleSha256", "shellPathId", "shellCanonicalSha256", "verticesLdu", "triangles"}
    if set(report) != expected_keys or report["schemaVersion"] != "lego.builder-shell-inspection/2":
        raise ValueError(f"{design['designRevision']} Shell inspection has unexpected keys or schema")
    for key in ("bundleSha256", "shellPathId", "shellCanonicalSha256"):
        if report[key] != source[key]:
            raise ValueError(f"{design['designRevision']} Shell inspection {key} differs from pin")
    vertices = [tuple(map(float, point)) for point in report["verticesLdu"]]
    triangles = [tuple(map(int, triangle)) for triangle in report["triangles"]]
    if len(vertices) != source["shellVertexCount"] or len(triangles) != source["shellTriangleCount"]:
        raise ValueError(f"{design['designRevision']} Shell inspection count differs from pin")
    payload = bytearray()
    flattened: list[tuple[float, ...]] = []
    for triangle in triangles:
        if len(triangle) != 3 or any(index < 0 or index >= len(vertices) for index in triangle):
            raise ValueError(f"{design['designRevision']} has an invalid triangle index")
        points = [vertices[index] for index in triangle]
        a, b, c = points
        ab = tuple(b[i] - a[i] for i in range(3))
        ac = tuple(c[i] - a[i] for i in range(3))
        cross = (ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])
        if sum(value * value for value in cross) <= 1e-12:
            raise ValueError(f"{design['designRevision']} contains a degenerate Shell triangle")
        for point in points:
            if any(not math.isfinite(value) for value in point):
                raise ValueError(f"{design['designRevision']} contains a non-finite Shell vertex")
            encoded = struct.pack("<fff", point[0] * 0.04, -point[1] * 0.04, point[2] * 0.04)
            payload.extend(encoded)
            x, y, z = struct.unpack("<fff", encoded)
            flattened.append((x / 0.04, -y / 0.04, z / 0.04))
    reference = design["builderGeometry"]
    if len(payload) != reference["byteLength"] or f"sha256:{sha256(payload)}" != reference["digest"]:
        raise ValueError(f"{design['designRevision']} Builder triangle slice differs from reviewed pin")
    return bytes(payload), flattened


def encode_ldraw(triangles: Iterable[tuple[tuple[float, ...], ...]], design: dict[str, object]) -> bytes:
    payload = bytearray()
    count = 0
    for triangle in triangles:
        count += 1
        for point in triangle:
            if any(not math.isfinite(value) for value in point):
                raise ValueError(f"{design['designRevision']} expanded LDraw contains non-finite data")
            payload.extend(struct.pack("<fff", *point))
    reference = design["ldrawReferenceGeometry"]
    if count != reference["triangleCount"] or len(payload) != reference["byteLength"]:
        raise ValueError(f"{design['designRevision']} expanded LDraw count differs from reviewed pin")
    if f"sha256:{sha256(payload)}" != reference["digest"]:
        raise ValueError(f"{design['designRevision']} expanded LDraw slice differs from reviewed pin")
    return bytes(payload)


def point_segment_distance(point, start, end) -> float:
    direction = tuple(end[i] - start[i] for i in range(3))
    denominator = sum(value * value for value in direction)
    ratio = 0 if denominator <= 1e-24 else max(0.0, min(1.0, sum((point[i] - start[i]) * direction[i] for i in range(3)) / denominator))
    closest = tuple(start[i] + ratio * direction[i] for i in range(3))
    return math.dist(point, closest)


def point_triangle_distance(point, triangle) -> float:
    a, b, c = triangle
    ab = tuple(b[i] - a[i] for i in range(3)); ac = tuple(c[i] - a[i] for i in range(3)); ap = tuple(point[i] - a[i] for i in range(3))
    dot = lambda left, right: sum(left[i] * right[i] for i in range(3))
    d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0 and d2 <= 0: return math.dist(point, a)
    bp = tuple(point[i] - b[i] for i in range(3)); d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0 and d4 <= d3: return math.dist(point, b)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        ratio = d1 / (d1 - d3); return math.dist(point, tuple(a[i] + ratio * ab[i] for i in range(3)))
    cp = tuple(point[i] - c[i] for i in range(3)); d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0 and d5 <= d6: return math.dist(point, c)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        ratio = d2 / (d2 - d6); return math.dist(point, tuple(a[i] + ratio * ac[i] for i in range(3)))
    va = d3 * d6 - d5 * d4
    if va <= 0 and d4 - d3 >= 0 and d5 - d6 >= 0:
        ratio = (d4 - d3) / (d4 - d3 + d5 - d6); return math.dist(point, tuple(b[i] + ratio * (c[i] - b[i]) for i in range(3)))
    denominator = va + vb + vc
    if abs(denominator) <= 1e-24: return min(point_segment_distance(point, a, b), point_segment_distance(point, b, c), point_segment_distance(point, c, a))
    v, w = vb / denominator, vc / denominator
    return math.dist(point, tuple(a[i] + ab[i] * v + ac[i] * w for i in range(3)))


def decode_reference(payload: bytes):
    return [tuple(tuple(struct.unpack_from("<fff", payload, offset + point * 12)) for point in range(3)) for offset in range(0, len(payload), 36)]


def frame_report(design: dict[str, object], builder_points, reference_payload: bytes, bundle_digest: str):
    frame = derive_frame(design["catalogStudCenters"], design["builderStudCentersLdu"])
    orientation = next(matrix for name, matrix in ORIENTATIONS if name == frame["orientationId"])
    translation = frame["positionLdu"]
    unique = list(dict.fromkeys(builder_points))
    triangles = [tuple((point[0], point[1] - 4, point[2]) for point in triangle) for triangle in decode_reference(reference_payload)]
    distances: list[int] = []
    for point in unique:
        translated = tuple(point[i] - translation[i] for i in range(3))
        catalog = tuple(sum(orientation[row * 3 + column] * translated[row] for row in range(3)) for column in range(3))
        distances.append(round(min(point_triangle_distance(catalog, triangle) for triangle in triangles) * 1_000_000))
    if len(unique) != design["uniqueBuilderVertexCount"]:
        raise ValueError(f"{design['designRevision']} unique Builder vertex count differs from pin")
    ordered = sorted(distances); p95 = ordered[max(0, math.ceil(len(ordered) * 0.95) - 1)]; maximum = ordered[-1]
    if p95 > 2_000_000 or maximum > 2_000_000:
        raise ValueError(f"{design['designRevision']} surface exceeds 2 LDU: p95={p95}, max={maximum}")
    source = {key: value for key, value in design.items() if key not in ("designId", "catalogStudCenters")}
    trusted_source_digest = sha_value(source)
    input_value = {
        "protocol": EVIDENCE_PROTOCOL,
        "catalogVersion": CATALOG_VERSION,
        "catalogDefinitionDigest": design["expectedCatalogDefinitionDigest"],
        "catalogGeometryDigest": design["expectedCatalogGeometryDigest"],
        "connectorFrameDigest": design["expectedCatalogConnectorDigest"],
        "collisionFrameDigest": design["expectedCatalogCollisionDigest"],
        "trustedSourceDigest": trusted_source_digest,
        "builderGeometryBundleDigest": f"sha256:{bundle_digest}",
        "catalogToBuilderLocalTransform": frame,
    }
    input_digest = sha_value(input_value)
    return {
        "designRevision": design["designRevision"], "catalogPartId": design["catalogPartId"], "catalogVersion": CATALOG_VERSION,
        "trustedSourceDigest": trusted_source_digest,
        "catalogDefinitionDigest": design["expectedCatalogDefinitionDigest"], "catalogGeometryDigest": design["expectedCatalogGeometryDigest"],
        "connectorFrameDigest": design["expectedCatalogConnectorDigest"], "collisionFrameDigest": design["expectedCatalogCollisionDigest"],
        "catalogToBuilderLocalTransform": frame,
        "verification": {"protocol": EVIDENCE_PROTOCOL, "inputDigest": input_digest, "evidenceDigest": sha_value({"inputDigest": input_digest, "distancesMicroLdu": distances}),
                         "uniqueBuilderVertexCount": len(unique), "builderTriangleCount": design["builderGeometry"]["triangleCount"], "ldrawTriangleCount": design["ldrawReferenceGeometry"]["triangleCount"],
                         "p95SurfaceDistanceMicroLdu": p95, "maximumSurfaceDistanceMicroLdu": maximum},
    }


def validate_reports(cache: dict[str, object], audit: dict[str, object]) -> None:
    cache_by_id = {str(entry["id"]): entry for entry in cache["bundles"]}
    audit_by_id = {str(entry["id"]): entry for entry in audit["parts"]}
    for design in DESIGNS:
        source = design["sourceIdentity"]; design_id = design["designId"]
        cached, audited = cache_by_id.get(design_id), audit_by_id.get(design_id)
        if cached is None or audited is None or not cached["verified"]:
            raise ValueError(f"Source reports do not contain one verified {design_id}")
        if f"sha256:{cached['sha256']}" != source["bundleSha256"] or f"md5:{cached['manifestMd5']}" != source["manifestMd5"]:
            raise ValueError(f"Cache report identity differs for {design_id}")
        shell = [mesh for mesh in audited["meshes"] if mesh["name"] == "Shell"]
        if len(shell) != 1 or str(shell[0]["pathId"]) != source["shellPathId"] or f"sha256:{shell[0]['canonicalSha256']}" != source["shellCanonicalSha256"]:
            raise ValueError(f"Audit Shell identity differs for {design_id}")
        if f"sha256:{audited['primitiveXmlSha256']}" != source["primitiveXmlSha256"]:
            raise ValueError(f"Audit primitive XML identity differs for {design_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the exact retained step-1 Builder v6 evidence.")
    parser.add_argument("--official-model", type=Path, required=True); parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--cache-report", type=Path, required=True); parser.add_argument("--asset-audit", type=Path, required=True)
    parser.add_argument("--ldraw-official", type=Path, required=True); parser.add_argument("--ldraw-unofficial", type=Path, required=True)
    parser.add_argument("--shell-30565", type=Path, required=True); parser.add_argument("--shell-80015", type=Path, required=True)
    parser.add_argument("--out-geometry", type=Path, required=True); parser.add_argument("--out-calibration", type=Path, required=True)
    args = parser.parse_args()

    actual_closure_digest = sha256(canonical_json(LDRAW_CLOSURE_MANIFEST))
    if actual_closure_digest != LDRAW_CLOSURE_DIGEST:
        raise ValueError(
            f"Embedded LDraw closure manifest SHA-256 is {actual_closure_digest}; expected "
            f"{LDRAW_CLOSURE_DIGEST}. Restore the reviewed metadata pin before reading source "
            "archives."
        )

    verified_bytes(args.official_model, OFFICIAL_MODEL_DIGEST, "Official model", 16 * 1024 * 1024)
    verified_bytes(args.manifest, MANIFEST_DIGEST, "Builder manifest", 1_000_000)
    cache = json.loads(verified_bytes(args.cache_report, CACHE_REPORT_DIGEST, "Builder cache report", 1_000_000))
    audit = json.loads(verified_bytes(args.asset_audit, AUDIT_REPORT_DIGEST, "Builder asset audit", 4_000_000))
    validate_reports(cache, audit)
    ldraw_official = verified_bytes(
        args.ldraw_official,
        LDRAW_OFFICIAL_DIGEST,
        "Official LDraw archive",
        200_000_000,
    )
    ldraw_unofficial = verified_bytes(
        args.ldraw_unofficial,
        LDRAW_UNOFFICIAL_DIGEST,
        "Unofficial LDraw archive",
        120_000_000,
    )

    shell_reports = [
        json.loads(bounded_bytes(args.shell_30565, 1_000_000, "30565 Shell report")),
        json.loads(bounded_bytes(args.shell_80015, 1_000_000, "80015 Shell report")),
    ]
    builder_slices: list[bytes] = []; builder_points: list[list[tuple[float, ...]]] = []
    for report, design in zip(shell_reports, DESIGNS, strict=True):
        encoded, points = encode_shell(report, design); builder_slices.append(encoded); builder_points.append(points)
    library = LDrawLibrary(
        [
            ("Official LDraw archive", ldraw_official),
            ("Unofficial LDraw archive", ldraw_unofficial),
        ],
        LDRAW_CLOSURE_FILES,
    )
    try:
        ldraw_slices = [encode_ldraw(library.triangles(f"{design['designId']}.dat"), design) for design in DESIGNS]
        library.assert_complete_closure()
    finally:
        library.close()
    geometry = b"".join((*builder_slices, *ldraw_slices)); geometry_digest = sha256(geometry)
    if len(geometry) != 122_688 or geometry_digest != EXPECTED_GEOMETRY_DIGEST:
        raise ValueError(f"Combined geometry differs: {len(geometry)} bytes sha256:{geometry_digest}; expected 122688/sha256:{EXPECTED_GEOMETRY_DIGEST}")
    frames = [frame_report(design, points, reference, geometry_digest) for design, points, reference in zip(DESIGNS, builder_points, ldraw_slices, strict=True)]
    calibration = {
        "schemaVersion": "lego.builder-canonical-calibration/6", "officialModelDigest": f"sha256:{OFFICIAL_MODEL_DIGEST}",
        "geometryBundle": {"format": "lego.builder-shell-and-ldraw-triangles-f32le/2", "byteLength": len(geometry), "digest": f"sha256:{geometry_digest}"},
        "cases": CASES, "originPolicy": ORIGIN_POLICY, "designFrames": frames,
    }
    write_atomic(args.out_geometry.resolve(), geometry); write_atomic(args.out_calibration.resolve(), canonical_json(calibration))
    print(json.dumps({"geometry": str(args.out_geometry.resolve()), "geometryBytes": len(geometry), "geometrySha256": geometry_digest,
                      "calibration": str(args.out_calibration.resolve()), "calibrationSha256": sha256(canonical_json(calibration)),
                      "frames": [{"designRevision": frame["designRevision"], **frame["verification"]} for frame in frames]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
