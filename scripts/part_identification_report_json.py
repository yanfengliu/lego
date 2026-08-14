"""Allocation-safe lexical validation for retained JSON report inputs."""

from __future__ import annotations

import math
import re

MAX_JSON_DEPTH = 64
MAX_JSON_VALUES = 4_000_000
MAX_JSON_CONTAINERS = 500_000
MAX_JSON_STRING_BYTES = 8 * 1024 * 1024
MAX_JSON_TOTAL_STRING_BYTES = 32 * 1024 * 1024
MAX_JSON_NUMBER_BYTES = 256
JSON_STRING_TOKEN = re.compile(
    rb'"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9A-Fa-f]{4}))*"'
)
JSON_NUMBER_TOKEN = re.compile(
    rb"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?"
)


class _JsonBytePreScanner:
    """Validate JSON grammar and allocation ceilings without constructing values."""

    def __init__(
        self,
        data: bytes,
        limits: tuple[int, int, int, int, int, int],
    ) -> None:
        self.data = data
        (
            self.max_depth,
            self.max_values,
            self.max_containers,
            self.max_string_bytes,
            self.max_total_string_bytes,
            self.max_number_bytes,
        ) = limits
        self.index = self.values = self.containers = self.total_string_bytes = 0

    def scan(self) -> None:
        self._skip_whitespace()
        if self.index == len(self.data):
            raise ValueError("expected one JSON value at byte 0, but the input is empty")
        self._parse_value(0)
        self._skip_whitespace()
        if self.index != len(self.data):
            raise ValueError(
                f"unexpected trailing {self._describe_byte(self.data[self.index])} "
                f"at byte {self.index}"
            )

    @staticmethod
    def _describe_byte(value: int) -> str:
        if 0x20 <= value <= 0x7E:
            return repr(chr(value))
        return f"byte 0x{value:02x}"

    def _skip_whitespace(self) -> None:
        while self.index < len(self.data) and self.data[self.index] in b" \t\r\n":
            self.index += 1

    def _observed(self) -> str:
        if self.index >= len(self.data):
            return "end of input"
        return self._describe_byte(self.data[self.index])

    def _unexpected(self, expected: str) -> None:
        raise ValueError(
            f"{expected} at byte {self.index}, observed {self._observed()}"
        )

    def _count_value(self, offset: int) -> None:
        self.values += 1
        if self.values > self.max_values:
            raise ValueError(
                f"exceeds the {self.max_values}-value JSON ceiling at byte {offset}"
            )

    def _count_container(self, depth: int, offset: int) -> None:
        self.containers += 1
        if self.containers > self.max_containers:
            raise ValueError(
                f"exceeds the {self.max_containers}-container JSON ceiling at byte {offset}"
            )
        if depth > self.max_depth:
            raise ValueError(
                f"exceeds the {self.max_depth}-level JSON depth ceiling at byte {offset}"
            )

    def _scan_string(self) -> None:
        offset = self.index
        match = JSON_STRING_TOKEN.match(self.data, offset)
        if match is None:
            raise ValueError(f"invalid or unterminated JSON string at byte {offset}")
        string_bytes = match.end() - offset - 2
        if string_bytes > self.max_string_bytes:
            raise ValueError(
                f"JSON string at byte {offset} is {string_bytes} encoded bytes; the per-string "
                f"ceiling is {self.max_string_bytes} bytes"
            )
        self.total_string_bytes += string_bytes
        if self.total_string_bytes > self.max_total_string_bytes:
            raise ValueError(
                f"JSON strings total {self.total_string_bytes} encoded bytes at byte {offset}; "
                f"the aggregate string ceiling is {self.max_total_string_bytes} bytes"
            )
        self.index = match.end()

    def _scan_number(self) -> None:
        offset = self.index
        match = JSON_NUMBER_TOKEN.match(self.data, offset)
        if match is None:
            raise ValueError(f"invalid JSON number at byte {offset}")
        number_bytes = match.end() - offset
        if number_bytes > self.max_number_bytes:
            raise ValueError(
                f"JSON number at byte {offset} is {number_bytes} bytes; the number ceiling is "
                f"{self.max_number_bytes} bytes"
            )
        self.index = match.end()

    def _parse_value(self, depth: int) -> None:
        self._skip_whitespace()
        offset = self.index
        if offset >= len(self.data):
            raise ValueError(
                f"expected a JSON value at byte {offset}, but reached end of input"
            )
        for token in (b"-Infinity", b"Infinity", b"NaN"):
            if self.data.startswith(token, offset):
                reject_nonfinite_json(token.decode("ascii"))
        self._count_value(offset)
        byte = self.data[offset]
        if byte == ord('"'):
            self._scan_string()
            return
        if byte == ord("{"):
            self._count_container(depth + 1, offset)
            self.index += 1
            self._parse_object(depth + 1)
            return
        if byte == ord("["):
            self._count_container(depth + 1, offset)
            self.index += 1
            self._parse_array(depth + 1)
            return
        if byte == ord("-") or ord("0") <= byte <= ord("9"):
            self._scan_number()
            return
        for literal in (b"true", b"false", b"null"):
            if self.data.startswith(literal, offset):
                self.index += len(literal)
                return
        raise ValueError(
            f"expected a JSON value at byte {offset}, observed {self._describe_byte(byte)}"
        )

    def _parse_object(self, depth: int) -> None:
        self._skip_whitespace()
        if self.index < len(self.data) and self.data[self.index] == ord("}"):
            self.index += 1
            return
        while True:
            self._skip_whitespace()
            if self.index >= len(self.data) or self.data[self.index] != ord('"'):
                self._unexpected("expected a JSON object key")
            self._count_value(self.index)
            self._scan_string()
            self._skip_whitespace()
            if self.index >= len(self.data) or self.data[self.index] != ord(":"):
                self._unexpected("expected ':' after the JSON object key")
            self.index += 1
            self._parse_value(depth)
            self._skip_whitespace()
            if self.index < len(self.data) and self.data[self.index] == ord("}"):
                self.index += 1
                return
            if self.index >= len(self.data) or self.data[self.index] != ord(","):
                self._unexpected("expected ',' or '}' after a JSON object value")
            self.index += 1

    def _parse_array(self, depth: int) -> None:
        self._skip_whitespace()
        if self.index < len(self.data) and self.data[self.index] == ord("]"):
            self.index += 1
            return
        while True:
            self._parse_value(depth)
            self._skip_whitespace()
            if self.index < len(self.data) and self.data[self.index] == ord("]"):
                self.index += 1
                return
            if self.index >= len(self.data) or self.data[self.index] != ord(","):
                self._unexpected("expected ',' or ']' after a JSON array value")
            self.index += 1


