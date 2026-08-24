"""Compose LDCad shadow metas through an LDraw part's own reference tree.

LDCad appends a shadow file to the identically named LDraw file during loading,
so a snap written against `p/stud.dat` is inherited by every part that places a
stud, carried by the same type-1 matrix that places the geometry. Reading a
part's shadow information therefore means walking the LDraw tree, not reading
one file: 93273 has no shadow file of its own and gets all four of its clutches
from `parts/s/93273s01.dat`, and 77844 has neither.

Everything here is exact rational arithmetic over the LDraw transforms, so a
composed position is either an exact number or a refusal — a connector is a
physical claim and a rounded one is a different claim.

This module measures. It emits no `PartDefinition`, claims no catalog frame and admits nothing.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from typing import Callable, Sequence

from ldcad_shadow_metas import (
    MAX_GRID_CELLS,
    Matrix3,
    Rational3,
    Section,
    ShadowMeta,
    parse_grid,
    parse_sections,
)
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import MAX_RECURSION_DEPTH, LDrawSourceLibrary

SHADOW_COMPOSITION_ID = "ldcad-shadow-composed-over-ldraw-tree/1"
STUD_RADIUS_LDU = Fraction(6)
STUD_DEPTH_LDU = Fraction(4)
MAX_SNAPS_PER_PART = 4_096
MAX_TREE_NODES = 4_096
MAX_REFERENCES_PER_FILE = 8_192

LDrawKey = tuple[str, str]


def matrix_product(left: Matrix3, right: Matrix3) -> Matrix3:
    return tuple(
        sum(left[row * 3 + k] * right[k * 3 + column] for k in range(3))
        for row in range(3)
        for column in range(3)
    )


def apply_matrix(matrix: Matrix3, point: Rational3) -> Rational3:
    return tuple(  # type: ignore[return-value]
        matrix[row * 3 + 0] * point[0]
        + matrix[row * 3 + 1] * point[1]
        + matrix[row * 3 + 2] * point[2]
        for row in range(3)
    )


@dataclass(frozen=True)
class ShadowSnap:
    """One concrete snap instance, in the coordinate system of some LDraw file."""

    command: str
    gender: str
    snap_id: str
    group: str
    position: Rational3
    orientation: Matrix3
    sections: tuple[Section, ...]
    caps: str
    slide: bool
    centered: bool
    grid_count: int
    transform_modifiers: tuple[str | None, str | None]
    source_path: str
    source_line: int

    @property
    def hole_direction(self) -> Rational3:
        """Where the sections run: LDCad snaps point down their own local -Y."""

        return apply_matrix(self.orientation, (Fraction(0), Fraction(-1), Fraction(0)))

    @property
    def mouth_normal(self) -> Rational3:
        """The outward face normal: the direction a mating stud arrives from."""

        return tuple(-value for value in self.hole_direction)  # type: ignore[return-value]

    def transformed(self, matrix: Matrix3, translation: Rational3) -> "ShadowSnap":
        placed = apply_matrix(matrix, self.position)
        return ShadowSnap(
            command=self.command,
            gender=self.gender,
            snap_id=self.snap_id,
            group=self.group,
            position=tuple(placed[axis] + translation[axis] for axis in range(3)),  # type: ignore[arg-type]
            orientation=matrix_product(matrix, self.orientation),
            sections=self.sections,
            caps=self.caps,
            slide=self.slide,
            centered=self.centered,
            grid_count=self.grid_count,
            transform_modifiers=self.transform_modifiers,
            source_path=self.source_path,
            source_line=self.source_line,
        )

    @property
    def is_anti_stud(self) -> bool:
        """A female round hole exactly the nominal stud's radius and at least its depth.

        The catalog's stud is a 6 LDU radius, 4 LDU deep cylinder, so this is the
        one shape a stud can enter. A radius-4 solid stud tube, an 8 LDU technic
        hole and a square barrel snap all read as female cylinders too, and none
        of them is a place a stud is held.
        """

        return (
            self.command == "SNAP_CYL"
            and self.gender == "F"
            and bool(self.sections)
            and self.sections[0].variant == "R"
            and self.sections[0].radius == STUD_RADIUS_LDU
            and self.sections[0].length >= STUD_DEPTH_LDU
        )

    @property
    def is_stud(self) -> bool:
        return (
            self.command == "SNAP_CYL"
            and self.gender == "M"
            and bool(self.sections)
            and self.sections[0].variant == "R"
            and self.sections[0].radius == STUD_RADIUS_LDU
        )

    @property
    def is_axle_shaft(self) -> bool:
        return (
            self.command == "SNAP_CYL"
            and self.gender == "M"
            and self.caps == "none"
            and self.slide
            and self.centered
            and self.grid_count == 1
            and self.transform_modifiers == (None, None)
            and len(self.sections) == 1
            and self.sections[0].variant == "A"
            and self.sections[0].radius == 6
            and self.sections[0].length == 60
            and all(
                sorted(abs(value) for value in values) == [0, 0, 1]
                for values in (
                    *(self.orientation[row * 3 : row * 3 + 3] for row in range(3)),
                    *(self.orientation[column::3] for column in range(3))
                )
            )
        )


def _gender(meta: ShadowMeta) -> str:
    value = (meta.text("gender") or "").strip().upper()
    if value in ("M", "MALE"):
        return "M"
    if value in ("F", "FEMALE"):
        return "F"
    if value == "":
        return ""
    raise ValueError(
        f"{meta.label} declares [gender={meta.text('gender')!r}]; LDCad genders are M and F."
    )


def snap_instances(meta: ShadowMeta) -> list[ShadowSnap]:
    """One meta as the concrete snaps its position, orientation and grid stand for."""

    orientation = meta.matrix3("ori")
    position = meta.vector3("pos", (Fraction(0), Fraction(0), Fraction(0)))
    sections = parse_sections(meta)
    if meta.flag("center") and sections:
        total = sum((section.length for section in sections), Fraction(0))
        shift = apply_matrix(orientation, (Fraction(0), total / 2, Fraction(0)))
        position = tuple(position[axis] + shift[axis] for axis in range(3))  # type: ignore[assignment]
    snaps = []
    grid = parse_grid(meta)
    for cell in grid:
        offset = apply_matrix(orientation, cell)
        snaps.append(
            ShadowSnap(
                command=meta.command,
                gender=_gender(meta),
                snap_id=(meta.text("id") or "").strip().lower(),
                group=(meta.text("group") or "").strip().lower(),
                position=tuple(position[axis] + offset[axis] for axis in range(3)),  # type: ignore[arg-type]
                orientation=orientation,
                sections=sections,
                caps=(meta.text("caps") or "").strip().lower(),
                slide=meta.flag("slide"),
                centered=meta.flag("center"),
                grid_count=len(grid),
                transform_modifiers=(meta.text("scale"), meta.text("mirror")),
                source_path=meta.source_path,
                source_line=meta.line_number,
            )
        )
    return snaps


def ldraw_references(
    library: LDrawSourceLibrary, key: LDrawKey
) -> list[tuple[Matrix3, Rational3, LDrawKey]]:
    """Every type-1 placement in one LDraw file, as exact rationals."""

    placements: list[tuple[Matrix3, Rational3, LDrawKey]] = []
    source_key = f"{key[0]}:{key[1]}"
    for number, raw in enumerate(library.text(key).splitlines(), 1):
        stripped = raw.strip()
        if not stripped.split() or stripped.split()[0] != "1":
            continue
        fields = stripped.split(maxsplit=14)
        if len(fields) < 15:
            raise ValueError(f"Malformed LDraw type-1 record {source_key}:{number}")
        try:
            values = [Fraction(Decimal(token)) for token in fields[2:14]]
        except (InvalidOperation, ValueError) as error:
            raise ValueError(
                f"Malformed LDraw transform {source_key}:{number}: {error}"
            ) from error
        translation: Rational3 = (values[0], values[1], values[2])
        matrix: Matrix3 = tuple(values[3:12])
        placements.append((matrix, translation, library.resolve(fields[14], key[0])))
        if len(placements) > MAX_REFERENCES_PER_FILE:
            raise ValueError(
                f"{source_key} exceeds {MAX_REFERENCES_PER_FILE} type-1 references"
            )
    return placements


@dataclass
class ShadowComposition:
    """What one part's shadow walk found, including everything it refused."""

    snaps: list[ShadowSnap]
    files_visited: int
    shadow_files_used: list[str]
    metas_by_command: dict[str, int]
    cleared: int
    includes_followed: int
    nested_includes_not_followed: int


