"""Retrieve a booklet part by what it was described as, not by what its crop looks like.

The shipping identification chain retrieves with a hand-written pixel descriptor:
a square-padded grid over the callout crop, matched against a thumbnail of every
inventory element. That descriptor is the ceiling on the whole chain, because a
vision call only ever chooses among the six elements it puts up. When the right
element is not in those six, no model and no prompt can answer correctly.

The pixel route has a failure mode no amount of model quality repairs: a
contaminated crop. Element 302028 (Green Plate 2 x 4) is drawn in the parts list
as two overlapping plates next to a printed "2x" glyph on grey, so its
descriptor is a picture of that composite rather than of a plate, and the plate
drawings that should be nearest to it are not.

But the inventory was never an unknown set of pictures. Every element in the
booklet's back matter resolves to a part number, a full descriptive name, an
LDraw colour and a quantity. That is structured text, and the identification
prompt already pays for the query side of the same structure: it asks the model
to describe the query part on its own -- kind, bounding stud dimensions, colour
-- before picking. The scorer then reads `pick` and throws the description away.

This module is the other retrieval: parse each known element's name into the same
four fields the model is asked to produce, and rank the inventory by how well a
described query matches. Nothing here looks at a pixel.

It measures and it compares. It admits no part, resolves no identity, overrides
no pair-judged verdict, changes no shortlist and writes nothing; the driver in
`score_description_retrieval.py` reads artifacts and hands plain data here.

Two honesty rules the parser holds to:

* A field it cannot read is *unparsed*, never zero and never a guess. An
  unparsed field costs a fixed neutral amount on every comparison, so an element
  whose name carries no stud dimensions neither wins nor loses by silence. The
  driver reports every name whose dimensions or family the parser could not
  read, by name, so the gap is visible rather than absorbed.
* A name admits more than one honest reading of `kind`. "Plate Round Corner 4 x
  4" is a plate and it is round; a describer shown that drawing may say either
  and be right. So an element carries a *set* of kinds rather than one, and the
  set is built from what the drawing looks like, not from which answer would
  have scored better.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

# The colour names the identification prompt names and the grader compares
# against, keyed by LDraw code. Kept as data here rather than imported from
# packages/catalog/src/colors.ts because this module is a measurement over a
# retained artifact whose colour codes are fixed; if the palette gains a code
# this set does not cover, `colour_name` returns None and the driver reports it
# as unparsed rather than silently matching nothing.
COLOUR_NAME_BY_LDRAW_CODE: dict[int, str] = {
    0: "Black",
    1: "Blue",
    2: "Green",
    3: "Dark Turquoise",
    4: "Red",
    5: "Dark Pink",
    6: "Brown",
    7: "Light Gray",
    8: "Dark Gray",
    9: "Light Blue",
    10: "Bright Green",
    11: "Light Turquoise",
    12: "Salmon",
    13: "Pink",
    14: "Yellow",
    15: "White",
    17: "Light Green",
    18: "Light Yellow",
    19: "Tan",
    20: "Light Violet",
    22: "Purple",
    25: "Orange",
    26: "Magenta",
    27: "Lime",
    28: "Dark Tan",
    29: "Bright Pink",
    70: "Reddish Brown",
    71: "Light Bluish Gray",
    72: "Dark Bluish Gray",
    73: "Medium Blue",
    74: "Medium Green",
    77: "Light Pink",
    85: "Dark Purple",
    92: "Nougat",
    272: "Dark Blue",
    288: "Dark Green",
    320: "Dark Red",
    321: "Dark Azure",
    322: "Medium Azure",
    330: "Olive Green",
    378: "Sand Green",
    379: "Sand Blue",
    462: "Medium Orange",
    484: "Dark Orange",
    503: "Very Light Gray",
}

# The `kind` vocabulary the identification prompt hands the model. A parsed
# element's kind set is always a subset of this, so a query kind and an element
# kind are always drawn from the same alphabet.
KIND_VOCABULARY = frozenset(
    {"brick", "plate", "tile", "slope", "wedge", "arch", "round", "technic", "other"}
)

# What a described stud dimension costs when one side does not have one. Half of
# the maximum a dimension term can cost, so an unreadable name is exactly as far
# from every query as it is from every other -- it cannot be the nearest by
# default and it cannot be pushed off the list by default either.
UNPARSED_DIMENSION_COST = 0.5

# What a kind disagreement costs when the element's own family is unreadable.
UNPARSED_KIND_COST = 0.5


def colour_name(color_id: str | int) -> str | None:
    """The prompt's display name for an LDraw colour code, or None if unknown."""

    try:
        code = int(color_id)
    except (TypeError, ValueError):
        return None
    return COLOUR_NAME_BY_LDRAW_CODE.get(code)


