"""Pinned input and bounded JSON validation for the source-pilot CLI."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_pinned_file(path: Path, expected_bytes: int, expected_sha256: str) -> bytes:
    resolved = path.resolve(strict=True)
    with resolved.open("rb") as stream:
        before = os.fstat(stream.fileno())
        data = stream.read(expected_bytes + 1)
        after = os.fstat(stream.fileno())
    if (before.st_dev, before.st_ino, before.st_size) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
    ):
        raise ValueError(f"Pinned input changed identity or size during its held-handle read: {resolved}")
    if len(data) != expected_bytes or before.st_size != expected_bytes:
        raise ValueError(
            f"Pinned input {resolved} has {before.st_size} bytes and yielded {len(data)}; "
            f"expected exactly {expected_bytes}."
        )
    actual_sha256 = sha256_hex(data)
    if actual_sha256 != expected_sha256:
        raise ValueError(
            f"Pinned input {resolved} is sha256:{actual_sha256}; expected "
            f"sha256:{expected_sha256}. Re-acquire the reviewed bytes; do not update the pin."
        )
    return data


def parse_strict_json(
    data: bytes,
    label: str,
    *,
    max_depth: int,
    max_nodes: int,
    max_string_characters: int,
    max_aggregate_string_characters: int,
) -> object:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} is not strict UTF-8 at byte {error.start}.") from error

    depth = 0
    in_string = False
    escaped = False
    for offset, character in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character in "[{":
            depth += 1
            if depth > max_depth:
                raise ValueError(
                    f"{label} exceeds the maximum JSON depth {max_depth} at character {offset}."
                )
        elif character in "]}":
            depth -= 1
            if depth < 0:
                break

    def no_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"{label} repeats JSON key {key!r}.")
            result[key] = value
        return result

    def no_constant(value: str) -> object:
        raise ValueError(f"{label} contains forbidden non-finite JSON token {value}.")

    try:
        value = json.loads(text, object_pairs_hook=no_duplicates, parse_constant=no_constant)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"{label} is malformed JSON at line {error.lineno}, column {error.colno}: {error.msg}"
        ) from error
    except RecursionError as error:
        raise ValueError(
            f"{label} exceeds the maximum JSON depth {max_depth}; reduce nesting."
        ) from error

    nodes = 0
    aggregate_string_characters = 0
    stack: list[object] = [value]
    while stack:
        current = stack.pop()
        nodes += 1
        if nodes > max_nodes:
            raise ValueError(f"{label} exceeds the maximum JSON node count {max_nodes}.")
        if isinstance(current, str):
            if len(current) > max_string_characters:
                raise ValueError(
                    f"{label} contains a {len(current)}-character string; maximum is "
                    f"{max_string_characters}."
                )
            aggregate_string_characters += len(current)
        elif isinstance(current, list):
            stack.extend(current)
        elif isinstance(current, dict):
            stack.extend(current.values())
            stack.extend(current.keys())
    if aggregate_string_characters > max_aggregate_string_characters:
        raise ValueError(
            f"{label} contains {aggregate_string_characters} aggregate string characters; "
            f"maximum is {max_aggregate_string_characters}."
        )
    return value
