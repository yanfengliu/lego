from __future__ import annotations

import hashlib
import json
import math
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from PIL import Image, ImageDraw


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPOSITORY_ROOT / "output/.codex-wip/2453-stud-discriminator"
DEFAULT_OFFICIAL_ARCHIVE = Path(r"C:\tmp\ldraw-complete-2026-07.zip")
SCHEMA_VERSION = "lego.local-2453-stud-discriminator/1"
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_PNG_BYTES = 1024 * 1024
MAX_PNG_PIXELS = 1024 * 1024
MAX_TOTAL_PNG_PIXELS = 8 * 1024 * 1024
MAX_LDRAW_MEMBER_BYTES = 2 * 1024 * 1024
MAX_LDRAW_CLOSURE_FILES = 512
MAX_LDRAW_RECURSION_DEPTH = 32

OFFICIAL_ARCHIVE_PIN = {
    "bytes": 144_722_356,
    "sha256": "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
    "version": "ldraw-complete-2026-07",
}
INVENTORY_MANIFEST_PIN = {
    "path": "output/inventory-thumbnails/manifest.json",
    "bytes": 269_834,
    "sha256": "sha256:aac36ddc934bd0860782f9158dc80865357d1490b23f74fce827291f09160491",
    "schemaVersion": "lego.inventory-thumbnails/1",
    "sourceHash": "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
}
CALLOUT_MANIFEST_PIN = {
    "path": "output/callout-thumbnails/manifest.json",
    "bytes": 1_018_634,
    "sha256": "sha256:c8d20cfe87ef9d21488725b393b94e61870fcc82b26bb497ea734fc7b97a67bf",
    "schemaVersion": "lego.callout-thumbnails/6",
    "runId": "e49496b28d8fecb0ccc158a1",
    "sourceHash": INVENTORY_MANIFEST_PIN["sourceHash"],
}
SEMANTIC_ARTIFACT_PIN = {
    "path": "output/part-identification/legacy-recut-semantic.json",
    "bytes": 42_105,
    "sha256": "sha256:e92ef982f9039b7fd94fb2cdca23fa5e56fb34fb6820ef4fa7ee9b999a0a63ea",
    "schemaVersion": "lego.part-identification-legacy-recut-semantic/1",
}


@dataclass(frozen=True)
class Control:
    element_id: str
    design_id: str
    expected_kind: str
    expected_primitive: str
    role: str


CONTROLS = (
    Control("614101", "6141", "solid-stud", "p/stud.dat", "calibration"),
    Control("6449593", "32828", "hollow-stud", "p/stud2.dat", "calibration"),
    Control("4211098", "3005", "solid-stud", "p/stud.dat", "same-color-refusal"),
    Control("6388133", "86996", "hollow-stud", "p/stud2a.dat", "same-color-refusal"),
    Control("4255413", "3005", "solid-stud", "p/stud.dat", "same-color-refusal"),
    Control("614126", "6141", "solid-stud", "p/stud.dat", "held-out"),
    Control("6331225", "4588", "hollow-stud", "p/stud2a.dat", "held-out"),
    Control("4210719", "3024", "solid-stud", "p/stud.dat", "held-out"),
    Control("6401023", "86996", "hollow-stud", "p/stud2a.dat", "held-out"),
)

TARGETS = (
    {
        "elementId": "4210690",
        "inventoryFile": "4210690.png",
        "calloutIdentity": "p50|q3|x139.905|y454.590",
        "semanticCollection": "quarantinedSameRelations",
        "semanticDisposition": "quarantined-no-assignment-authority",
    },
    {
        "elementId": "6595205",
        "inventoryFile": "6595205.png",
        "calloutIdentity": "p53|q2|x160.825|y454.591",
        "semanticCollection": "semanticIdentityRelations",
        "semanticDisposition": "semantic-shape-only-no-assignment-authority",
    },
)

CANDIDATE_GEOMETRY = (
    ("2453a", "hollow-stud", "p/stud2a.dat"),
    ("2453b", "solid-stud", "p/stud.dat"),
)