# "1 1/2", "2/3" and "12" all appear as dimension terms in these names. Only a
# whole or mixed number can be a stud count; a bare fraction ("x 2/3") is a plate
# height and never a stud dimension.
_MIXED = r"\d+\s+\d+/\d+"
_FRACTION = r"\d+/\d+"
_WHOLE = r"\d+"
_TERM = rf"(?:{_MIXED}|{_FRACTION}|{_WHOLE})"
_DIMENSION_RUN = re.compile(rf"(?<![\d/])({_TERM})(?:\s*[x×]\s*({_TERM}))+(?![\d/])")
_TERM_SPLIT = re.compile(rf"({_TERM})")


def _term_value(term: str) -> float:
    """A dimension term as a number: "1 1/2" -> 1.5, "2/3" -> 0.667, "12" -> 12."""

    term = term.strip()
    mixed = re.fullmatch(rf"({_WHOLE})\s+({_WHOLE})/({_WHOLE})", term)
    if mixed is not None:
        return int(mixed.group(1)) + int(mixed.group(2)) / int(mixed.group(3))
    fraction = re.fullmatch(rf"({_WHOLE})/({_WHOLE})", term)
    if fraction is not None:
        return int(fraction.group(1)) / int(fraction.group(2))
    return float(term)


def _ceil_studs(value: float) -> int:
    """A fractional footprint occupies the studs it overhangs, so it rounds up."""

    return max(1, math.ceil(value - 1e-9))


def stud_dimensions(name: str) -> tuple[int, int] | None:
    """The bounding stud footprint a part name states, longest side first.

    A LEGO part name states its footprint as a run of ``N x M`` terms, and the
    order in that run is positional: the first two terms are the footprint and a
    third is a height in plate units. "Brick 1 x 1 x 3" is one stud square and
    three bricks tall; "Brick Curved 1 x 12 x 1 2/3" is 12 x 1 and 1 2/3 tall.
    Reading the height as a dimension by size instead of by position turns that
    part into a 12 x 2, which is a different part -- so position decides.

    A name may state more than one run ("Bracket 1 x 2 - 2 x 4", "Plate 2 x 3
    with 1 x 1 Cutout", "Plate Round Corner 5 x 5 with 4 x 4 Round Cutout"). The
    prompt asks the describer for "the maximum stud-grid bounding-box
    dimensions", so the runs are combined as a bounding box: the largest long
    side seen with the largest short side seen. That is right for a bracket's L,
    for a cutout inside a larger footprint, and for an arm on a corner plate.

    Returns None when the name states no run at all, which is the honest answer
    for "Bar 3L", "Technic Axle 3" and every minifigure accessory.
    """

    long_side = 0.0
    short_side = 0.0
    for run in _DIMENSION_RUN.finditer(name):
        terms = [_term_value(t) for t in _TERM_SPLIT.findall(run.group(0))]
        if len(terms) < 2:
            continue
        footprint = terms[:2]
        long_side = max(long_side, max(footprint))
        short_side = max(short_side, min(footprint))
    if long_side <= 0.0:
        return None
    return (_ceil_studs(long_side), _ceil_studs(short_side))


