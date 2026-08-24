"""The candidate part declaration this repository scores, and its bounds.

One place says what a candidate may claim: the catalog's own four collision body
kinds, its three-to-eight vertex plan limit, and connectors that carry a kind, a
gender, a position and a normal. Studs and clutch cells are scored against LDraw;
the narrow axle kind is retained for a separate exact LDCad-source gate. Reading
a declaration either yields this exact shape or says which field is wrong and
what would satisfy it.

It is a candidate, not a part: nothing here is admitted to the catalog, and the
frame is the LDraw part-local one because no LDraw-to-catalog frame is
established yet.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

Vector2 = tuple[float, float]
Vector3 = tuple[float, float, float]
Triangle = tuple[Vector3, Vector3, Vector3]

CANDIDATE_SCHEMA_VERSION = "lego.part-admission-candidate/1"
CANDIDATE_FRAME = "ldraw-part-local-ldu"
CATALOG_BODY_KINDS = ("box", "wedge", "cylinder", "convex-prism")
CATALOG_BODY_TAGS = ("body", "stud")
CATALOG_MIN_PLAN_VERTICES = 3
CATALOG_MAX_PLAN_VERTICES = 8
QUANTIZATION_SCALE = 1_000_000_000
CONTAINMENT_EPSILON_LDU = 1e-6
MAX_BODIES = 4_096
MAX_CONNECTORS = 1_024
MAX_TRIANGLE_SUBDIVISION = 256
MAX_SURFACE_SAMPLES = 12_000_000
PLAN_INDEX_CELL_LDU = 20.0
MAX_PLAN_INDEX_CELLS_PER_BODY = 512


def _finite(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number; received {value!r}.")
    number = float(value)
    if not math.isfinite(number) or abs(number) > 1_000_000:
        raise ValueError(
            f"{label} is {value!r}; it must be finite and within 1000000 LDU of the part origin."
        )
    return number


def _vector3(value: object, label: str) -> Vector3:
    if not isinstance(value, (list, tuple)) or len(value) != 3:
        raise ValueError(
            f"{label} must be an array of exactly three LDU numbers [x, y, z]; received {value!r}."
        )
    return (
        _finite(value[0], f"{label}[x]"),
        _finite(value[1], f"{label}[y]"),
        _finite(value[2], f"{label}[z]"),
    )


@dataclass(frozen=True)
class Body:
    """One convex candidate body, normalized and carrying its own bounding box."""

    index: int
    kind: str
    tag: str
    minimum: Vector3
    maximum: Vector3
    axis: str = "y"
    center: Vector3 = (0.0, 0.0, 0.0)
    radius: float = 0.0
    height: float = 0.0
    polygon: tuple[Vector2, ...] = ()
    cut_normal: Vector2 | None = None
    cut_offset: float = 0.0
    plan_vertices: int = 4

    @property
    def label(self) -> str:
        return f"bodies[{self.index}] ({self.kind})"


AXIS_INDEX = {"x": 0, "y": 1, "z": 2}


def _box_body(index: int, value: dict[str, object], kind: str) -> tuple[Vector3, Vector3]:
    minimum = _vector3(value.get("minLdu"), f"bodies[{index}].minLdu")
    maximum = _vector3(value.get("maxLdu"), f"bodies[{index}].maxLdu")
    for axis, name in enumerate("xyz"):
        if not maximum[axis] > minimum[axis]:
            raise ValueError(
                f"bodies[{index}] ({kind}) has maxLdu[{name}]={maximum[axis]} at or below "
                f"minLdu[{name}]={minimum[axis]}; every extent must be strictly positive."
            )
    return minimum, maximum


def _polygon(index: int, value: object) -> tuple[Vector2, ...]:
    if not isinstance(value, (list, tuple)):
        raise ValueError(
            f"bodies[{index}].verticesXZLdu must be an array of "
            f"{CATALOG_MIN_PLAN_VERTICES}..{CATALOG_MAX_PLAN_VERTICES} [x, z] pairs."
        )
    if len(value) < CATALOG_MIN_PLAN_VERTICES:
        raise ValueError(
            f"bodies[{index}].verticesXZLdu has {len(value)} vertices; a convex prism needs at "
            f"least {CATALOG_MIN_PLAN_VERTICES}."
        )
    vertices: list[Vector2] = []
    for position, pair in enumerate(value):
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            raise ValueError(
                f"bodies[{index}].verticesXZLdu[{position}] must be an [x, z] pair; received {pair!r}."
            )
        vertices.append(
            (
                _finite(pair[0], f"bodies[{index}].verticesXZLdu[{position}][x]"),
                _finite(pair[1], f"bodies[{index}].verticesXZLdu[{position}][z]"),
            )
        )
    count = len(vertices)
    for position in range(count):
        first = vertices[position]
        second = vertices[(position + 1) % count]
        third = vertices[(position + 2) % count]
        turn = (second[0] - first[0]) * (third[1] - second[1]) - (second[1] - first[1]) * (
            third[0] - second[0]
        )
        if turn <= 0:
            raise ValueError(
                f"bodies[{index}].verticesXZLdu turns by {turn:g} at vertex {(position + 1) % count}; "
                "vertices must be strictly convex and counter-clockwise in the (x, z) plane."
            )
    return tuple(vertices)


def _body(index: int, value: object) -> Body:
    if not isinstance(value, dict):
        raise ValueError(f"bodies[{index}] must be an object; received {type(value).__name__}.")
    kind = value.get("kind")
    if kind not in CATALOG_BODY_KINDS:
        raise ValueError(
            f"bodies[{index}].kind is {kind!r}; the catalog collision contract has "
            f"{list(CATALOG_BODY_KINDS)}."
        )
    tag = value.get("tag")
    if tag not in CATALOG_BODY_TAGS:
        raise ValueError(
            f"bodies[{index}].tag is {tag!r}; it must be one of {list(CATALOG_BODY_TAGS)}."
        )
    if kind in ("box", "wedge"):
        minimum, maximum = _box_body(index, value, str(kind))
        if kind == "box":
            return Body(index=index, kind="box", tag=str(tag), minimum=minimum, maximum=maximum)
        normal_value = value.get("cutNormalXZ")
        if not isinstance(normal_value, (list, tuple)) or len(normal_value) != 2:
            raise ValueError(
                f"bodies[{index}].cutNormalXZ must be an [x, z] pair naming the outward normal of "
                "the sloped vertical face."
            )
        normal = (
            _finite(normal_value[0], f"bodies[{index}].cutNormalXZ[x]"),
            _finite(normal_value[1], f"bodies[{index}].cutNormalXZ[z]"),
        )
        length = math.hypot(*normal)
        if length <= 0:
            raise ValueError(f"bodies[{index}].cutNormalXZ is the zero vector; it must have a direction.")
        offset = _finite(value.get("cutOffsetLdu"), f"bodies[{index}].cutOffsetLdu")
        return Body(
            index=index,
            kind="wedge",
            tag=str(tag),
            minimum=minimum,
            maximum=maximum,
            cut_normal=(normal[0] / length, normal[1] / length),
            cut_offset=offset / length,
            plan_vertices=5,
        )
    if kind == "cylinder":
        axis = value.get("axis")
        if axis not in AXIS_INDEX:
            raise ValueError(f"bodies[{index}].axis is {axis!r}; a cylinder stands on 'x', 'y' or 'z'.")
        center = _vector3(value.get("centerLdu"), f"bodies[{index}].centerLdu")
        radius = _finite(value.get("radiusLdu"), f"bodies[{index}].radiusLdu")
        height = _finite(value.get("heightLdu"), f"bodies[{index}].heightLdu")
        if radius <= 0 or height <= 0:
            raise ValueError(
                f"bodies[{index}] has radiusLdu={radius} and heightLdu={height}; both must be "
                "strictly positive."
            )
        extents = [radius, radius, radius]
        extents[AXIS_INDEX[str(axis)]] = height / 2
        minimum = tuple(center[a] - extents[a] for a in range(3))
        maximum = tuple(center[a] + extents[a] for a in range(3))
        return Body(
            index=index,
            kind="cylinder",
            tag=str(tag),
            minimum=minimum,  # type: ignore[arg-type]
            maximum=maximum,  # type: ignore[arg-type]
            axis=str(axis),
            center=center,
            radius=radius,
            height=height,
        )
    polygon = _polygon(index, value.get("verticesXZLdu"))
    y_min = _finite(value.get("minYLdu"), f"bodies[{index}].minYLdu")
    y_max = _finite(value.get("maxYLdu"), f"bodies[{index}].maxYLdu")
    if not y_max > y_min:
        raise ValueError(
            f"bodies[{index}] has maxYLdu={y_max} at or below minYLdu={y_min}; a prism needs a "
            "strictly positive height."
        )
    return Body(
        index=index,
        kind="convex-prism",
        tag=str(tag),
        minimum=(min(p[0] for p in polygon), y_min, min(p[1] for p in polygon)),
        maximum=(max(p[0] for p in polygon), y_max, max(p[1] for p in polygon)),
        polygon=polygon,
        plan_vertices=len(polygon),
    )


@dataclass(frozen=True)
class Connector:
    index: int
    kind: str
    gender: str
    position: Vector3
    normal: Vector3


def _connector(index: int, value: object) -> Connector:
    if not isinstance(value, dict):
        raise ValueError(f"connectors[{index}] must be an object; received {type(value).__name__}.")
    kind = value.get("kind")
    gender = value.get("gender")
    if kind not in ("stud", "undersideClutch", "axle"):
        raise ValueError(
            f"connectors[{index}].kind is {kind!r}; this scorer accepts 'stud', "
            "'undersideClutch', and the separately source-gated 'axle' kind only."
        )
    if gender not in ("male", "female"):
        raise ValueError(f"connectors[{index}].gender is {gender!r}; it must be 'male' or 'female'.")
    expected = "female" if kind == "undersideClutch" else "male"
    if gender != expected:
        raise ValueError(
            f"connectors[{index}] declares kind {kind!r} with gender {gender!r}; a {kind} is always "
            f"{expected}."
        )
    return Connector(
        index=index,
        kind=str(kind),
        gender=str(gender),
        position=_vector3(value.get("positionLdu"), f"connectors[{index}].positionLdu"),
        normal=_vector3(value.get("normal"), f"connectors[{index}].normal"),
    )


@dataclass(frozen=True)
class Candidate:
    design_id: str
    derivation: str
    bodies: tuple[Body, ...]
    connectors: tuple[Connector, ...]

    @property
    def male_connectors(self) -> tuple[Connector, ...]:
        return tuple(row for row in self.connectors if row.gender == "male")

    @property
    def female_connectors(self) -> tuple[Connector, ...]:
        return tuple(row for row in self.connectors if row.gender == "female")

    @property
    def stud_connectors(self) -> tuple[Connector, ...]:
        return tuple(row for row in self.connectors if row.kind == "stud")

    @property
    def clutch_connectors(self) -> tuple[Connector, ...]:
        return tuple(row for row in self.connectors if row.kind == "undersideClutch")

    @property
    def axle_connectors(self) -> tuple[Connector, ...]:
        return tuple(row for row in self.connectors if row.kind == "axle")


def validate_candidate(value: object) -> Candidate:
    """Accept one candidate declaration or say exactly which field is wrong."""

    if not isinstance(value, dict):
        raise ValueError(f"A part-admission candidate must be an object; received {type(value).__name__}.")
    expected_keys = {"schemaVersion", "designId", "frame", "derivation", "bodies", "connectors"}
    if set(value) != expected_keys:
        raise ValueError(
            f"Candidate keys are {sorted(value)}; expected exactly {sorted(expected_keys)}."
        )
    if value["schemaVersion"] != CANDIDATE_SCHEMA_VERSION:
        raise ValueError(
            f"Candidate schemaVersion is {value['schemaVersion']!r}; this scorer reads "
            f"{CANDIDATE_SCHEMA_VERSION!r}."
        )
    if value["frame"] != CANDIDATE_FRAME:
        raise ValueError(
            f"Candidate frame is {value['frame']!r}; this scorer measures in {CANDIDATE_FRAME!r} "
            "only, because no LDraw-to-catalog frame is established yet."
        )
    design_id = value["designId"]
    if not isinstance(design_id, str) or not design_id:
        raise ValueError(f"Candidate designId must be a non-empty string; received {design_id!r}.")
    derivation = value["derivation"]
    if not isinstance(derivation, str) or not derivation:
        raise ValueError(
            f"Candidate derivation must name how the declaration was produced; received {derivation!r}."
        )
    bodies_value = value["bodies"]
    if not isinstance(bodies_value, list) or not bodies_value:
        raise ValueError("Candidate bodies must be a non-empty array of convex collision bodies.")
    if len(bodies_value) > MAX_BODIES:
        raise ValueError(f"Candidate declares {len(bodies_value)} bodies; the bound is {MAX_BODIES}.")
    connectors_value = value["connectors"]
    if not isinstance(connectors_value, list):
        raise ValueError("Candidate connectors must be an array (possibly empty).")
    if len(connectors_value) > MAX_CONNECTORS:
        raise ValueError(
            f"Candidate declares {len(connectors_value)} connectors; the bound is {MAX_CONNECTORS}."
        )
    return Candidate(
        design_id=design_id,
        derivation=derivation,
        bodies=tuple(_body(index, row) for index, row in enumerate(bodies_value)),
        connectors=tuple(_connector(index, row) for index, row in enumerate(connectors_value)),
    )