def sha256_prefixed(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    ) + b"\n"


def read_pinned(path: Path, pin: dict[str, object], label: str) -> bytes:
    expected_bytes = int(pin["bytes"])
    if expected_bytes < 1 or expected_bytes > MAX_JSON_BYTES:
        raise ValueError(f"{label} pin has unsafe byte count {expected_bytes}")
    data = path.read_bytes()
    digest = sha256_prefixed(data)
    if len(data) != expected_bytes or digest != pin["sha256"]:
        raise ValueError(
            f"{label} must be exact {expected_bytes}-byte input at {pin['sha256']}; "
            f"received {len(data)} bytes at {digest}."
        )
    return data


def pinned_json(path: Path, pin: dict[str, object], label: str) -> dict[str, object]:
    data = read_pinned(path, pin, label)
    value = json.loads(data)
    if not isinstance(value, dict) or value.get("schemaVersion") != pin["schemaVersion"]:
        raise ValueError(f"{label} must retain schema {pin['schemaVersion']}")
    return value


def hash_file(path: Path, expected_bytes: int) -> str:
    resolved = path.resolve(strict=True)
    if not resolved.is_file() or resolved.stat().st_size != expected_bytes:
        raise ValueError(
            f"Official LDraw archive must be exact {expected_bytes}-byte file; "
            f"received {resolved.stat().st_size if resolved.is_file() else 'missing'}."
        )
    digest = hashlib.sha256()
    observed = 0
    with resolved.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            observed += len(chunk)
            if observed > expected_bytes:
                raise ValueError("Official LDraw archive grew during its bounded digest read")
            digest.update(chunk)
    if observed != expected_bytes:
        raise ValueError("Official LDraw archive changed size during its bounded digest read")
    return f"sha256:{digest.hexdigest()}"


def normalize_member(name: str) -> str:
    normalized = name.replace("\\", "/").lower()
    if normalized.startswith("ldraw/"):
        normalized = normalized.removeprefix("ldraw/")
    path = PurePosixPath(normalized)
    if (
        not normalized
        or path.is_absolute()
        or any(part in ("", ".", "..") for part in normalized.split("/"))
        or ":" in normalized
    ):
        raise ValueError(f"Unsafe LDraw member {name!r}")
    return "/".join(path.parts)