def _require_limit(name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{name} must be a non-negative integer, observed {value!r}")


def prescan_json_bytes(
    data: bytes,
    *,
    max_bytes: int,
    max_depth: int,
    max_values: int,
    max_containers: int,
    max_string_bytes: int,
    max_total_string_bytes: int,
    max_number_bytes: int,
) -> None:
    limits = {
        "JSON byte ceiling": max_bytes,
        "JSON depth ceiling": max_depth,
        "JSON value ceiling": max_values,
        "JSON container ceiling": max_containers,
        "JSON per-string byte ceiling": max_string_bytes,
        "JSON aggregate string byte ceiling": max_total_string_bytes,
        "JSON number byte ceiling": max_number_bytes,
    }
    for name, value in limits.items():
        _require_limit(name, value)
    if len(data) > max_bytes:
        raise ValueError(
            f"contains {len(data)} JSON bytes; the byte ceiling is {max_bytes} bytes"
        )
    if data.startswith(b"\xef\xbb\xbf"):
        raise ValueError("UTF-8 byte-order marks are not permitted")
    _JsonBytePreScanner(
        data,
        (
            max_depth,
            max_values,
            max_containers,
            max_string_bytes,
            max_total_string_bytes,
            max_number_bytes,
        ),
    ).scan()


def reject_nonfinite_json(token: str) -> None:
    raise ValueError(f"non-finite JSON number {token}")


def parse_finite_json_float(token: str) -> float:
    value = float(token)
    if not math.isfinite(value):
        reject_nonfinite_json(token)
    return value


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for key, item in pairs:
        if key in value:
            preview = key if len(key) <= 120 else key[:117] + "..."
            suffix = "" if len(key) <= 120 else f" (string length {len(key)})"
            raise ValueError(f"duplicate JSON object key {preview!r}{suffix}")
        value[key] = item
    return value
