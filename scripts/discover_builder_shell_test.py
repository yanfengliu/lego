from __future__ import annotations
import hashlib
import math
import tempfile
import unittest
from unittest import mock

from discover_builder_shell_publication_test import (  # noqa: F401  - collected by unittest.main
    FilesystemAndWorkerTests,
)
from discover_builder_shell_test_support import (
    CORE,
    DISCOVERY,
    FakeHandler,
    FakeObject,
    META,
    Path,
    SimpleNamespace,
    environment,
    mesh_value,
    text_value,
    valid_report,
)


class DiscoveryBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeHandler.process_calls = 0

    def test_never_adds_3245_to_supported_shells(self) -> None:
        supported = DISCOVERY.EXTRACTOR.SUPPORTED_SHELLS
        self.assertFalse(any(row.get("designRevision", "").startswith("3245") for row in supported))
        self.assertFalse(any(row.get("bundleSha256") == DISCOVERY.BUNDLE_SHA256 for row in supported))

    def test_enumeration_reads_only_bounded_candidate_names_and_decodes_nothing(self) -> None:
        fixture, objects = environment()
        shell, primitive, partinfo = DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual((shell.path_id, primitive.path_id, partinfo.path_id), ("3", "4", "5"))
        self.assertEqual(objects["arbitrary"].peek_calls, 0)
        self.assertEqual(objects["arbitrary"].read_calls, 0)
        self.assertEqual(sum(value.read_calls for value in objects.values()), 0)
        self.assertEqual(objects["other"].peek_calls, 1)

    def test_build_report_is_finite_canonical_deterministic_and_quarantined(self) -> None:
        payload = b"synthetic exact capture"
        digest = hashlib.sha256(payload).hexdigest()
        reports: list[bytes] = []
        for _ in range(2):
            fixture, objects = environment()
            with mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest):
                report = DISCOVERY.build_report(payload, lambda seen: fixture if seen == payload else None, FakeHandler)
                reports.append(DISCOVERY.canonical_json_bytes(report))
            self.assertEqual(objects["shell"].read_calls, 1)
            self.assertEqual(objects["primitive"].read_calls, 1)
            self.assertEqual(objects["partinfo"].read_calls, 1)
            self.assertEqual(objects["other"].read_calls, 0)
            self.assertEqual(report["shell"]["canonicalVertices"], 3)
            self.assertEqual(report["primitiveXml"]["connectorCenters"][0]["center"], [2.0, 3.0, 4.0])
            self.assertEqual(report["partInfo"]["identity"], {"designId": "3245", "name": "Fixture", "revision": "M"})
            self.assertIs(report["catalogAdmitted"], False)
            self.assertIs(report["supported"], False)
        self.assertEqual(reports[0], reports[1])
        self.assertNotIn(b"NaN", reports[0])
        self.assertNotIn(b"Infinity", reports[0])

    def test_retained_bundle_refuses_to_parse_outside_the_pinned_environment(self) -> None:
        """The pinned distribution set is the barrier, not the interpreter version.

        Regression for the false safety rationale: `where python` on this machine
        resolves to a conforming 64-bit CPython 3.13 under which
        `validate_worker_runtime()` returns cleanly, so the interpreter gate alone
        never prevented a real decode. Simulating a fully conforming interpreter
        here must still leave the retained bundle unparseable.
        """
        payload = b"stand-in for the exact retained 3245-M capture"
        digest = hashlib.sha256(payload).hexdigest()
        loader = mock.Mock(side_effect=AssertionError("retained bundle must not be parsed"))
        handler = mock.Mock(side_effect=AssertionError("retained bundle must not be decoded"))
        snapshot = DISCOVERY.SNAPSHOT
        with (
            mock.patch.multiple(CORE, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest),
            mock.patch.multiple(META, BUNDLE_BYTES=len(payload), BUNDLE_SHA256=digest),
            mock.patch.object(snapshot, "validate_worker_runtime"),
            tempfile.TemporaryDirectory() as directory,
        ):
            with self.assertRaisesRegex(ValueError, "without a pinned snapshot root") as missing:
                DISCOVERY.build_report(payload, loader, handler)
            with self.assertRaisesRegex(
                ValueError, "not the exact pinned distribution set"
            ) as unpinned:
                DISCOVERY.build_report(payload, loader, handler, snapshot_root=Path(directory))
        loader.assert_not_called()
        handler.assert_not_called()
        for raised in (missing, unpinned):
            message = str(raised.exception)
            self.assertIn("interpreter check is NOT the barrier", message)
            self.assertIn(f"pip install UnityPy=={snapshot.UNITYPY_VERSION}", message)
            self.assertIn(snapshot.PINNED_ENVIRONMENT_DIGEST, message)
            self.assertIn(f"exactly the {len(snapshot.PINNED_DISTRIBUTIONS)} pinned", message)

    def test_wrong_bundle_identity_fails_before_loader(self) -> None:
        loader = mock.Mock(side_effect=AssertionError("wrong bundle must not be parsed"))
        with self.assertRaisesRegex(ValueError, "exact quarantined"):
            DISCOVERY.build_report(b"wrong", loader, FakeHandler)
        loader.assert_not_called()

    def test_missing_and_duplicate_shell_fail_without_decoding(self) -> None:
        fixture, objects = environment(partinfo=False)
        fixture.objects.remove(objects["shell"])
        with self.assertRaisesRegex(ValueError, "exactly one Mesh named Shell; found 0"):
            DISCOVERY.enumerate_candidates(fixture)
        duplicate = FakeObject("Mesh", "Shell", 30, 128, mesh_value(), forbid_read=True)
        fixture, objects = environment(partinfo=False)
        fixture.objects.append(duplicate)
        with self.assertRaisesRegex(ValueError, "exactly one Mesh named Shell; found 2"):
            DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual(objects["shell"].read_calls, 0)
        self.assertEqual(duplicate.read_calls, 0)

    def test_object_candidate_and_serialized_bounds_precede_metadata_or_decode(self) -> None:
        fixture, _ = environment(partinfo=False)
        fixture.objects = [FakeObject("Texture2D", "a", 1, 1), FakeObject("Texture2D", "b", 2, 1), FakeObject("Texture2D", "c", 3, 1)]
        with mock.patch.object(META, "MAX_OBJECTS", 2), self.assertRaisesRegex(ValueError, "more than 2 objects"):
            DISCOVERY.enumerate_candidates(fixture)
        oversized = FakeObject("Mesh", "Shell", 9, META.MAX_SERIALIZED_BYTES + 1, forbid_peek=True, forbid_read=True)
        fixture = SimpleNamespace(objects=[oversized], container={})
        with self.assertRaisesRegex(ValueError, "serialized size"):
            DISCOVERY.enumerate_candidates(fixture)
        self.assertEqual((oversized.peek_calls, oversized.read_calls), (0, 0))
        fixture, _ = environment(partinfo=False)
        with mock.patch.object(META, "MAX_NAMED_CANDIDATES", 1), self.assertRaisesRegex(ValueError, "more than 1 bounded named candidates"):
            DISCOVERY.enumerate_candidates(fixture)

    def test_duplicate_primitive_and_partinfo_metadata_are_rejected(self) -> None:
        fixture, objects = environment()
        fixture.objects.append(FakeObject("TextAsset", "Connectivity.xml", 6, 80, forbid_read=True))
        with self.assertRaisesRegex(ValueError, "exactly one bounded primitive XML"):
            DISCOVERY.enumerate_candidates(fixture)
        fixture, objects = environment()
        fixture.objects.append(FakeObject("TextAsset", "PartInformation.json", 7, 80, forbid_read=True))
        with self.assertRaisesRegex(ValueError, "identity is ambiguous"):
            DISCOVERY.enumerate_candidates(fixture)

    def test_compressed_declaration_bound_fails_before_mesh_processing(self) -> None:
        packed = SimpleNamespace(m_NumItems=DISCOVERY.EXTRACTOR.MAX_VERTICES * 8 + 1, m_Data=b"")
        compressed = SimpleNamespace(m_Vertices=packed)
        candidate = DISCOVERY.Candidate(
            FakeObject("Mesh", "Shell", 3, 128, mesh_value(compressed=compressed)),
            "3",
            "Shell",
            128,
            (),
        )
        with self.assertRaisesRegex(ValueError, "compressed m_Vertices item count"):
            DISCOVERY.shell_report(candidate, FakeHandler)
        self.assertEqual(FakeHandler.process_calls, 0)

    def test_decoded_empty_group_bound_fails_before_over_limit_group_append(self) -> None:
        class ForbiddenGroup:
            def __iter__(self) -> object:
                raise AssertionError("over-limit empty group must not be visited")

        class EmptyGroupHandler(FakeHandler):
            def get_triangles(self) -> object:
                return iter(([], [], ForbiddenGroup()))

        candidate = DISCOVERY.Candidate(
            FakeObject("Mesh", "Shell", 3, 128, mesh_value()), "3", "Shell", 128, ()
        )
        with (
            mock.patch.object(CORE.EXTRACTOR, "MAX_SUBMESHES", 2),
            self.assertRaisesRegex(ValueError, "exceeds 2 triangle groups"),
        ):
            DISCOVERY.shell_report(candidate, EmptyGroupHandler)