class OfficialGeometry:
    def __init__(self, archive_path: Path) -> None:
        digest = hash_file(archive_path, int(OFFICIAL_ARCHIVE_PIN["bytes"]))
        if digest != OFFICIAL_ARCHIVE_PIN["sha256"]:
            raise ValueError(
                f"Official LDraw archive is {digest}, not {OFFICIAL_ARCHIVE_PIN['sha256']}"
            )
        self.archive = zipfile.ZipFile(archive_path)
        self.members: dict[str, zipfile.ZipInfo] = {}
        try:
            for info in self.archive.infolist():
                if info.is_dir():
                    continue
                key = normalize_member(info.filename)
                if key in self.members:
                    raise ValueError(f"Official LDraw archive repeats normalized member {key}")
                self.members[key] = info
        except BaseException:
            self.archive.close()
            raise

    def close(self) -> None:
        self.archive.close()

    def read(self, path: str) -> bytes:
        info = self.members.get(path)
        if info is None:
            raise FileNotFoundError(f"Official LDraw archive has no {path}")
        if info.flag_bits & 1 or info.file_size < 1 or info.file_size > MAX_LDRAW_MEMBER_BYTES:
            raise ValueError(f"Official LDraw member {path} has unsafe ZIP metadata")
        with self.archive.open(info, "r") as stream:
            data = stream.read(MAX_LDRAW_MEMBER_BYTES + 1)
        if len(data) != info.file_size:
            raise ValueError(f"Official LDraw member {path} changed during read")
        return data

    def references(self, path: str) -> tuple[str, ...]:
        try:
            text = self.read(path).decode("utf-8-sig")
        except UnicodeDecodeError as cause:
            raise ValueError(f"Official LDraw member {path} is not UTF-8 text") from cause
        references = []
        for line_number, line in enumerate(text.splitlines(), 1):
            fields = line.strip().split(maxsplit=14)
            if not fields or fields[0] != "1":
                continue
            if len(fields) != 15:
                raise ValueError(f"Malformed LDraw type-1 line {path}:{line_number}")
            reference = fields[14].replace("\\", "/").lower()
            candidates = (
                (reference,)
                if reference.startswith(("parts/", "p/"))
                else (f"parts/{reference}", reference)
                if reference.startswith("s/")
                else (f"p/{reference}", f"parts/{reference}", reference)
            )
            resolved = next((candidate for candidate in candidates if candidate in self.members), None)
            if resolved is None:
                raise FileNotFoundError(f"LDraw reference {reference} from {path} is missing")
            references.append(resolved)
        return tuple(dict.fromkeys(references))

    def closure(self, root: str) -> tuple[str, ...]:
        visited: set[str] = set()

        def visit(path: str, stack: tuple[str, ...]) -> None:
            if path in stack:
                raise ValueError(f"Recursive LDraw closure {' -> '.join((*stack, path))}")
            if path in visited:
                return
            if len(stack) >= MAX_LDRAW_RECURSION_DEPTH:
                raise ValueError(f"LDraw closure exceeds depth at {path}")
            self.read(path)
            visited.add(path)
            if len(visited) > MAX_LDRAW_CLOSURE_FILES:
                raise ValueError(f"LDraw closure exceeds {MAX_LDRAW_CLOSURE_FILES} files")
            for child in self.references(path):
                visit(child, (*stack, path))

        visit(root, ())
        return tuple(sorted(visited))

    def witness(self, design_id: str, expected_primitive: str) -> dict[str, object]:
        root = f"parts/{design_id}.dat"
        root_bytes = self.read(root)
        closure = self.closure(root)
        if expected_primitive not in closure:
            raise ValueError(
                f"Official {root} closure lacks expected discriminator {expected_primitive}"
            )
        title = root_bytes.decode("utf-8-sig").splitlines()[0].removeprefix("0 ").strip()
        return {
            "closureFiles": len(closure),
            "expectedPrimitive": expected_primitive,
            "root": root,
            "rootBytes": len(root_bytes),
            "rootSha256": sha256_prefixed(root_bytes),
            "title": title,
        }


def image_from_pinned_row(
    root: Path, row: dict[str, object], label: str
) -> tuple[Image.Image, dict[str, object]]:
    relative = PurePosixPath(str(row["file"]))
    if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts):
        raise ValueError(f"{label} has unsafe relative image path {row['file']!r}")
    root_resolved = root.resolve(strict=True)
    path = (root_resolved / Path(*relative.parts)).resolve(strict=True)
    if root_resolved not in path.parents:
        raise ValueError(f"{label} image escapes its authenticated root")
    expected_bytes = int(row["byteLength"])
    if expected_bytes < 1 or expected_bytes > MAX_PNG_BYTES:
        raise ValueError(f"{label} declares unsafe PNG byte count {expected_bytes}")
    data = path.read_bytes()
    digest = sha256_prefixed(data)
    if len(data) != expected_bytes or digest != row["sha256"]:
        raise ValueError(
            f"{label} must be {expected_bytes} bytes at {row['sha256']}; "
            f"received {len(data)} bytes at {digest}"
        )
    with Image.open(path) as opened:
        if opened.format != "PNG" or opened.mode != "RGBA":
            raise ValueError(f"{label} must be an exact RGBA PNG, not {opened.format}/{opened.mode}")
        if opened.width * opened.height > MAX_PNG_PIXELS:
            raise ValueError(f"{label} exceeds {MAX_PNG_PIXELS} decoded pixels")
        opened.load()
        image = opened.copy()
    if image.size != (int(row["widthPx"]), int(row["heightPx"])):
        raise ValueError(
            f"{label} decoded to {image.size}, not manifest {row['widthPx']}x{row['heightPx']}"
        )
    return image, {"bytes": len(data), "file": str(row["file"]), "sha256": digest}