class _Walker:
    def __init__(self, library: LDrawSourceLibrary, shadow: VerifiedShadowLibrary) -> None:
        self.library = library
        self.shadow = shadow
        self.cache: dict[LDrawKey, list[ShadowSnap]] = {}
        self.visited: set[LDrawKey] = set()
        self.shadow_files: dict[str, None] = {}
        self.metas: dict[str, int] = {}
        self.cleared = 0
        self.includes = 0
        self.nested_includes = 0

    def snaps(self, key: LDrawKey, stack: tuple[LDrawKey, ...]) -> list[ShadowSnap]:
        cached = self.cache.get(key)
        if cached is not None:
            return cached
        if key in stack:
            chain = " -> ".join(f"{a}:{p}" for a, p in (*stack, key))
            raise ValueError(f"Recursive LDraw reference while walking shadows: {chain}")
        if len(stack) >= MAX_RECURSION_DEPTH:
            raise ValueError(f"Shadow walk exceeds depth {MAX_RECURSION_DEPTH} at {key}")
        self.visited.add(key)
        if len(self.visited) > MAX_TREE_NODES:
            raise ValueError(f"Shadow walk exceeds {MAX_TREE_NODES} LDraw files at {key}")
        gathered: list[ShadowSnap] = []
        for matrix, translation, child in ldraw_references(self.library, key):
            for snap in self.snaps(child, (*stack, key)):
                gathered.append(snap.transformed(matrix, translation))
                if len(gathered) > MAX_SNAPS_PER_PART:
                    raise ValueError(
                        f"{key[0]}:{key[1]} inherits more than {MAX_SNAPS_PER_PART} snaps."
                    )
        gathered = self._apply_own_shadow(key, gathered)
        self.cache[key] = gathered
        return gathered

    def _apply_own_shadow(self, key: LDrawKey, gathered: list[ShadowSnap]) -> list[ShadowSnap]:
        if not self.shadow.contains(key[1]):
            return gathered
        shadow_file = self.shadow.read(key[1])
        self.shadow_files[shadow_file.path] = None
        for meta in shadow_file.metas:
            self.metas[meta.command] = self.metas.get(meta.command, 0) + 1
            if meta.command == "SNAP_CLEAR":
                identifier = (meta.text("id") or "").strip().lower()
                before = len(gathered)
                if identifier:
                    gathered = [snap for snap in gathered if snap.snap_id != identifier]
                else:
                    gathered = []
                self.cleared += before - len(gathered)
            elif meta.command == "SNAP_INCL":
                gathered.extend(self._include(meta))
            elif meta.command in ("SNAP_CYL", "SNAP_CLP", "SNAP_FGR", "SNAP_GEN"):
                gathered.extend(snap_instances(meta))
            if len(gathered) > MAX_SNAPS_PER_PART:
                raise ValueError(
                    f"{shadow_file.path} pushes the snap count past {MAX_SNAPS_PER_PART}."
                )
        return gathered

    def _include(self, meta: ShadowMeta) -> list[ShadowSnap]:
        """`SNAP_INCL` copies another shadow file's own metas, non-recursively.

        LDCad's own documentation says the include is not recursive, so a nested
        include inside the referenced file is counted and left alone rather than
        quietly followed to a depth the tool itself does not use.
        """

        reference = meta.text("ref")
        if not reference:
            raise ValueError(f"{meta.label} has no [ref=...] naming what to include.")
        resolved = self.shadow.resolve(reference)
        if resolved is None:
            return []
        self.includes += 1
        self.shadow_files[resolved] = None
        included = self.shadow.read(resolved)
        base = meta.matrix3("ori")
        origin = meta.vector3("pos", (Fraction(0), Fraction(0), Fraction(0)))
        offsets = parse_grid(meta)
        if len(offsets) * max(1, len(included.metas)) > MAX_GRID_CELLS:
            raise ValueError(f"{meta.label} would expand past {MAX_GRID_CELLS} included snaps.")
        produced: list[ShadowSnap] = []
        for inner in included.metas:
            if inner.command == "SNAP_INCL":
                self.nested_includes += 1
                continue
            if inner.command not in ("SNAP_CYL", "SNAP_CLP", "SNAP_FGR", "SNAP_GEN"):
                continue
            for snap in snap_instances(inner):
                for cell in offsets:
                    shift = apply_matrix(base, cell)
                    translation: Rational3 = tuple(  # type: ignore[assignment]
                        origin[axis] + shift[axis] for axis in range(3)
                    )
                    produced.append(snap.transformed(base, translation))
        return produced


