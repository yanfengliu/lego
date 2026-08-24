from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CORE = load("identify_builder_3245_variant_core_test", "identify_builder_3245_variant_core.py")
REPORT = load(
    "identify_builder_3245_variant_report_test", "identify_builder_3245_variant_report.py"
)


class Reader:
    def __init__(self, type_name: str, name: str, path_id: int, value=None) -> None:
        self.type = SimpleNamespace(name=type_name)
        self.name = name
        self.path_id = path_id
        self.byte_size = 128
        self.value = value
        self.peek_calls = 0
        self.read_calls = 0

    def peek_name(self):
        self.peek_calls += 1
        return self.name

    def read(self):
        self.read_calls += 1
        return self.value


class Handler:
    def __init__(self, _mesh) -> None:
        self.m_Vertices = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]

    def process(self) -> None:
        return None

    def get_triangles(self):
        return [[(0, 1, 2)]]


def mesh():
    return SimpleNamespace(
        m_Name="Shell",
        m_VertexData=SimpleNamespace(m_VertexCount=3, m_DataSize=b"v" * 36),
        m_SubMeshes=[SimpleNamespace(topology=0, indexCount=3)],
    )


def public_report():
    frame_rows = [
        {"frame": {"name": "turn0"}},
        {"frame": {"name": "turn180"}},
    ]
    return {
        "catalogAdmitted": False,
        "geometry": {
            "candidateMeasurements": [
                {"root": "parts/3245a.dat", "frames": copy.deepcopy(frame_rows)},
                {"root": "parts/3245b.dat", "frames": copy.deepcopy(frame_rows)},
                {"root": "parts/3245c.dat", "frames": copy.deepcopy(frame_rows)},
            ],
            "comparisonStatus": "unresolved-no-predeclared-decisive-margin",
            "frameDerivation": {
                "builderNativeBasisLinearLdu": [25, 0, 0, 0, -25, 0, 0, 0, -25],
                "builderNativeFrameId": "lego-builder-native-to-catalog-ldu/1",
                "mirroredRegistrationsAdmitted": False,
            },
            "instrument": {
                "controls": {
                    "allPassed": True,
                    "contains3245Data": False,
                    "population": 4,
                },
                "tessellationInvariant": False,
            },
            "isolatedDecodes": 2,
            "strongestProvedResult": {"admissionDecisionSupported": False},
        },
        "inputIdentities": copy.deepcopy(REPORT.EXPECTED_INPUT_IDENTITIES),
        "schemaVersion": REPORT.SCHEMA_VERSION,
        "sourceAuthority": {
            "authorityResolved": False,
            "derivedModelLdrawCrossCheck": REPORT.derived_ldr_crosscheck(
                b"1 0 0 0 0 1 0 0 0 1 0 0 0 1 3245b.dat\n" * 10
            ),
            "manifestContradiction": {"resolved": False},
        },
        "status": "quarantined-source-evidence-only",
        "supported": False,
        "unresolvedReasons": REPORT.UNRESOLVED_REASONS.copy(),
        "verdict": "unresolved",
    }


