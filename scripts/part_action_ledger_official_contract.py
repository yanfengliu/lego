"""Stream and bound official Builder identities consumed by Python reports."""

from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

from part_identification_descriptor_contract import bounded_observed
from part_identification_report_io import ArtifactContractError


MAX_OFFICIAL_XML_BYTES = 32 * 1024 * 1024
MAX_OFFICIAL_XML_NODES = 100_000
MAX_OFFICIAL_XML_DEPTH = 64
MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE = 32
MAX_OFFICIAL_XML_ATTRIBUTES = 500_000
MAX_OFFICIAL_XML_ATTRIBUTE_CHARACTERS = 32 * 1024 * 1024
MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS = 8_192
MAX_OFFICIAL_BRICKS = 4_000
MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK = 64

ASCII_ELEMENT_ID = re.compile(r"^[0-9]{3,12}$")
ASCII_BRICK_REF = re.compile(r"^[0-9A-Za-z._:-]{1,256}$")
ASCII_DESIGN_ID = re.compile(r"^[0-9A-Za-z._-]{1,64}$")
ASCII_DESIGN_RECORD = re.compile(
    r"^[0-9A-Za-z._-]{1,64}(?:;[0-9A-Za-z._-]{1,64})?$"
)
ASCII_MATERIAL_ID = re.compile(r"^[0-9]{1,12}$")
ASCII_MATERIAL_COMPONENT = re.compile(r"^[0-9]{1,12}:[0-9]{1,12}$")
XML_DECLARATION_ENCODING = re.compile(
    r"^\ufeff?\s*<\?xml\s+[^?]*\bencoding\s*=\s*(['\"])([^'\"]+)\1",
    re.IGNORECASE,
)
FORBIDDEN_DECLARATION = re.compile(r"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)


@dataclass
class _PendingBrick:
    depth: int
    brick_ref: str
    design_id: str
    element_ids: tuple[str, ...]
    materials: set[str] = field(default_factory=set)
    part_count: int = 0


def _local_name(tag: object, *, node_number: int) -> str:
    if not isinstance(tag, str):
        raise ArtifactContractError(
            "Action-ledger official model contains a non-text XML tag at "
            f"node {node_number}; restore the exact retained Builder export."
        )
    local = tag.rsplit("}", 1)[-1]
    if not 1 <= len(local) <= 256:
        raise ArtifactContractError(
            f"Action-ledger official model node {node_number} has a tag name of "
            f"{len(local)} characters; the bounded maximum is 256."
        )
    return local


def _strict_xml_bytes(official_xml: str | bytes) -> tuple[bytes, str]:
    if isinstance(official_xml, bytes):
        raw = official_xml
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ArtifactContractError(
                "Action-ledger official model is not strict UTF-8 "
                f"({error}); restore the exact retained Builder export."
            ) from error
    elif isinstance(official_xml, str):
        text = official_xml
        try:
            raw = text.encode("utf-8")
        except UnicodeEncodeError as error:
            raise ArtifactContractError(
                "Action-ledger official model contains text that cannot be encoded as strict "
                f"UTF-8 ({error}); restore the exact retained Builder export."
            ) from error
    else:
        raise ArtifactContractError(
            "Action-ledger official model must be strict UTF-8 bytes or decoded text; received "
            f"{type(official_xml).__name__}."
        )
    if len(raw) > MAX_OFFICIAL_XML_BYTES:
        raise ArtifactContractError(
            f"Action-ledger official model is {len(raw)} bytes; the bounded maximum is "
            f"{MAX_OFFICIAL_XML_BYTES}."
        )
    if "\ufffd" in text:
        raise ArtifactContractError(
            "Action-ledger official model contains a Unicode replacement character, which may "
            "hide a lossy decode; read the retained export as strict UTF-8 bytes."
        )
    declaration = XML_DECLARATION_ENCODING.match(text[:512])
    if declaration is not None and declaration.group(2).lower().replace("_", "-") not in {
        "utf-8",
        "utf8",
    }:
        raise ArtifactContractError(
            "Action-ledger official model XML declaration names encoding "
            f"{bounded_observed(declaration.group(2))}; only strict UTF-8 is accepted."
        )
    forbidden = FORBIDDEN_DECLARATION.search(text)
    if forbidden is not None:
        raise ArtifactContractError(
            "Action-ledger official model contains a DOCTYPE or ENTITY declaration at character "
            f"{forbidden.start()}; external and expanding declarations are forbidden."
        )
    return raw, text


def _element_ids(raw: object, brick_ref: str) -> tuple[str, ...]:
    if not isinstance(raw, str) or not raw:
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(brick_ref)} has no itemNos element identity."
        )
    values = tuple(raw.split(","))
    if not 1 <= len(values) <= MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK:
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(brick_ref)} declares {len(values)} itemNos element "
            f"identities; the bounded maximum is {MAX_OFFICIAL_ELEMENT_IDS_PER_BRICK}."
        )
    for index, element_id in enumerate(values):
        if ASCII_ELEMENT_ID.fullmatch(element_id) is None:
            raise ArtifactContractError(
                f"Action-ledger official Brick {bounded_observed(brick_ref)} itemNos[{index}] is "
                f"{bounded_observed(element_id)}; element identities must contain 3 through 12 ASCII digits."
            )
    if len(set(values)) != len(values):
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(brick_ref)} repeats an itemNos element identity; "
            "restore the canonical export rather than deduplicating report truth."
        )
    return values