def compose_part_snaps(
    library: LDrawSourceLibrary, shadow: VerifiedShadowLibrary, root: LDrawKey
) -> ShadowComposition:
    """Every snap one LDraw part carries, in its own part-local LDU frame."""

    walker = _Walker(library, shadow)
    snaps = walker.snaps(root, ())
    return ShadowComposition(
        snaps=snaps,
        files_visited=len(walker.visited),
        shadow_files_used=sorted(walker.shadow_files),
        metas_by_command=dict(sorted(walker.metas.items())),
        cleared=walker.cleared,
        includes_followed=walker.includes,
        nested_includes_not_followed=walker.nested_includes,
    )


def axis_normal(direction: Rational3) -> tuple[float, float, float] | None:
    """A composed direction as an exact unit axis, or None if it is not one."""

    for axis in range(3):
        others = [value for index, value in enumerate(direction) if index != axis]
        if abs(direction[axis]) == 1 and all(value == 0 for value in others):
            vector = [0.0, 0.0, 0.0]
            vector[axis] = float(direction[axis])
            return (vector[0], vector[1], vector[2])
    return None


def exact_float(value: Fraction, label: str) -> float:
    projected = float(value)
    if Fraction(projected) != value:
        raise ValueError(
            f"{label} composes to {value}, which no float64 represents exactly. A connector "
            "position is a physical claim and must not be rounded on the way out."
        )
    return projected


