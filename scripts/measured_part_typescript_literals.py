"""TypeScript literal formatting shared by measured-part table renderers."""

from __future__ import annotations

from typing import Sequence


def number_literal(value: float) -> str:
    """One measured LDU coordinate as the shortest TypeScript number that is it.

    An integral measurement prints without a fractional part, matching what a
    TypeScript number literal round-trips to, so the table reads as the integer
    lattice it mostly is.
    """

    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError(f"Cannot emit non-finite measured coordinate {value!r}.")
    if float(value).is_integer() and abs(value) < 2**53:
        return str(int(value))
    return repr(float(value))


def numbers(values: Sequence[float]) -> str:
    return ", ".join(number_literal(value) for value in values)


def string_literal(value: str) -> str:
    if "\\" in value or '"' in value or "\n" in value or "\r" in value:
        raise ValueError(
            f"Measured source text {value!r} contains a character this emitter does not "
            "escape; widen the escaping deliberately rather than emitting broken TypeScript."
        )
    return f'"{value}"'


def exact_bounds_lines(
    field: str, bounds: tuple[tuple[str, str, str], tuple[str, str, str]]
) -> list[str]:
    """An exact bound stays one axis per line, however short its numbers are.

    A newline after the brace is what stops prettier collapsing the pair onto one
    line, so the six measured decimals of a part stay readable side by side.
    """

    minimum = ", ".join(string_literal(value) for value in bounds[0])
    maximum = ", ".join(string_literal(value) for value in bounds[1])
    return [f"    {field}: {{", f"      min: [{minimum}],", f"      max: [{maximum}],", "    },"]