def _brick_at_start(element: ET.Element, depth: int, node_number: int) -> _PendingBrick:
    brick_ref = element.attrib.get("uuid")
    if (
        not isinstance(brick_ref, str)
        or ASCII_BRICK_REF.fullmatch(brick_ref) is None
    ):
        raise ArtifactContractError(
            f"Action-ledger official model physical Brick at node {node_number} has invalid uuid "
            f"{bounded_observed(brick_ref)}; expected 1 through 256 bounded ASCII identifier characters."
        )
    design_raw = element.attrib.get("designID")
    design_id = design_raw.split(";", 1)[0] if isinstance(design_raw, str) else ""
    if (
        not isinstance(design_raw, str)
        or ASCII_DESIGN_RECORD.fullmatch(design_raw) is None
        or ASCII_DESIGN_ID.fullmatch(design_id) is None
    ):
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(brick_ref)} has invalid designID "
            f"{bounded_observed(design_raw)}; "
            "expected a bounded ASCII published design identity."
        )
    return _PendingBrick(
        depth=depth,
        brick_ref=brick_ref,
        design_id=design_id,
        element_ids=_element_ids(element.attrib.get("itemNos"), brick_ref),
    )


def _part_materials(element: ET.Element, pending: _PendingBrick, node_number: int) -> None:
    raw = element.attrib.get("materials")
    if not isinstance(raw, str) or not raw:
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(pending.brick_ref)} direct Part at node "
            f"{node_number} has no materials identity."
        )
    components = raw.split(",")
    if any(ASCII_MATERIAL_COMPONENT.fullmatch(component) is None for component in components):
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(pending.brick_ref)} direct Part at node "
            f"{node_number} has invalid materials {bounded_observed(raw)}; expected comma-separated bounded "
            "ASCII material:shader identities."
        )
    material_ids = {component.split(":", 1)[0] for component in components}
    if any(ASCII_MATERIAL_ID.fullmatch(value) is None for value in material_ids):
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(pending.brick_ref)} direct Part at node "
            f"{node_number} has invalid materials {bounded_observed(raw)}; expected bounded ASCII material ids."
        )
    pending.materials.update(material_ids)
    pending.part_count += 1


def _finish_brick(pending: _PendingBrick) -> dict[str, object]:
    if pending.part_count == 0 or len(pending.materials) != 1:
        raise ArtifactContractError(
            f"Action-ledger official Brick {bounded_observed(pending.brick_ref)} resolves through "
            f"{pending.part_count} direct Parts to materials {bounded_observed(sorted(pending.materials))}; "
            "one or more Parts with one shared material identity are required."
        )
    return {
        "designId": pending.design_id,
        "elementIds": pending.element_ids,
        "materialId": next(iter(pending.materials)),
    }