def unique_rows(rows: object, key: str, label: str) -> dict[str, dict[str, object]]:
    if not isinstance(rows, list):
        raise ValueError(f"{label} must be an array")
    result: dict[str, dict[str, object]] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get(key), str) or row[key] in result:
            raise ValueError(f"{label} must have unique string {key} values")
        result[str(row[key])] = row
    return result


def control_gate(
    measurements: list[dict[str, object]],
    roles: set[str],
    required_observable_role: str | None = None,
) -> dict[str, object]:
    selected = [row for row in measurements if row["role"] in roles]
    failures = []
    for row in selected:
        measurement = row["measurement"]
        if measurement["observable"]:
            if measurement["verdict"] != row["expectedKind"]:
                failures.append(
                    f"{row['elementId']} observable class {measurement['verdict']} != {row['expectedKind']}"
                )
        else:
            failures.append(f"{row['elementId']} not observable")
    if required_observable_role is not None:
        required_observed_classes = {
            str(row["measurement"]["verdict"])
            for row in selected
            if row["role"] == required_observable_role and row["measurement"]["observable"]
        }
        for expected in ("solid-stud", "hollow-stud"):
            if expected not in required_observed_classes:
                failures.append(
                    f"no observable correct {required_observable_role} {expected} control"
                )
    return {
        "failures": failures,
        "passed": not failures,
        "roles": sorted(roles),
        "views": len(selected),
    }


def annotate(image: Image.Image, measurement: dict[str, object]) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    anchor = measurement.get("anchor")
    rect = measurement.get("centerRect")
    if isinstance(anchor, dict):
        draw.line(
            (
                int(anchor["run"][0]),
                int(anchor["topY"]),
                int(anchor["run"][1]),
                int(anchor["topY"]),
            ),
            fill=(255, 220, 0, 255),
            width=1,
        )
    if isinstance(rect, dict):
        draw.rectangle(
            (int(rect["left"]), int(rect["top"]), int(rect["right"]), int(rect["bottom"])),
            outline=(255, 0, 255, 255),
            width=1,
        )
    return annotated


def montage(rows: list[dict[str, object]], path: Path, columns: int) -> None:
    panels = []
    panel_width = 360
    panel_height = 560
    for row in rows:
        image = annotate(row.pop("_image"), row["measurement"])
        scale = max(1, min(4, 460 // max(image.size)))
        display = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
        panel = Image.new("RGBA", (panel_width, panel_height), (245, 245, 245, 255))
        draw = ImageDraw.Draw(panel)
        measurement = row["measurement"]
        ratio = measurement.get("ratio")
        title = f"{row['label']}  {measurement['verdict']}"
        ratio_text = f"{ratio:.6f}" if isinstance(ratio, float) else str(ratio)
        detail = (
            f"w={measurement.get('anchor', {}).get('width')} "
            f"center/ref={measurement.get('centerMedianLuma')}/{measurement.get('referenceP90Luma')} "
            f"ratio={ratio_text}"
        )
        draw.text((8, 8), title, fill=(0, 0, 0, 255))
        draw.text((8, 24), detail, fill=(0, 0, 0, 255))
        x = (panel_width - display.width) // 2
        y = 48 + max(0, (panel_height - 56 - display.height) // 2)
        panel.alpha_composite(display, (x, y))
        panels.append(panel)
    rows_count = math.ceil(len(panels) / columns)
    result = Image.new(
        "RGBA", (panel_width * columns, panel_height * rows_count), (220, 220, 220, 255)
    )
    for index, panel in enumerate(panels):
        result.alpha_composite(
            panel, ((index % columns) * panel_width, (index // columns) * panel_height)
        )
    result.save(path, format="PNG", optimize=False)