def emit_clutch_connectors(
    snaps: Sequence[ShadowSnap],
    *,
    on_reject: Callable[[str, ShadowSnap], None] | None = None,
) -> list[dict[str, object]]:
    """Deduplicated under-stud clutch candidates, in LDraw part-local LDU.

    The library legitimately states the same grip twice — `5092.dat` and
    `s/5092s01.dat` each declare the clutch at (-10, 8, 0) — so identical
    position-and-normal pairs collapse to one connector rather than counting as
    two grips.
    """

    seen: dict[tuple[tuple[float, ...], tuple[float, ...]], None] = {}
    connectors: list[dict[str, object]] = []
    for snap in snaps:
        if not snap.is_anti_stud:
            continue
        normal = axis_normal(snap.mouth_normal)
        if normal is None:
            if on_reject is not None:
                on_reject("non-axis-clutch-normal", snap)
            continue
        try:
            position = tuple(
                exact_float(value, f"{snap.source_path}:{snap.source_line} clutch")
                for value in snap.position
            )
        except ValueError:
            if on_reject is not None:
                on_reject("position-not-exactly-representable", snap)
            continue
        key = (position, normal)
        if key in seen:
            if on_reject is not None:
                on_reject("duplicate-of-an-already-emitted-grip", snap)
            continue
        seen[key] = None
        connectors.append(
            {
                "kind": "undersideClutch",
                "gender": "female",
                "positionLdu": list(position),
                "normal": list(normal),
            }
        )
    connectors.sort(key=lambda row: tuple(row["positionLdu"]))  # type: ignore[arg-type]
    return connectors


def emit_stud_connectors(snaps: Sequence[ShadowSnap]) -> list[dict[str, object]]:
    """The male studs the same walk carries, with normals pointing out of the part."""

    seen: set[tuple[tuple[float, ...], tuple[float, ...]]] = set()
    connectors: list[dict[str, object]] = []
    for snap in snaps:
        if not snap.is_stud:
            continue
        # LDCad's cylinder direction points from the open mouth into a male snap.
        # Catalog connector normals point from the seat out of the owning part,
        # so a stud uses the opposite direction while an anti-stud keeps the
        # mouth direction emitted by `emit_clutch_connectors`.
        normal = axis_normal(tuple(-value for value in snap.mouth_normal))
        if normal is None:
            continue
        try:
            position = tuple(
                exact_float(value, f"{snap.source_path}:{snap.source_line} stud")
                for value in snap.position
            )
        except ValueError:
            continue
        if (position, normal) in seen:
            continue
        seen.add((position, normal))
        connectors.append(
            {
                "kind": "stud",
                "gender": "male",
                "positionLdu": list(position),
                "normal": list(normal),
            }
        )
    connectors.sort(key=lambda row: tuple(row["positionLdu"]))  # type: ignore[arg-type]
    return connectors


def snap_census(snaps: Sequence[ShadowSnap]) -> dict[str, object]:
    """What the walk found, by command, gender and leading section shape."""

    rows: dict[str, int] = {}
    for snap in snaps:
        head = snap.sections[0] if snap.sections else None
        shape = "none" if head is None else f"{head.variant}{head.radius}x{head.length}"
        key = f"{snap.command}/{snap.gender or '-'}/{shape}"
        rows[key] = rows.get(key, 0) + 1
    return {
        "totalSnaps": len(snaps),
        "antiStuds": sum(1 for snap in snaps if snap.is_anti_stud),
        "studs": sum(1 for snap in snaps if snap.is_stud),
        "axleShafts": sum(1 for snap in snaps if snap.is_axle_shaft),
        "byCommandGenderShape": dict(sorted(rows.items())),
    }