# Family readings, tried in order. The first pattern a name matches decides its
# kind set. Each entry is (pattern, kinds) and every kind is in KIND_VOCABULARY.
#
# A set rather than one kind because a drawing is often honestly two things at
# once. The rule used throughout: include a kind when a describer looking only
# at the printed drawing could reasonably use that word for it. "Brick Arch" is
# an arch and it is a brick. "Tile Round 1 x 1 Quarter" is round and it is a
# tile. A bracket is an L of two plates, so "plate" and "other" both read.
# Nothing here consults which answer would have scored better.
_FAMILY_READINGS: tuple[tuple[re.Pattern[str], frozenset[str]], ...] = (
    # A Technic brick is a brick: the name says so, and the drawing is a brick
    # with a hole through it. Reading "Technic" as excluding "brick" cost three
    # of the elements in this inventory their whole family term.
    (re.compile(r"^Technic Brick", re.I), frozenset({"technic", "brick", "other"})),
    (re.compile(r"^Technic Plate", re.I), frozenset({"technic", "plate", "other"})),
    (re.compile(r"^Technic\b", re.I), frozenset({"technic", "other"})),
    # Ahead of the Brick family: a separator tool is not a brick, and the word
    # "Brick" in its name is what it separates rather than what it is.
    (re.compile(r"^Brick and Axle Separator", re.I), frozenset({"other"})),
    (re.compile(r"^Brick Wedged", re.I), frozenset({"wedge", "brick", "slope"})),
    (re.compile(r"^Wedge Plate", re.I), frozenset({"wedge", "plate"})),
    (re.compile(r"^Wedge\b", re.I), frozenset({"wedge"})),
    (re.compile(r"^Brick Arch", re.I), frozenset({"arch", "brick", "slope"})),
    (re.compile(r"^Brick Sloped", re.I), frozenset({"slope", "brick"})),
    (re.compile(r"^Brick Curved", re.I), frozenset({"slope", "brick", "round"})),
    (re.compile(r"^Brick Round", re.I), frozenset({"round", "brick"})),
    (re.compile(r"^Brick\b", re.I), frozenset({"brick"})),
    (re.compile(r"^Plate Round", re.I), frozenset({"round", "plate"})),
    (re.compile(r"^Plate Special Round", re.I), frozenset({"round", "plate"})),
    (re.compile(r"^Plate\b", re.I), frozenset({"plate"})),
    (re.compile(r"^Tile Round", re.I), frozenset({"round", "tile"})),
    (re.compile(r"^Tile\b", re.I), frozenset({"tile"})),
    (re.compile(r"^Bracket\b", re.I), frozenset({"plate", "brick", "other"})),
    (re.compile(r"^Slope\b", re.I), frozenset({"slope"})),
    (re.compile(r"^(Cone|Dish|Cylinder)\b", re.I), frozenset({"round", "other"})),
    (re.compile(r"^Bar\b", re.I), frozenset({"other", "technic"})),
    (
        re.compile(
            r"^(Minifig|Torso|Hips|Hair|Weapon|Equipment|Food|Sports|Flame|Light Cover|Brick and Axle)\b",
            re.I,
        ),
        frozenset({"other"}),
    ),
)


def kind_readings(name: str) -> frozenset[str]:
    """Every `kind` word a describer could honestly use for this part's drawing.

    An empty set means the parser did not recognise the family, which the driver
    reports by name; it is not the same as `{"other"}`, which is a positive
    reading that the drawing is none of the named families.
    """

    for pattern, kinds in _FAMILY_READINGS:
        if pattern.search(name) is not None:
            return kinds
    return frozenset()


@dataclass(frozen=True)
class ParsedElement:
    """One inventory element in the same four fields a describer produces."""

    element_id: str
    name: str
    part_num: str
    quantity: int
    kinds: frozenset[str]
    dimensions: tuple[int, int] | None
    colour: str | None

    @property
    def dimensions_parsed(self) -> bool:
        return self.dimensions is not None

    @property
    def kinds_parsed(self) -> bool:
        return len(self.kinds) > 0

    @property
    def colour_parsed(self) -> bool:
        return self.colour is not None


def parse_element(element_id: str, record: dict) -> ParsedElement:
    """Parse one `element-resolution` record. Never raises on an odd name."""

    name = str(record.get("name", ""))
    return ParsedElement(
        element_id=element_id,
        name=name,
        part_num=str(record.get("partNum", "")),
        quantity=int(record.get("quantity", 0)),
        kinds=kind_readings(name),
        dimensions=stud_dimensions(name),
        colour=colour_name(record.get("colorId")),
    )


def parse_inventory(inventory: dict[str, dict]) -> dict[str, ParsedElement]:
    """Every element of the printed inventory, parsed."""

    return {
        element_id: parse_element(element_id, record)
        for element_id, record in inventory.items()
    }


@dataclass(frozen=True)
class DescribedQuery:
    """What the identification call said about the query drawing, on its own."""

    kind: str | None
    studs_long: int | None
    studs_wide: int | None
    colour: str | None

    @classmethod
    def from_answer(cls, answer: dict) -> "DescribedQuery":
        """Read an answers-artifact row. A 0 stud count is "did not read", not 0."""

        def stud(value: object) -> int | None:
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                return None
            return value

        kind = answer.get("kind")
        colour = answer.get("colour")
        return cls(
            kind=kind if isinstance(kind, str) and kind in KIND_VOCABULARY else None,
            studs_long=stud(answer.get("studsLong")),
            studs_wide=stud(answer.get("studsWide")),
            colour=colour if isinstance(colour, str) and colour else None,
        )

    @property
    def dimensions(self) -> tuple[int, int] | None:
        if self.studs_long is None or self.studs_wide is None:
            return None
        return (
            max(self.studs_long, self.studs_wide),
            min(self.studs_long, self.studs_wide),
        )


