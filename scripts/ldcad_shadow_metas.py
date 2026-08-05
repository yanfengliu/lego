"""One `0 !LDCAD` meta line, parsed under fixed bounds and never interpreted.

A shadow file is human-editable text an untrusted third party wrote, so every
number, count and bracket here is bounded and every unreadable clause is a
refusal that names what it saw. Nothing in this module knows what a snap means:
it turns text into positions, orientations, sections and grid cells, and the
composition module decides which of those is a place a stud is held.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from fractions import Fraction

MAX_SHADOW_LINE_BYTES = 4_096
MAX_SHADOW_LINES = 4_096
MAX_METAS_PER_FILE = 512
MAX_META_PARAMETERS = 32
MAX_SECTIONS = 16
MAX_GRID_CELLS = 1_024
MAX_GRID_COUNT = 64
MAX_DECIMAL_DIGITS = 24

SNAP_COMMANDS = ("SNAP_CYL", "SNAP_CLP", "SNAP_FGR", "SNAP_GEN", "SNAP_INCL", "SNAP_CLEAR")
KNOWN_COMMANDS = SNAP_COMMANDS + ("MIRROR_INFO", "HINTS")
META_PREFIX = "0 !LDCAD"

Rational3 = tuple[Fraction, Fraction, Fraction]
Matrix3 = tuple[Fraction, ...]
IDENTITY3: Matrix3 = (
    Fraction(1),
    Fraction(0),
    Fraction(0),
    Fraction(0),
    Fraction(1),
    Fraction(0),
    Fraction(0),
    Fraction(0),
    Fraction(1),
)


def exact_number(token: str, label: str) -> Fraction:
    """One decimal token as an exact rational, or a refusal naming the token."""

    if len(token) > MAX_DECIMAL_DIGITS:
        raise ValueError(
            f"{label} is {token!r}, which is longer than the {MAX_DECIMAL_DIGITS}-character bound "
            "on a shadow-library number."
        )
    try:
        return Fraction(Decimal(token))
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"{label} is {token!r}, which is not a decimal number.") from error


@dataclass(frozen=True)
class ShadowMeta:
    """One `0 !LDCAD <COMMAND> [key=value]...` line, parsed but not interpreted."""

    command: str
    parameters: dict[str, str]
    line_number: int
    source_path: str

    @property
    def label(self) -> str:
        return f"{self.source_path}:{self.line_number} {self.command}"

    def text(self, key: str) -> str | None:
        return self.parameters.get(key.lower())

    def tokens(self, key: str) -> list[str]:
        value = self.text(key)
        return [] if value is None else value.split()

    def vector3(self, key: str, default: Rational3) -> Rational3:
        tokens = self.tokens(key)
        if not tokens:
            return default
        if len(tokens) != 3:
            raise ValueError(
                f"{self.label} declares [{key}={' '.join(tokens)}] with {len(tokens)} values; a "
                "position needs exactly three."
            )
        return (
            exact_number(tokens[0], f"{self.label} {key}[x]"),
            exact_number(tokens[1], f"{self.label} {key}[y]"),
            exact_number(tokens[2], f"{self.label} {key}[z]"),
        )

    def matrix3(self, key: str) -> Matrix3:
        tokens = self.tokens(key)
        if not tokens:
            return IDENTITY3
        if len(tokens) != 9:
            raise ValueError(
                f"{self.label} declares [{key}=...] with {len(tokens)} values; an orientation is a "
                "row-major 3x3 matrix of exactly nine."
            )
        return tuple(
            exact_number(token, f"{self.label} {key}[{index}]")
            for index, token in enumerate(tokens)
        )

    def flag(self, key: str) -> bool:
        value = self.text(key)
        if value is None:
            return False
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes"):
            return True
        if lowered in ("false", "0", "no"):
            return False
        raise ValueError(
            f"{self.label} declares [{key}={value!r}]; a boolean shadow parameter is true or false."
        )


@dataclass(frozen=True)
class Section:
    """One `shapeVariant radius length` block of a `[secs=...]` list."""

    variant: str
    radius: Fraction
    length: Fraction


def parse_sections(meta: ShadowMeta) -> tuple[Section, ...]:
    """The `[secs=...]` list as blocks, or a refusal naming the malformed block."""

    tokens = meta.tokens("secs")
    if not tokens:
        return ()
    if len(tokens) % 3 != 0:
        raise ValueError(
            f"{meta.label} declares [secs={' '.join(tokens)}] with {len(tokens)} tokens; sections "
            "come in blocks of three (shapeVariant radius length)."
        )
    if len(tokens) // 3 > MAX_SECTIONS:
        raise ValueError(
            f"{meta.label} declares {len(tokens) // 3} sections; the bound is {MAX_SECTIONS}."
        )
    sections = []
    for index in range(0, len(tokens), 3):
        variant = tokens[index].upper()
        if variant not in ("R", "A", "S", "_L", "L_"):
            raise ValueError(
                f"{meta.label} section {index // 3} has shape variant {tokens[index]!r}; LDCad "
                "defines R (round), A (axle), S (square), _L and L_."
            )
        sections.append(
            Section(
                variant=variant,
                radius=exact_number(tokens[index + 1], f"{meta.label} section {index // 3} radius"),
                length=exact_number(tokens[index + 2], f"{meta.label} section {index // 3} length"),
            )
        )
    return tuple(sections)


def parse_grid(meta: ShadowMeta) -> tuple[tuple[Fraction, Fraction], ...]:
    """`[grid=[C] cnt... step...]` as the exact (dx, dy, dz) offsets it stands for.

    A `C` prefix centres that axis on the position; without it the offsets run
    from the position in the positive direction. This is the one clause that
    turns a whole anti-stud field into a single line, so getting its phase wrong
    would move every cell it emits by half a stud.

    Two forms occur in the pinned library: the plan form of two counts and two
    steps, and a three-axis form of three counts and three steps that repeats up
    the part as well — 52 of its files use the latter. Which form a clause is in
    is decided by arithmetic, not by guessing: `k` counts are followed by exactly
    `k` steps, so exactly one of `k = 2` and `k = 3` can consume the tokens, and
    a clause that both or neither would accept is refused by name.
    """

    tokens = meta.tokens("grid")
    if not tokens:
        return ((Fraction(0), Fraction(0), Fraction(0)),)
    readings = [
        reading
        for reading in (_read_grid_counts(tokens, arity) for arity in (2, 3))
        if reading is not None
    ]
    if len(readings) != 1:
        raise ValueError(
            f"{meta.label} declares [grid={' '.join(tokens)}], which "
            f"{'no' if not readings else 'more than one'} reading of "
            "`k counts then k steps` accepts. LDCad grids are two counts and two steps in the "
            "plan, or three counts and three steps including the vertical."
        )
    counts, step_tokens = readings[0]
    for _, count in counts:
        if count < 1 or count > MAX_GRID_COUNT:
            raise ValueError(
                f"{meta.label} declares a grid count of {count} in [grid={' '.join(tokens)}]; the "
                f"allowed range is 1..{MAX_GRID_COUNT}."
            )
    axes = ("x", "z") if len(counts) == 2 else ("x", "y", "z")
    steps = [
        exact_number(token, f"{meta.label} grid {axis} step")
        for axis, token in zip(axes, step_tokens)
    ]
    cells = 1
    for _, count in counts:
        cells *= count
    if cells > MAX_GRID_CELLS:
        raise ValueError(f"{meta.label} expands to {cells} grid cells; the bound is {MAX_GRID_CELLS}.")
    per_axis: dict[str, list[Fraction]] = {}
    for axis, (centered, count), step in zip(axes, counts, steps):
        per_axis[axis] = [
            (Fraction(2 * index - (count - 1), 2) if centered else Fraction(index)) * step
            for index in range(count)
        ]
    offsets = [
        (x, y, z)
        for x in per_axis["x"]
        for y in per_axis.get("y", [Fraction(0)])
        for z in per_axis["z"]
    ]
    return tuple(offsets)


def _read_grid_counts(
    tokens: list[str], arity: int
) -> tuple[list[tuple[bool, int]], list[str]] | None:
    """`arity` count entries followed by exactly `arity` steps, or None.

    Structure only. A count outside the allowed range is a refusal for the
    clause, not a reason to prefer the other arity, so the range check happens
    once the reading is chosen.
    """

    counts: list[tuple[bool, int]] = []
    index = 0
    for _ in range(arity):
        centered = index < len(tokens) and tokens[index].upper() == "C"
        index += 1 if centered else 0
        if index >= len(tokens) or not tokens[index].isdigit():
            return None
        counts.append((centered, int(tokens[index])))
        index += 1
    return (counts, tokens[index:]) if len(tokens) - index == arity else None


def _parse_parameters(rest: str, label: str) -> dict[str, str]:
    parameters: dict[str, str] = {}
    position = 0
    while position < len(rest):
        start = rest.find("[", position)
        if start < 0:
            break
        end = rest.find("]", start)
        if end < 0:
            raise ValueError(f"{label} has an unterminated [ parameter bracket.")
        body = rest[start + 1 : end]
        if "=" not in body:
            raise ValueError(f"{label} has parameter {body!r} with no '=' separator.")
        key, _, value = body.partition("=")
        key = key.strip().lower()
        if not key:
            raise ValueError(f"{label} has a parameter with an empty name.")
        stripped_value = value.strip()
        if key in parameters and parameters[key] != stripped_value:
            # A repeat that agrees with itself is redundant authoring — `parts/32474.dat`
            # states [group=techBallJnt] twice — and reading it changes nothing. A repeat
            # that disagrees has two answers and no rule for choosing, so it is refused.
            raise ValueError(
                f"{label} declares [{key}={parameters[key]}] and [{key}={stripped_value}]; a "
                "parameter that contradicts itself has no defined value."
            )
        parameters[key] = stripped_value
        if len(parameters) > MAX_META_PARAMETERS:
            raise ValueError(f"{label} declares more than {MAX_META_PARAMETERS} parameters.")
        position = end + 1
    return parameters


def parse_shadow_metas(text: str, source_path: str) -> tuple[ShadowMeta, ...]:
    """Every active `0 !LDCAD` meta in one shadow file, in file order.

    A commented meta (`0 //!LDCAD ...`) is text, not a claim, and is skipped —
    `p/stud4.dat` disables its inherited anti-stud that way, and reading it as
    active would hand every stud tube in the library a clutch it does not have.
    """

    lines = text.splitlines()
    if len(lines) > MAX_SHADOW_LINES:
        raise ValueError(
            f"Shadow file {source_path} has {len(lines)} lines; the bound is {MAX_SHADOW_LINES}."
        )
    metas: list[ShadowMeta] = []
    for number, raw in enumerate(lines, 1):
        if len(raw) > MAX_SHADOW_LINE_BYTES:
            raise ValueError(
                f"Shadow file {source_path}:{number} is {len(raw)} characters; the bound is "
                f"{MAX_SHADOW_LINE_BYTES}."
            )
        stripped = raw.strip()
        if not stripped.startswith(META_PREFIX):
            continue
        rest = stripped[len(META_PREFIX) :].strip()
        command = rest.split("[", 1)[0].strip().split(" ", 1)[0].upper()
        label = f"{source_path}:{number}"
        if command not in KNOWN_COMMANDS:
            raise ValueError(
                f"{label} declares LDCad command {command!r}; this reader knows "
                f"{sorted(KNOWN_COMMANDS)}. An unknown command may carry connectivity, so it is a "
                "refusal rather than a skip."
            )
        metas.append(
            ShadowMeta(
                command=command,
                parameters=_parse_parameters(rest, f"{label} {command}"),
                line_number=number,
                source_path=source_path,
            )
        )
        if len(metas) > MAX_METAS_PER_FILE:
            raise ValueError(
                f"Shadow file {source_path} declares more than {MAX_METAS_PER_FILE} metas."
            )
    return tuple(metas)