class MetadataParserTests(unittest.TestCase):
    @staticmethod
    def candidate(name: str, payload: str) -> object:
        reader = FakeObject("TextAsset", name, 4, 200, text_value(name, payload))
        return DISCOVERY.Candidate(reader, "4", name, 200, ())

    def test_primitive_rejects_dtd_malformed_transform_nonfinite_and_bounds(self) -> None:
        payloads = (
            '<!DOCTYPE x [<!ENTITY x "boom">]><Primitive><Connectivity/></Primitive>',
            '<Primitive><Connectivity><Fixed transform="1,2"/></Connectivity></Primitive>',
            '<Primitive><Connectivity><Fixed transform="1,0,0,0,1,0,0,0,1,2,3,NaN"/></Connectivity></Primitive>',
        )
        patterns = ("forbidden DTD", "expected 12", "non-finite")
        for payload, pattern in zip(payloads, patterns, strict=True):
            with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                DISCOVERY.primitive_report(self.candidate("Primitive.xml", payload))
        nested = '<Primitive><Connectivity><Group><Fixed transform="1,0,0,0,1,0,0,0,1,2,3,4"/></Group></Connectivity></Primitive>'
        with mock.patch.object(META, "MAX_XML_NODES", 3), self.assertRaisesRegex(ValueError, "node/depth bounds"):
            DISCOVERY.primitive_report(self.candidate("Primitive.xml", nested))

    def test_partinfo_rejects_wrong_conflicting_or_nonfinite_identity(self) -> None:
        fixtures = (
            ('{"designId":"9999"}', "exact design 3245"),
            ('{"designId":"3245","revision":"N"}', "revision conflicts"),
            ('{"designId":"3245","nested":{"designId":"9999"}}', "exact design 3245"),
            ('{"designId":"3245","score":NaN}', "non-finite JSON"),
            ('{"designId":"3245","designId":"3245"}', "repeats JSON key"),
        )
        for payload, pattern in fixtures:
            with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                DISCOVERY.partinfo_report(self.candidate("PartInfo.json", payload))

    def test_report_validator_rejects_authority_tampering_extra_fields_and_nonfinite(self) -> None:
        report = valid_report()
        DISCOVERY.validate_report(report)
        report["supported"] = True
        with self.assertRaisesRegex(ValueError, "quarantine authority"):
            DISCOVERY.validate_report(report)
        report = valid_report()
        report["authority"] = "self-certified"
        with self.assertRaisesRegex(ValueError, "unexpected schema"):
            DISCOVERY.validate_report(report)
        report = valid_report()
        report["primitiveXml"]["connectorCenters"][0]["center"][0] = math.inf
        with self.assertRaisesRegex(ValueError, "bounded finite triple"):
            DISCOVERY.validate_report(report)
        with self.assertRaisesRegex(ValueError, "repeats JSON key"):
            DISCOVERY.strict_json_loads(b'{"a":1,"a":2}', "Fixture")



if __name__ == "__main__":
    unittest.main()