def official_bricks(official_xml: str | bytes) -> dict[str, dict[str, object]]:
    """Stream one bounded UTF-8 export into physical-Brick identity records."""

    raw, _text = _strict_xml_bytes(official_xml)
    bricks: dict[str, dict[str, object]] = {}
    active: _PendingBrick | None = None
    depth = 0
    nodes = 0
    attributes = 0
    attribute_characters = 0
    element_stack: list[ET.Element] = []
    element_names: list[str] = []
    saw_bricks_container = False
    try:
        events = ET.iterparse(
            io.BytesIO(raw), events=("start", "end", "start-ns")
        )
        for event, payload in events:
            if event == "start-ns":
                prefix, uri = payload
                raise ArtifactContractError(
                    "Action-ledger official model declares unsupported XML namespace "
                    f"{bounded_observed(prefix or '(default)')}={bounded_observed(uri)} before node {nodes + 1}; the retained "
                    "Builder export must use the unnamespaced LXFML/Bricks/Brick hierarchy."
                )
            element = payload
            if event == "start":
                depth += 1
                element_stack.append(element)
                nodes += 1
                local = _local_name(element.tag, node_number=nodes)
                if element.tag != local:
                    raise ArtifactContractError(
                        f"Action-ledger official model node {nodes} <{local}> is namespaced; the "
                        "retained Builder export must use unnamespaced element names."
                    )
                parent_path = tuple(element_names)
                if not element_names:
                    if local != "LXFML":
                        raise ArtifactContractError(
                            f"Action-ledger official model root is <{local}>; expected <LXFML>."
                        )
                elif local == "Bricks" and parent_path == ("LXFML",):
                    if saw_bricks_container:
                        raise ArtifactContractError(
                            "Action-ledger official model contains a second direct "
                            "LXFML/Bricks container; restore the canonical retained export."
                        )
                    saw_bricks_container = True
                element_names.append(local)
                if nodes > MAX_OFFICIAL_XML_NODES:
                    raise ArtifactContractError(
                        f"Action-ledger official model exceeds {MAX_OFFICIAL_XML_NODES} XML "
                        f"elements at node {nodes} <{local}>."
                    )
                if depth > MAX_OFFICIAL_XML_DEPTH:
                    raise ArtifactContractError(
                        f"Action-ledger official model exceeds depth {MAX_OFFICIAL_XML_DEPTH} at "
                        f"node {nodes} <{local}> (depth {depth})."
                    )
                node_attributes = len(element.attrib)
                if node_attributes > MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE:
                    raise ArtifactContractError(
                        f"Action-ledger official model node {nodes} <{local}> has "
                        f"{node_attributes} attributes; the per-node maximum is "
                        f"{MAX_OFFICIAL_XML_ATTRIBUTES_PER_NODE}."
                    )
                attributes += node_attributes
                if attributes > MAX_OFFICIAL_XML_ATTRIBUTES:
                    raise ArtifactContractError(
                        f"Action-ledger official model exceeds {MAX_OFFICIAL_XML_ATTRIBUTES} "
                        f"attributes at node {nodes} <{local}>."
                    )
                for name, value in element.attrib.items():
                    if len(value) > MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS:
                        raise ArtifactContractError(
                            f"Action-ledger official model node {nodes} <{local}> attribute "
                            f"{bounded_observed(name)} has {len(value)} characters; the maximum is "
                            f"{MAX_OFFICIAL_XML_ATTRIBUTE_VALUE_CHARACTERS}."
                        )
                    attribute_characters += len(name) + len(value)
                if attribute_characters > MAX_OFFICIAL_XML_ATTRIBUTE_CHARACTERS:
                    raise ArtifactContractError(
                        "Action-ledger official model exceeds the bounded aggregate XML "
                        f"attribute size at node {nodes} <{local}>."
                    )

                if local == "Brick" and "uuid" in element.attrib:
                    if parent_path != ("LXFML", "Bricks"):
                        raise ArtifactContractError(
                            f"Action-ledger official model physical Brick "
                            f"{bounded_observed(element.attrib.get('uuid'))} appears at "
                            f"{'/'.join((*parent_path, local))}; physical Bricks must be direct "
                            "children of LXFML/Bricks."
                        )
                    if active is not None:
                        raise ArtifactContractError(
                            f"Action-ledger official Brick {bounded_observed(active.brick_ref)} contains nested "
                            f"physical Brick {bounded_observed(element.attrib.get('uuid'))} at node {nodes}."
                        )
                    active = _brick_at_start(element, depth, nodes)
                elif local == "Part" and active is not None and depth == active.depth + 1:
                    _part_materials(element, active, nodes)
            else:
                local = _local_name(element.tag, node_number=nodes)
                if active is not None and local == "Brick" and depth == active.depth:
                    if active.brick_ref in bricks:
                        raise ArtifactContractError(
                            f"Action-ledger official model repeats physical Brick uuid "
                            f"{bounded_observed(active.brick_ref)}; identity order cannot choose report truth."
                        )
                    bricks[active.brick_ref] = _finish_brick(active)
                    if len(bricks) > MAX_OFFICIAL_BRICKS:
                        raise ArtifactContractError(
                            f"Action-ledger official model exceeds {MAX_OFFICIAL_BRICKS} bounded "
                            f"Brick identities at uuid {bounded_observed(active.brick_ref)}."
                        )
                    active = None
                if (
                    not element_stack
                    or element_stack[-1] is not element
                    or not element_names
                    or element_names[-1] != local
                ):
                    raise ArtifactContractError(
                        f"Action-ledger official model XML stack diverged while closing <{local}> "
                        f"at depth {depth}; restore the exact retained export."
                    )
                element_stack.pop()
                element_names.pop()
                element.clear()
                if element_stack:
                    element_stack[-1].remove(element)
                depth -= 1
    except ET.ParseError as error:
        raise ArtifactContractError(
            f"Action-ledger official model is not bounded well-formed XML near {error}; "
            f"parsed {nodes} elements at depth {depth}. Restore the exact retained Builder export."
        ) from error
    if depth != 0 or element_stack or element_names or active is not None:
        raise ArtifactContractError(
            f"Action-ledger official model ended with depth {depth}, {len(element_stack)} open "
            "elements, and active Brick "
            f"{bounded_observed(None if active is None else active.brick_ref)}; "
            "restore the complete export."
        )
    if not saw_bricks_container:
        raise ArtifactContractError(
            "Action-ledger official model contains no direct LXFML/Bricks container; restore the "
            "canonical retained export."
        )
    if not bricks:
        raise ArtifactContractError(
            "Action-ledger official model contains no physical Brick identities; restore the "
            "retained export."
        )
    return bricks
