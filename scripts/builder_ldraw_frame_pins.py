"""The pinned Builder-to-LDraw frame of each 6651557 pilot part.

A pin is not a shortcut past the derivation. `derive-builder-ldraw-frame.py`
re-derives every frame from the archives and the native pack on each run and
refuses to continue if what it derives is not the frame pinned here, digest
included. The pin exists so a later run cannot quietly use a different frame:
the digest binds the design, the Builder revision letter, the Builder record
SHA-256, the matrix and the translation together, so changing any one of them
changes the digest and stops the run.

Two derivation classes, and the difference matters:

  * `exact-lattice-correspondence` — Builder's authored nodes land on the
    LDraw-measured stud and tube centres by exact rational equality. Four of the
    five parts.
  * `registered-discrete-search` — 5092 expands to 84 body triangles with no stud
    and no tube primitive at all, so there is nothing to correspond with. Its
    turn and translation come from a search over the eight axis maps and the
    10 LDU half-stud translation lattice, scored by how far Builder's own shell
    vertices land from the LDraw surface. That is a fit. It is recorded as a fit,
    with its residual, and it is weaker evidence than the other four.

Nothing here admits a part or claims a catalog frame.
"""

from __future__ import annotations

from fractions import Fraction

from builder_ldraw_frame import BuilderLdrawFrame

EXACT = "exact-lattice-correspondence"
REGISTERED = "registered-discrete-search"

_PINS: tuple[tuple[str, str, str, str, tuple[int, int, int], str, str], ...] = (
    (
        "5092",
        "N",
        "7478be166332b46c8b66f85c9e1e836aaf86d24b15e0c57b5d4a273334088387",
        "turn0",
        (-10, 8, 0),
        REGISTERED,
        "f48e2242bc1f42d9291d64d1bf97dd75e8c32af30f39d103c30c8789fd3bb2f1",
    ),
    (
        "35480",
        "K",
        "56886b144f0f29acbf61903ef9a130f9c811fd1f2a3710a2bb04b98a868298b1",
        "turn0",
        (-10, 8, 0),
        EXACT,
        "51bcbea5563eebc63f31ab94b9adce6c3afbe3e853ca0993a8903eb687e8de08",
    ),
    (
        "51739",
        "H",
        "da86abdd5f2b9af54cc8ba8c6aa5272aa5d0279f6ae16a732a1f83393a1c62de",
        "turn0",
        (-30, 8, 10),
        EXACT,
        "c751e7f29482b0473a63e3f81f0e18dccb9f4b76e789136574404b80a837abbb",
    ),
    (
        "77844",
        "B",
        "cca5e0d252747190c53e10c5a78470a0c721771db19b5b8d84fd2d422184ad6b",
        "turn180",
        (40, 8, 0),
        EXACT,
        "34bc33eaf401db50385d8b05ea4adbe9ec8976ee97614ad8e908672852708411",
    ),
    (
        "93273",
        "M",
        "9b517c4de9785e37ef9c9c3e403c5c478dcad8f7fbc26a6af2abae5a447110a9",
        "turn90",
        (0, 0, -30),
        EXACT,
        "a28a51b7dddf06067c2563e2f63d8389fff26d7bbce8703d18ae140c19f26d2d",
    ),
)

PINNED_FRAMES: dict[str, BuilderLdrawFrame] = {
    design_id: BuilderLdrawFrame(
        design_id=design_id,
        revision=revision,
        record_sha256=record_sha256,
        turn=turn,
        translation=(Fraction(translation[0]), Fraction(translation[1]), Fraction(translation[2])),
        derivation=derivation,
    )
    for design_id, revision, record_sha256, turn, translation, derivation, _ in _PINS
}

PINNED_FRAME_DIGESTS: dict[str, str] = {
    design_id: digest for design_id, _, _, _, _, _, digest in _PINS
}

# 30357 has no entry, and that is a measurement rather than an omission: the
# 107-record Builder pack does not contain it, so it has no authored node lattice,
# no frame, and no female connectors. It falls back to the LDraw geometric rule,
# which emits zero clutch cells.
UNAVAILABLE_DESIGN_IDS = ("30357",)


def pinned_frame(design_id: str) -> BuilderLdrawFrame:
    frame = PINNED_FRAMES.get(design_id)
    if frame is None:
        raise KeyError(
            f"No Builder-to-LDraw frame is pinned for design {design_id}; pinned designs are "
            f"{sorted(PINNED_FRAMES)} and {list(UNAVAILABLE_DESIGN_IDS)} has no Builder record at all."
        )
    return frame


def check_pinned_digest(frame: BuilderLdrawFrame) -> None:
    expected = PINNED_FRAME_DIGESTS.get(frame.design_id)
    if expected is None:
        raise KeyError(f"No pinned frame digest for design {frame.design_id}.")
    if frame.digest != expected:
        raise ValueError(
            f"Frame for {frame.design_id} hashes to sha256:{frame.digest}; the pin is "
            f"sha256:{expected}. The canonical form that produced it is:\n{frame.canonical_text}"
            "Re-derive and review the frame rather than re-pinning the digest."
        )
