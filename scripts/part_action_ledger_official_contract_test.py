"""Hostile bounds for the streamed official Builder XML contract."""

from __future__ import annotations

import unittest

from part_action_ledger_official_contract import (
    MAX_OFFICIAL_BRICKS,
    MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK,
    MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE,
    MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS,
    MAX_OFFICIAL_XML_DEPTH,
    MAX_OFFICIAL_XML_NODES,
    official_bricks,
)
from part_identification_report_io import ArtifactContractError


def physical_brick(
    brick_ref: str,
    *,
    design: str = "3005;A",
    item_nos: str = "1234",
    materials: str = "26:0",
) -> str:
    return (
        f'<Brick uuid="{brick_ref}" itemNos="{item_nos}" designID="{design}">'
        f'<Part materials="{materials}" /></Brick>'
    )


def export(*contents: str) -> str:
    return "<LXFML><Bricks>" + "".join(contents) + "</Bricks></LXFML>"


class OfficialBrickContractTests(unittest.TestCase):
    def test_reordered_attributes_and_multiple_item_numbers_are_preserved(self) -> None:
        value = official_bricks(
            export(
                '<Brick itemNos="1234,5678" designID="3005;A" uuid="brick-1">'
                '<Part materials="26:0,26:0" /></Brick>'
            )
        )
        self.assertEqual(
            value,
            {
                "brick-1": {
                    "designId": "3005",
                    "elementIds": ("1234", "5678"),
                    "materialId": "26",
                }
            },
        )

    def test_instruction_references_are_not_physical_bricks(self) -> None:
        value = official_bricks(
            export('<Brick brickRef="brick-1" />', physical_brick("brick-1"))
        )
        self.assertEqual(set(value), {"brick-1"})

    def test_invalid_utf8_and_lossy_replacement_text_are_rejected(self) -> None:
        for xml in (
            b'<LXFML><Bricks>\xff</Bricks></LXFML>',
            export(physical_brick("brick-\ufffd")),
        ):
            with self.subTest(kind=type(xml).__name__):
                with self.assertRaisesRegex(
                    ArtifactContractError, "strict UTF-8|replacement character"
                ):
                    official_bricks(xml)

    def test_non_utf8_declaration_and_entity_declarations_are_rejected(self) -> None:
        for xml, message in (
            (
                '<?xml version="1.0" encoding="ISO-8859-1"?>'
                + export(physical_brick("brick-1")),
                "only strict UTF-8",
            ),
            (
                '<!DOCTYPE LXFML [<!ENTITY x "1234">]>'
                + export(physical_brick("brick-1", item_nos="&x;")),
                "DOCTYPE or ENTITY",
            ),
        ):
            with self.subTest(message=message):
                with self.assertRaisesRegex(ArtifactContractError, message):
                    official_bricks(xml)

    def test_malformed_xml_names_the_parse_position_and_progress(self) -> None:
        with self.assertRaisesRegex(
            ArtifactContractError, "well-formed XML near .*parsed [0-9]+ elements at depth"
        ):
            official_bricks("<LXFML><Bricks><Brick></Bricks></LXFML>")

    def test_total_element_count_is_bounded_before_empty_export_fallback(self) -> None:
        xml = "<LXFML>" + "<N/>" * MAX_OFFICIAL_XML_NODES + "</LXFML>"
        with self.assertRaisesRegex(
            ArtifactContractError,
            f"exceeds {MAX_OFFICIAL_XML_NODES} XML elements.*<N>",
        ):
            official_bricks(xml)

    def test_xml_depth_is_bounded_with_the_offending_node_context(self) -> None:
        xml = (
            "<LXFML>"
            + "<N>" * MAX_OFFICIAL_XML_DEPTH
            + "</N>" * MAX_OFFICIAL_XML_DEPTH
            + "</LXFML>"
        )
        with self.assertRaisesRegex(
            ArtifactContractError,
            f"exceeds depth {MAX_OFFICIAL_XML_DEPTH}.*<N>.*depth {MAX_OFFICIAL_XML_DEPTH + 1}",
        ):
            official_bricks(xml)

    def test_attribute_count_and_value_length_are_bounded_at_the_node(self) -> None:
        attributes = " ".join(
            f'a{index}="x"'
            for index in range(MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE + 1)
        )
        cases = (
            (
                f"<LXFML><Hostile {attributes} /></LXFML>",
                f"<Hostile> has {MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE + 1} attributes",
            ),
            (
                '<LXFML><Hostile payload="'
                + "x" * (MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS + 1)
                + '" /></LXFML>',
                "attribute 'payload'.*the maximum",
            ),
        )
        for xml, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(ArtifactContractError, message):
                    official_bricks(xml)

    def test_namespaces_cannot_impersonate_the_builder_hierarchy(self) -> None:
        xml = (
            '<evil:LXFML xmlns:evil="urn:hostile"><evil:Bricks>'
            '<evil:Brick uuid="brick-1" itemNos="1234" designID="3005;A">'
            '<evil:Part materials="26:0" /></evil:Brick>'
            "</evil:Bricks></evil:LXFML>"
        )
        with self.assertRaisesRegex(
            ArtifactContractError,
            "unsupported XML namespace.*urn:hostile.*unnamespaced LXFML/Bricks/Brick",
        ):
            official_bricks(xml)

    def test_uuid_bricks_outside_the_direct_bricks_container_are_rejected(self) -> None:
        xml = (
            "<LXFML><Meta>"
            + physical_brick("brick-1")
            + "</Meta><Bricks></Bricks></LXFML>"
        )
        with self.assertRaisesRegex(
            ArtifactContractError,
            "physical Brick 'brick-1' appears at LXFML/Meta/Brick.*direct children",
        ):
            official_bricks(xml)

    def test_element_identifiers_are_ascii_unique_and_bounded(self) -> None:
        cases = (
            ("12", "3 through 12 ASCII digits"),
            ("1234,1234", "repeats an itemNos"),
            ("1234,\u0665\u0666\u0667\u0668", "ASCII digits"),
            (
                ",".join(
                    str(100_000 + index)
                    for index in range(MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK + 1)
                ),
                f"bounded maximum is {MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK}",
            ),
        )
        for item_nos, message in cases:
            with self.subTest(item_nos=item_nos[:40]):
                with self.assertRaisesRegex(
                    ArtifactContractError, f"Brick 'brick-1'.*{message}"
                ):
                    official_bricks(export(physical_brick("brick-1", item_nos=item_nos)))

    def test_brick_design_and_material_identifiers_are_bounded_ascii(self) -> None:
        cases = (
            (physical_brick("brick \u2603"), "invalid uuid"),
            (
                physical_brick("brick-1", design="3005;A;shadow"),
                "invalid designID",
            ),
            (
                physical_brick("brick-1", materials="26:0,21:not-a-shader"),
                "invalid materials",
            ),
        )
        for brick, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(ArtifactContractError, message):
                    official_bricks(export(brick))

    def test_brick_count_is_bounded_and_names_the_overflow_identity(self) -> None:
        xml = export(
            *(
                physical_brick(f"brick-{index}")
                for index in range(MAX_OFFICIAL_BRICKS + 1)
            )
        )
        with self.assertRaisesRegex(
            ArtifactContractError,
            f"exceeds {MAX_OFFICIAL_BRICKS} bounded Brick identities.*brick-{MAX_OFFICIAL_BRICKS}",
        ):
            official_bricks(xml)

    def test_duplicate_brick_and_conflicting_part_materials_are_contextual(self) -> None:
        cases = (
            (
                export(physical_brick("duplicate"), physical_brick("duplicate")),
                "repeats physical Brick uuid 'duplicate'",
            ),
            (
                export(
                    '<Brick uuid="brick-1" itemNos="1234" designID="3005;A">'
                    '<Part materials="26:0" /><Part materials="21:0" /></Brick>'
                ),
                "Brick 'brick-1'.*materials.*'21'.*'26'",
            ),
        )
        for xml, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(ArtifactContractError, message):
                    official_bricks(xml)

    def test_hostile_identity_namespace_and_fanout_diagnostics_are_bounded(self) -> None:
        long = "x" * MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS
        million = "x" * 1_000_000
        fanout = (
            '<Brick uuid="brick-1" itemNos="1234" designID="3005;A">'
            + "".join(f'<Part materials="{index}:0" />' for index in range(20_000))
            + "</Brick>"
        )
        cases = (
            f'<LXFML xmlns="{million}"><Bricks /></LXFML>',
            f'<LXFML><Hostile {million}="{long}x" /></LXFML>',
            export(physical_brick(long)),
            export(physical_brick("brick-1", design=long)),
            export(physical_brick("brick-1", item_nos=long)),
            export(physical_brick("brick-1", materials=long)),
            "<LXFML><Meta>" + physical_brick(long) + "</Meta><Bricks /></LXFML>",
            export(fanout),
        )
        for position, xml in enumerate(cases):
            with self.subTest(position=position):
                with self.assertRaises(ArtifactContractError) as raised:
                    official_bricks(xml)
                self.assertLess(len(str(raised.exception)), 1_024)


if __name__ == "__main__":
    unittest.main()