class GeometryInstrumentTests(unittest.TestCase):
    def test_independent_controls_cover_diagonal_shift_and_missing_surface(self) -> None:
        controls = CORE.instrument_controls()
        self.assertIs(controls["contains3245Data"], False)
        self.assertEqual(controls["population"], 4)
        self.assertIs(controls["allPassed"], True)
        self.assertEqual(controls["cases"][0]["measuredRmsLdu"], 0.0)

    def test_shared_body_frame_leaves_only_the_parts_180_degree_symmetry(self) -> None:
        vertices = [
            (x, y, z)
            for x in (-1.2, 0.4)
            for y in (0.0, 1.92)
            for z in (-0.4, 0.4)
        ]
        frames = CORE.same_frame_candidates(vertices)
        self.assertEqual([frame.name for frame in frames], ["turn0", "turn180"])
        for frame in frames:
            self.assertEqual(CORE.finite_bounds(frame.apply(point) for point in vertices), [
                [-20.0, 0.0, -10.0],
                [20.0, 48.0, 10.0],
            ])

    def test_symmetric_surface_distance_handles_opposite_diagonal_and_is_two_sided(self) -> None:
        exact = CORE._rectangle_x(0.0)
        retessellated = CORE._rectangle_x(0.0, True)
        shifted = CORE._rectangle_x(4.0)
        self.assertEqual(CORE._synthetic_rms(exact, retessellated), 0.0)
        self.assertGreaterEqual(CORE._synthetic_rms(exact, shifted), 3.0)
        self.assertGreaterEqual(CORE._synthetic_rms((*exact, *shifted), exact), 2.0)

    def test_derived_ldr_b_rows_are_retained_only_as_counterevidence(self) -> None:
        payload = b"1 0 0 0 0 1 0 0 0 1 0 0 0 1 3245b.dat\n" * 10
        crosscheck = REPORT.derived_ldr_crosscheck(payload)
        self.assertEqual(crosscheck["references"], [{"count": 10, "root": "3245b.dat"}])
        self.assertIs(crosscheck["officialSelectionAuthority"], False)
        with self.assertRaisesRegex(ValueError, "exactly ten"):
            REPORT.derived_ldr_crosscheck(payload.replace(b"3245b.dat", b"3245c.dat", 1))

    def test_shell_decode_reads_only_the_one_exact_named_mesh(self) -> None:
        arbitrary = Reader("Texture2D", "not inspected", 1)
        other = Reader("Mesh", "NotShell", 2, mesh())
        shell = Reader("Mesh", "Shell", 3, mesh())
        report = CORE.decode_shell(SimpleNamespace(objects=[arbitrary, other, shell]), Handler)
        self.assertEqual((arbitrary.peek_calls, arbitrary.read_calls), (0, 0))
        self.assertEqual((other.peek_calls, other.read_calls), (1, 0))
        self.assertEqual((shell.peek_calls, shell.read_calls), (1, 1))
        self.assertEqual((len(report["vertices"]), report["triangles"]), (3, 1))

    def test_shell_decode_refuses_count_and_index_drift(self) -> None:
        value = mesh()
        value.m_VertexData.m_VertexCount = 4
        with self.assertRaisesRegex(ValueError, "declaration says 4"):
            CORE.decode_shell(SimpleNamespace(objects=[Reader("Mesh", "Shell", 3, value)]), Handler)


class PublicReportBoundaryTests(unittest.TestCase):
    def test_only_complete_unresolved_quarantine_report_passes(self) -> None:
        report = public_report()
        self.assertIs(REPORT.validate_report(report), report)

    def test_geometry_cannot_self_certify_selection_or_authority(self) -> None:
        mutations = (
            ("catalogAdmitted", True, "quarantine authority"),
            ("verdict", "parts/3245c.dat", "quarantine authority"),
            ("supported", True, "quarantine authority"),
        )
        for key, value, pattern in mutations:
            report = public_report()
            report[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, pattern):
                REPORT.validate_report(report)
        report = public_report()
        report["sourceAuthority"]["authorityResolved"] = True
        with self.assertRaisesRegex(ValueError, "self-certify"):
            REPORT.validate_report(report)
        report = public_report()
        report["geometry"]["strongestProvedResult"]["admissionDecisionSupported"] = True
        with self.assertRaisesRegex(ValueError, "publish a selection"):
            REPORT.validate_report(report)
        report = public_report()
        report["geometry"]["instrument"]["tessellationInvariant"] = True
        with self.assertRaisesRegex(ValueError, "incomplete"):
            REPORT.validate_report(report)
        report = public_report()
        report["geometry"]["frameDerivation"]["mirroredRegistrationsAdmitted"] = True
        with self.assertRaisesRegex(ValueError, "proper Builder native basis"):
            REPORT.validate_report(report)
        report = public_report()
        report["sourceAuthority"]["derivedModelLdrawCrossCheck"]["officialSelectionAuthority"] = True
        with self.assertRaisesRegex(ValueError, "authority-free b counterevidence"):
            REPORT.validate_report(report)

    def test_candidate_or_frame_omission_is_not_a_pass(self) -> None:
        report = public_report()
        report["geometry"]["candidateMeasurements"].pop()
        with self.assertRaisesRegex(ValueError, "all three"):
            REPORT.validate_report(report)
        report = public_report()
        report["geometry"]["candidateMeasurements"][0]["frames"].pop()
        with self.assertRaisesRegex(ValueError, "both residual"):
            REPORT.validate_report(report)
        report = public_report()
        report["inputIdentities"]["builderBundle"]["bytes"] -= 1
        with self.assertRaisesRegex(ValueError, "exact fixed benchmark pins"):
            REPORT.validate_report(report)


if __name__ == "__main__":
    unittest.main()