@dataclass(frozen=True)
class DescriptionWeights:
    """How much each described field is worth.

    Equal by default and deliberately so. Colour splits the retained universe
    about fourteen ways, kind about nine, and the stud footprint many more; there
    is no measurement here that says one is more reliable than another, so
    weighting them apart would be fitting the answer rather than describing the
    method. The driver reports the equal-weight number as the headline and any
    variant beside it, labelled.
    """

    kind: float = 1.0
    dimensions: float = 1.0
    colour: float = 1.0


DEFAULT_WEIGHTS = DescriptionWeights()


def dimension_cost(
    query: tuple[int, int] | None, element: tuple[int, int] | None
) -> float:
    """How far apart two stud footprints are, in [0, 1].

    Scaled by the larger footprint, so being one stud out on a 1 x 2 costs much
    more than being one stud out on a 6 x 10 -- which is how a describer's error
    actually behaves, and what keeps a 2 x 4 from ranking beside a 2 x 14.
    """

    if query is None or element is None:
        return UNPARSED_DIMENSION_COST
    long_gap = abs(query[0] - element[0])
    wide_gap = abs(query[1] - element[1])
    scale = max(query[0], element[0]) + max(query[1], element[1])
    if scale <= 0:
        return UNPARSED_DIMENSION_COST
    return min(1.0, (long_gap + wide_gap) / scale)


def kind_cost(query: str | None, kinds: frozenset[str]) -> float:
    """0 when the described family is one of the readings the name admits."""

    if not kinds:
        return UNPARSED_KIND_COST
    if query is None:
        return UNPARSED_KIND_COST
    return 0.0 if query in kinds else 1.0


def colour_cost(query: str | None, element: str | None) -> float:
    """0 on an exact name match.

    Exact because the prompt names the fourteen colour names it is graded in and
    tells the call to copy one exactly; a softened colour distance merges the
    elements that differ only in colour, which is the majority of this inventory
    (173 distinct names across 276 elements).
    """

    if query is None or element is None:
        return UNPARSED_DIMENSION_COST
    return 0.0 if query == element else 1.0


def score_element(
    query: DescribedQuery,
    element: ParsedElement,
    weights: DescriptionWeights = DEFAULT_WEIGHTS,
) -> float:
    """Total weighted distance from a described query to one known element."""

    return (
        weights.kind * kind_cost(query.kind, element.kinds)
        + weights.dimensions * dimension_cost(query.dimensions, element.dimensions)
        + weights.colour * colour_cost(query.colour, element.colour)
    )


def rank_elements(
    query: DescribedQuery,
    elements: dict[str, ParsedElement],
    weights: DescriptionWeights = DEFAULT_WEIGHTS,
    restrict_to: frozenset[str] | None = None,
) -> list[tuple[str, float]]:
    """The whole universe ordered by description distance, nearest first.

    Ties are broken by element id so a rank is reproducible across runs and
    platforms; the driver reports the tie group size beside every rank, because
    a rank inside a large tie is luck rather than retrieval.
    """

    universe = (
        elements.items()
        if restrict_to is None
        else ((k, v) for k, v in elements.items() if k in restrict_to)
    )
    scored = [(element_id, score_element(query, e, weights)) for element_id, e in universe]
    scored.sort(key=lambda row: (row[1], row[0]))
    return scored


def rank_of(ranked: list[tuple[str, float]], element_id: str) -> int | None:
    """1-based position of an element in a ranking, or None if absent."""

    for position, (candidate, _) in enumerate(ranked, start=1):
        if candidate == element_id:
            return position
    return None


def worst_rank_in_tie(ranked: list[tuple[str, float]], element_id: str) -> int | None:
    """The rank the truth would take if every equally-scored element preceded it.

    A tie is not a retrieval: reporting the optimistic edge of a tie group as the
    rank credits the method for an ordering it did not produce. Recall is
    reported against this pessimistic rank, and the optimistic one beside it.
    """

    position = rank_of(ranked, element_id)
    if position is None:
        return None
    score = ranked[position - 1][1]
    return sum(1 for _, other in ranked if other <= score)
