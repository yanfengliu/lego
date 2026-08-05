"""The exact Builder-to-LDraw frame of one part, and the connectors it carries.

`builder_ldraw_field` reads a part's node lattice as exact rationals in Builder
units, and one Builder unit is exactly 25 LDU, so a part's frame is an integer
matrix rather than a fit:

    p_ldraw = A . p_builder + t,  A = turn . diag(25, -25, -25)

`diag(25, -25, -25)` is the pack's own declared `lego-builder-native-to-catalog-ldu/1`
frame — Builder is Y-up and Z-toward-viewer, LDraw is Y-down and Z-away — and
`turn` is one of the four quarter turns about the vertical axis. Origins differ
per part, so `t` is per part and nothing here is a global constant.

The frame is derived by exact correspondence, not by optimisation: Builder's
family 0/1 nodes must land exactly on the LDraw-measured stud centres and its
family 7/9 nodes exactly on the LDraw-measured underside tube centres, with no
node and no measured feature left over. A part whose matched feature set is
symmetric admits several exact frames; they differ by a self-symmetry of the
part, so `frames_modulo_symmetry` reports whether the residual choice can change
anything an emitted connector says.

Nothing here admits a part, emits a `PartDefinition`, or claims a catalog frame.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from fractions import Fraction
from typing import Sequence

from builder_ldraw_field import (
    BUILDER_UNIT_LDU,
    FEMALE_FAMILIES,
    MALE_FAMILIES,
    STUD_PITCH_LDU,
    TUBE_FAMILIES,
    BuilderNode,
    Rational3,
)

FRAME_SCHEMA_VERSION = "lego.builder-ldraw-frame/1"
BUILDER_NATIVE_FRAME_ID = "lego-builder-native-to-catalog-ldu/1"
# Quarter turns about the vertical axis, as the (x, z) map they apply. The
# mirrors are searched too, so a frame that would need one is reported as such
# rather than silently accepted: Builder and LDraw are both right-handed, so a
# mirror is evidence that something upstream is wrong, not a valid frame.
TURNS: dict[str, tuple[tuple[int, int], tuple[int, int], int]] = {
    "turn0": ((1, 0), (0, 1), 1),
    "turn90": ((0, -1), (1, 0), 1),
    "turn180": ((-1, 0), (0, -1), 1),
    "turn270": ((0, 1), (-1, 0), 1),
    "mirrorX-turn0": ((-1, 0), (0, 1), -1),
    "mirrorX-turn90": ((0, 1), (1, 0), -1),
    "mirrorX-turn180": ((1, 0), (0, -1), -1),
    "mirrorX-turn270": ((0, -1), (-1, 0), -1),
}
PROPER_TURNS = tuple(name for name, row in TURNS.items() if row[2] == 1)


def turn_matrix(turn: str) -> tuple[int, ...]:
    """The 3x3 integer matrix `turn . diag(25, -25, -25)`, row-major."""

    if turn not in TURNS:
        raise ValueError(f"Turn {turn!r} is not one of {sorted(TURNS)}.")
    (a, b), (c, d), _ = TURNS[turn]
    unit = BUILDER_UNIT_LDU
    return (a * unit, 0, -b * unit, 0, -unit, 0, c * unit, 0, -d * unit)


@dataclass(frozen=True)
class BuilderLdrawFrame:
    """One pinned, invertible, per-part Builder-to-LDraw frame."""

    design_id: str
    revision: str
    record_sha256: str
    turn: str
    translation: Rational3
    derivation: str

    @property
    def linear(self) -> tuple[int, ...]:
        return turn_matrix(self.turn)

    @property
    def determinant_sign(self) -> int:
        return TURNS[self.turn][2]

    def apply(self, point: Rational3) -> Rational3:
        m = self.linear
        return tuple(  # type: ignore[return-value]
            m[a * 3 + 0] * point[0]
            + m[a * 3 + 1] * point[1]
            + m[a * 3 + 2] * point[2]
            + self.translation[a]
            for a in range(3)
        )

    def invert(self, point: Rational3) -> Rational3:
        """The exact inverse. `invert(apply(p)) == p` for every rational p."""

        m = self.linear
        shifted = tuple(point[a] - self.translation[a] for a in range(3))
        scale = Fraction(1, BUILDER_UNIT_LDU * BUILDER_UNIT_LDU)
        return tuple(  # type: ignore[return-value]
            scale * sum(Fraction(m[b * 3 + a]) * shifted[b] for b in range(3)) for a in range(3)
        )

    def apply_direction(self, direction: Sequence[int]) -> tuple[int, int, int]:
        m = self.linear
        mapped: list[int] = []
        for a in range(3):
            total = sum(m[a * 3 + b] * direction[b] for b in range(3))
            if total % BUILDER_UNIT_LDU != 0:
                raise ValueError(
                    f"Frame for {self.design_id} maps direction {list(direction)} to a non-unit "
                    f"axis component {total}; a field axis must stay an axis."
                )
            mapped.append(total // BUILDER_UNIT_LDU)
        return (mapped[0], mapped[1], mapped[2])

    @property
    def canonical_text(self) -> str:
        return "\n".join(
            (
                FRAME_SCHEMA_VERSION,
                f"designId={self.design_id}",
                f"revision={self.revision}",
                f"recordSha256={self.record_sha256}",
                f"builderNativeFrameId={BUILDER_NATIVE_FRAME_ID}",
                f"turn={self.turn}",
                "linearLdu=" + ",".join(str(value) for value in self.linear),
                "translationLdu=" + ",".join(str(value) for value in self.translation),
                f"derivation={self.derivation}",
                "",
            )
        )

    @property
    def digest(self) -> str:
        return hashlib.sha256(self.canonical_text.encode("utf-8")).hexdigest()


def _anchor_groups(
    nodes: Sequence[BuilderNode],
    stud_positions: Sequence[Rational3],
    tube_positions: Sequence[Rational3],
) -> list[tuple[tuple[BuilderNode, ...], tuple[Rational3, ...]]]:
    male = tuple(node for node in nodes if node.family in MALE_FAMILIES)
    tubes = tuple(node for node in nodes if node.family in TUBE_FAMILIES)
    groups = []
    if male or stud_positions:
        groups.append((male, tuple(stud_positions)))
    if tubes or tube_positions:
        groups.append((tubes, tuple(tube_positions)))
    return groups


def exact_frames(
    design_id: str,
    revision: str,
    record_sha256: str,
    nodes: Sequence[BuilderNode],
    stud_positions: Sequence[Rational3],
    tube_positions: Sequence[Rational3],
) -> list[BuilderLdrawFrame]:
    """Every frame under which the authored lattice lands exactly on measured LDraw truth.

    Exact means exact: the comparison is rational equality, not a tolerance, and
    a frame survives only if it is a bijection — no authored node without a
    measured feature, and no measured feature without an authored node.
    """

    groups = _anchor_groups(nodes, stud_positions, tube_positions)
    anchored = [group for group in groups if group[0] and group[1]]
    if not anchored:
        return []
    found: list[BuilderLdrawFrame] = []
    source, targets = anchored[0]
    for turn in TURNS:
        frame_seed = BuilderLdrawFrame(
            design_id=design_id,
            revision=revision,
            record_sha256=record_sha256,
            turn=turn,
            translation=(Fraction(0), Fraction(0), Fraction(0)),
            derivation="probe",
        )
        seen: set[Rational3] = set()
        for target in targets:
            mapped = frame_seed.apply(source[0].builder)
            translation = tuple(target[a] - mapped[a] for a in range(3))
            if translation in seen:
                continue
            seen.add(translation)  # type: ignore[arg-type]
            frame = BuilderLdrawFrame(
                design_id=design_id,
                revision=revision,
                record_sha256=record_sha256,
                turn=turn,
                translation=translation,  # type: ignore[arg-type]
                derivation="exact-lattice-correspondence",
            )
            if all(_is_bijection(frame, group, group_targets) for group, group_targets in groups):
                found.append(frame)
    return found


def _is_bijection(
    frame: BuilderLdrawFrame,
    nodes: Sequence[BuilderNode],
    targets: Sequence[Rational3],
) -> bool:
    if len(nodes) != len(targets):
        return False
    pool = list(targets)
    for node in nodes:
        mapped = frame.apply(node.builder)
        if mapped not in pool:
            return False
        pool.remove(mapped)
    return not pool


def frames_modulo_symmetry(
    frames: Sequence[BuilderLdrawFrame],
    symmetries: Sequence[tuple[str, Rational3]],
) -> list[list[int]]:
    """Group exact frames into classes that a part's own symmetry cannot tell apart.

    Two frames in one class emit the same connector set, so the residual choice
    between them is not a decision anything downstream can observe. Two frames in
    different classes are a real ambiguity and need an independent witness.
    """

    classes: list[list[int]] = []
    for index, frame in enumerate(frames):
        placed = False
        for group in classes:
            if _same_class(frames[group[0]], frame, symmetries):
                group.append(index)
                placed = True
                break
        if not placed:
            classes.append([index])
    return classes


def apply_symmetry(turn: str, translation: Rational3, point: Rational3) -> Rational3:
    """One LDraw-to-LDraw self-symmetry: a turn about the vertical axis, no scale."""

    (a, b), (c, d), _ = TURNS[turn]
    return (
        a * point[0] + b * point[2] + translation[0],
        point[1] + translation[1],
        c * point[0] + d * point[2] + translation[2],
    )


def _same_class(
    left: BuilderLdrawFrame,
    right: BuilderLdrawFrame,
    symmetries: Sequence[tuple[str, Rational3]],
) -> bool:
    for turn, translation in symmetries:
        probes = (
            (Fraction(0), Fraction(0), Fraction(0)),
            (Fraction(1), Fraction(0), Fraction(0)),
            (Fraction(0), Fraction(1), Fraction(0)),
            (Fraction(0), Fraction(0), Fraction(1)),
        )
        if all(
            apply_symmetry(turn, translation, left.apply(probe)) == right.apply(probe)
            for probe in probes
        ):
            return True
    return False


def canonical_frame(frames: Sequence[BuilderLdrawFrame]) -> BuilderLdrawFrame:
    """The proper quarter turn with the smallest angle among equivalent frames."""

    proper = [frame for frame in frames if frame.determinant_sign == 1]
    if not proper:
        raise ValueError(
            "Every surviving frame needs a mirror. Builder and LDraw are both right-handed, so a "
            "mirrored frame means the source lattice or the native pack frame is misread, not that "
            "the part is mirrored."
        )
    return min(proper, key=lambda frame: PROPER_TURNS.index(frame.turn))


def lattice_phase_census(
    nodes: Sequence[BuilderNode], frame: BuilderLdrawFrame
) -> dict[str, object]:
    """Which families ever sit on a stud cell of this part, measured not assumed.

    This is the evidence that decides what may be emitted. A grip is a place a
    stud can be held, so it has to sit on the part's own 20 LDU cell lattice. A
    family that never lands there — the tube at the corner of four cells, the
    rail between two, the plane and edge markers — cannot be a grip whatever it
    is called, and emitting one would invent a connection the part cannot make.
    """

    grips = [
        frame.apply(node.builder)
        for node in nodes
        if node.family in MALE_FAMILIES or node.family in FEMALE_FAMILIES
    ]
    if not grips:
        return {"state": "no-grip-node-sets-the-cell-phase-for-this-part"}
    phase = (grips[0][0] % STUD_PITCH_LDU, grips[0][2] % STUD_PITCH_LDU)
    disagreeing = [
        [str(point[0]), str(point[2])]
        for point in grips
        if (point[0] % STUD_PITCH_LDU, point[2] % STUD_PITCH_LDU) != phase
    ]
    census: dict[int, dict[str, int]] = {}
    for node in nodes:
        point = frame.apply(node.builder)
        key = "/".join(
            "cell" if point[axis] % STUD_PITCH_LDU == phase[index] else "half"
            for index, axis in enumerate((0, 2))
        )
        census.setdefault(node.family, {})[key] = census.setdefault(node.family, {}).get(key, 0) + 1
    return {
        "cellPhaseLdu": [str(phase[0]), str(phase[1])],
        "gripNodesOffThatPhase": disagreeing,
        "byFamily": {
            str(family): dict(sorted(rows.items())) for family, rows in sorted(census.items())
        },
        "meaning": (
            "cell/cell is a stud cell of this part; anything with a half in either axis sits at the "
            "10 LDU half pitch, where no stud can be held"
        ),
    }


def _exact_float(value: Fraction, node: BuilderNode, frame: BuilderLdrawFrame) -> float:
    projected = float(value)
    if Fraction(projected) != value:
        raise ValueError(
            f"Frame for {frame.design_id} maps node ({node.col}, {node.row}) to {value}, which no "
            "float64 represents exactly. A connector position is a physical claim and must not be "
            "rounded on the way out."
        )
    return projected


def emit_connectors(
    nodes: Sequence[BuilderNode], frame: BuilderLdrawFrame
) -> list[dict[str, object]]:
    """The candidate connectors one Builder record carries, in LDraw part-local LDU.

    Families 0 and 1 are studs, family 15 is the under-stud clutch. Families 7
    and 9 are the tubes and rails that make a clutch grip; they sit at the half
    pitch between cells, where no stud can be held, so they are measured and
    reported but never emitted. Emitting them would invent a grip.
    """

    connectors: list[dict[str, object]] = []
    for node in nodes:
        if node.family in MALE_FAMILIES:
            kind, gender, sign = "stud", "male", 1
        elif node.family in FEMALE_FAMILIES:
            kind, gender, sign = "undersideClutch", "female", -1
        else:
            continue
        position = frame.apply(node.builder)
        normal = frame.apply_direction(node.axis)
        connectors.append(
            {
                "kind": kind,
                "gender": gender,
                "positionLdu": [_exact_float(value, node, frame) for value in position],
                "normal": [float(sign * value) for value in normal],
            }
        )
    connectors.sort(key=lambda row: (str(row["kind"]), tuple(row["positionLdu"])))  # type: ignore[arg-type]
    return connectors
