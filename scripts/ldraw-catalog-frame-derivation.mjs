import { createHash } from "node:crypto";

/**
 * Derives one part's LDraw-to-catalog frame from the official LDraw file.
 *
 * A frame is the quarter turn O and whole-LDU offset t with
 * catalog = O * ldraw + t: where the catalog puts the part's LDraw-local
 * geometry. It is measured, never guessed. Both conventions put up on -y, so
 * O is one of the four upright yaws. A candidate must put the file's full
 * extent (studs included) exactly on the catalog's `boundsLdu`, and every
 * catalog stud onto the origin of a stud primitive the file draws, pointing
 * the same way. When more than one candidate survives, the motion between
 * them must map the file's own surface onto itself — a half turn of a 1 x 2
 * plate is one placement, and the file cannot tell its ends apart — or the
 * file does not determine one frame and the derivation refuses. Of
 * equivalent candidates the first in catalog orientation order is kept, so
 * the choice is reproducible.
 *
 * Bound: equivalence is judged on the file's triangles and quads as vertex
 * sets; edge lines and conditional lines are ignored, and a symmetric part
 * drawn with an asymmetric subdivision is refused rather than accepted.
 *
 * What is kept from the file is measurement only: extents and stud positions
 * as numbers, reduced to one orientation id and three integers. No LDraw text,
 * triangle or excerpt is emitted.
 */

const MAX_CLOSURE_FILES = 256;
const MAX_POINTS = 400_000;
const MAX_DEPTH = 32;
const EPSILON = 1e-6;

/** Stud primitives, top or underside; a catalog stud must sit on the origin of one of them. */
const STUD_PRIMITIVE = /^stud[0-9a-z]*\.dat$/u;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const normalizedPath = (value) => value.replaceAll("\\", "/").toLowerCase();
const zero = (value) => (Object.is(value, -0) ? 0 : value);

function referencedCandidates(name) {
  const clean = normalizedPath(name);
  if (clean.startsWith("s/")) return [`ldraw/parts/${clean}`];
  if (clean.startsWith("48/") || clean.startsWith("8/")) return [`ldraw/p/${clean}`];
  return [`ldraw/p/${clean}`, `ldraw/parts/${clean}`, `ldraw/p/48/${clean}`];
}

function compose(parent, child) {
  const [a, b, c, d, e, f, g, h, i, x, y, z] = parent;
  const [A, B, C, D, E, F, G, H, I, X, Y, Z] = child;
  return [
    a * A + b * D + c * G,
    a * B + b * E + c * H,
    a * C + b * F + c * I,
    d * A + e * D + f * G,
    d * B + e * E + f * H,
    d * C + e * F + f * I,
    g * A + h * D + i * G,
    g * B + h * E + i * H,
    g * C + h * F + i * I,
    a * X + b * Y + c * Z + x,
    d * X + e * Y + f * Z + y,
    g * X + h * Y + i * Z + z,
  ];
}

const applyAffine = (m, p) => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9],
  m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10],
  m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11],
];
const applyLinear = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

/** The header facts attribution needs, read from the root file's own `0` lines. */
function headerOf(text, label) {
  const lines = text.split(/\r?\n/u).map((line) => line.trim());
  const meta = (prefix) =>
    lines
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() ?? null;
  const title = lines[0]?.startsWith("0 ") ? lines[0].slice(2).trim() : null;
  const author = meta("0 Author:");
  const ldrawOrg = meta("0 !LDRAW_ORG");
  const license = meta("0 !LICENSE");
  if (!title || !author || !ldrawOrg || !license) {
    throw new TypeError(
      `${label} lacks a title, "0 Author:", "0 !LDRAW_ORG" or "0 !LICENSE" line; attribution cannot be recorded, so no frame is derived from it.`,
    );
  }
  const has4 = /CC BY 4\.0/u.test(license);
  const has2 = /CC BY 2\.0|CCAL version 2\.0/u.test(license);
  const licenseExpression =
    has4 && has2 ? "CC-BY-2.0 OR CC-BY-4.0" : has4 ? "CC-BY-4.0" : has2 ? "CC-BY-2.0" : null;
  if (licenseExpression === null) {
    throw new TypeError(
      `${label} declares licence ${JSON.stringify(license)}, which is neither CC BY 2.0 nor CC BY 4.0; the BOM admits only those for measured facts.`,
    );
  }
  return { title, author, ldrawOrg, licenseExpression };
}

/**
 * Expands `ldrawId`'s closure from `archive` (an object with `read(path)`
 * returning bytes): its full extent, and the origin and up direction of every
 * stud primitive it places. An official "~Moved to" redirect also yields
 * `resolvedRoot`, the part it moved to, whose header attribution reads.
 */
export function expandLdrawPartForFrame(archive, ldrawId) {
  const rootPath = `ldraw/parts/${normalizedPath(ldrawId)}`;
  const closure = new Set();
  const studs = [];
  const faces = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let points = 0;
  const resolve = (name) => {
    for (const candidate of referencedCandidates(name)) {
      try {
        return { path: candidate, bytes: archive.read(candidate) };
      } catch (error) {
        if (!(error instanceof TypeError) || !error.message.includes("lacks exact member")) {
          throw error;
        }
      }
    }
    throw new TypeError(`${rootPath} references ${name}, which the pinned archive does not hold.`);
  };
  const walk = (path, bytes, matrix, depth) => {
    if (depth > MAX_DEPTH) throw new TypeError(`${rootPath} nests deeper than ${MAX_DEPTH}.`);
    closure.add(path);
    if (closure.size > MAX_CLOSURE_FILES) {
      throw new TypeError(`${rootPath} closure exceeds ${MAX_CLOSURE_FILES} files.`);
    }
    for (const raw of bytes.toString("utf8").split(/\r?\n/u)) {
      const tokens = raw.trim().split(/\s+/u);
      if (tokens[0] === "1" && tokens.length >= 15) {
        const v = tokens.slice(2, 14).map(Number);
        if (v.some((value) => !Number.isFinite(value))) {
          throw new TypeError(`${path} has a type-1 line with a non-finite number.`);
        }
        const child = [v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[0], v[1], v[2]];
        const name = tokens.slice(14).join(" ");
        const composed = compose(matrix, child);
        const leaf = normalizedPath(name).split("/").pop();
        if (STUD_PRIMITIVE.test(leaf)) {
          studs.push({
            primitive: leaf,
            positionLdu: applyAffine(composed, [0, 0, 0]),
            // A stud primitive stands along its local -y.
            up: applyLinear(composed, [0, -1, 0]),
          });
        }
        const next = resolve(name);
        walk(next.path, next.bytes, composed, depth + 1);
      } else if ((tokens[0] === "3" || tokens[0] === "4") && tokens.length >= 11) {
        const corners = tokens[0] === "3" ? 3 : 4;
        const v = tokens.slice(2, 2 + corners * 3).map(Number);
        const face = [];
        for (let corner = 0; corner < corners; corner += 1) {
          const point = applyAffine(matrix, v.slice(corner * 3, corner * 3 + 3));
          face.push(point);
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], point[axis]);
            max[axis] = Math.max(max[axis], point[axis]);
          }
        }
        faces.push(face);
        points += corners;
        if (points > MAX_POINTS) throw new TypeError(`${rootPath} exceeds ${MAX_POINTS} points.`);
      }
    }
  };
  const rootBytes = archive.read(rootPath);
  const header = headerOf(rootBytes.toString("utf8"), rootPath);
  const resolvedRoot = redirectTargetOf(rootPath, rootBytes, header, resolve);
  walk(rootPath, rootBytes, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 0);
  if (points === 0) throw new TypeError(`${rootPath} draws no geometry.`);
  return {
    root: {
      path: rootPath.replace(/^ldraw\//u, ""),
      bytes: rootBytes.length,
      sha256: sha256(rootBytes),
    },
    header,
    ...(resolvedRoot === undefined ? {} : { resolvedRoot }),
    closureFileCount: closure.size,
    bounds: { min: min.map(zero), max: max.map(zero) },
    studs,
    faces,
  };
}

const IDENTITY_PLACEMENT = "0 0 0 1 0 0 0 1 0 0 0 1";

/**
 * The part an official "~Moved to" redirect resolves to, or undefined for an
 * ordinary file. A redirect draws nothing itself: it places its target once,
 * unturned at the origin, so the target's geometry and author are the ones
 * the measurement rests on, and attribution reads the target's header.
 */
function redirectTargetOf(rootPath, rootBytes, header, resolve) {
  if (!header.title.startsWith("~Moved to ")) return undefined;
  const placements = rootBytes
    .toString("utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u))
    .filter((tokens) => tokens[0] === "1");
  const [only] = placements;
  if (placements.length !== 1 || only.slice(2, 14).join(" ") !== IDENTITY_PLACEMENT) {
    throw new TypeError(
      `${rootPath} is titled "${header.title}" but does not place exactly one file unturned at the origin; a redirect must, so that its target's frame is its own.`,
    );
  }
  const target = resolve(only.slice(14).join(" "));
  if (!target.path.startsWith("ldraw/parts/")) {
    throw new TypeError(
      `${rootPath} redirects to ${target.path}, which is not a part file; attribution needs the part it moved to.`,
    );
  }
  return {
    path: target.path.replace(/^ldraw\//u, ""),
    bytes: target.bytes.length,
    sha256: sha256(target.bytes),
    header: headerOf(target.bytes.toString("utf8"), target.path),
  };
}

const near = (left, right) => left.every((value, axis) => Math.abs(value - right[axis]) < EPSILON);
const key = (values) => values.map((value) => zero(Math.round(value * 1000) / 1000)).join(",");

function transformedBounds(bounds, matrix, translation) {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((bits) =>
    applyLinear(matrix, [
      bits & 1 ? bounds.max[0] : bounds.min[0],
      bits & 2 ? bounds.max[1] : bounds.min[1],
      bits & 4 ? bounds.max[2] : bounds.min[2],
    ]).map((value, axis) => value + translation[axis]),
  );
  return {
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((corner) => corner[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((corner) => corner[axis]))),
  };
}

const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const multiply = (left, right) =>
  Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce((sum, k) => sum + left[row * 3 + k] * right[k * 3 + column], 0);
  });
const isUprightYaw = (m) => m[4] === 1 && m[1] === 0 && m[3] === 0 && m[5] === 0 && m[7] === 0;

const faceKey = (face) =>
  face
    .map((point) => key(point))
    .sort()
    .join(";");

/** Whether LDraw-local motion l -> matrix * l + translation maps the file's faces onto themselves. */
export function isSourceSelfMotion(faces, matrix, translation) {
  const counts = new Map();
  for (const face of faces) counts.set(faceKey(face), (counts.get(faceKey(face)) ?? 0) + 1);
  for (const face of faces) {
    const moved = faceKey(
      face.map((point) =>
        applyLinear(matrix, point).map((value, axis) => value + translation[axis]),
      ),
    );
    const left = counts.get(moved) ?? 0;
    if (left === 0) return false;
    counts.set(moved, left - 1);
  }
  return true;
}

/**
 * Frames chosen by review where the file fits several candidates but is not
 * symmetric between them. The choice must still be one of the candidates the
 * extent and studs leave, so review picks among measured frames and cannot
 * invent one. Each `why` is emitted into its generated row.
 *
 * Neither choice rests on the catalog part being symmetric: for both, a half
 * turn is not a catalog self-motion (tools/booklet/frame-checks.ts
 * `isCatalogSelfMotion` is false), because it reverses a port's normal.
 */
export const REVIEWED_FRAME_CHOICES = Object.freeze({
  "32062.dat": {
    orientationId: "upright-yaw-0",
    why: "32062.dat's notched faces are not symmetric under the half turn between the two candidates, and neither is the catalog axle: the turn swaps its end ports axle:0 and axle:2 exactly but reverses the centre port axle:1 from +x to -x. The choice is harmless because axle-to-axleHole connections match collinear axes, which that reversal leaves unchanged, and an axle end in a blind hole uses axle:0 or axle:2. Yaw 0, the first candidate, keeps the shaft on the x axis both conventions give it.",
  },
  "3483.dat": {
    orientationId: "upright-yaw-90",
    why: "3483.dat's offset tread is not symmetric under the half turn between the two candidates, and neither is the catalog wheel: the turn keeps its symmetric body bounds but reverses its one port axleHole:0 from +x to -x. The choice is harmless because axle-to-axleHole connections match collinear axes, so an axle through the hole connects the same either way. Yaw 90, the first candidate, is kept.",
  },
});

/**
 * The frame `expanded` (from `expandLdrawPartForFrame`) determines for
 * `definition`, over `orientations` (id + row-major matrix, in catalog order;
 * only the upright yaws are tried). Throws, naming the part and what failed,
 * when no candidate survives or the survivors are not one placement and no
 * reviewed choice picks one of them. `reviewedChoices` defaults to
 * `REVIEWED_FRAME_CHOICES`; tests pass their own.
 */
export function deriveLdrawCatalogFrame(
  definition,
  expanded,
  orientations,
  reviewedChoices = REVIEWED_FRAME_CHOICES,
) {
  const catalogStuds = definition.connectors.filter(({ kind }) => kind === "stud");
  const candidates = [];
  for (const orientation of orientations.filter(({ matrix }) => isUprightYaw(matrix))) {
    const rotated = transformedBounds(expanded.bounds, orientation.matrix, [0, 0, 0]);
    const translation = [0, 1, 2].map((axis) =>
      zero(
        (definition.boundsLdu.min[axis] +
          definition.boundsLdu.max[axis] -
          rotated.min[axis] -
          rotated.max[axis]) /
          2,
      ),
    );
    if (!translation.every((value) => Number.isSafeInteger(value))) continue;
    const placed = transformedBounds(expanded.bounds, orientation.matrix, translation);
    if (!near(placed.min, definition.boundsLdu.min) || !near(placed.max, definition.boundsLdu.max))
      continue;
    const mapped = expanded.studs.map((stud) => ({
      position: applyLinear(orientation.matrix, stud.positionLdu).map(
        (value, axis) => value + translation[axis],
      ),
      up: applyLinear(orientation.matrix, stud.up),
    }));
    const studsAgree = catalogStuds.every((stud) =>
      mapped.some(({ position, up }) => near(position, stud.positionLdu) && near(up, stud.normal)),
    );
    if (studsAgree)
      candidates.push({ orientationId: orientation.id, matrix: orientation.matrix, translation });
  }
  if (candidates.length === 0) {
    throw new TypeError(
      `${definition.id}: no proper orientation puts ${expanded.root.path} (extent ${JSON.stringify(expanded.bounds)}, ${expanded.studs.length} stud primitives) exactly on the catalog bounds ${JSON.stringify(definition.boundsLdu)} with every catalog stud on an LDraw stud; the catalog part and its LDraw file disagree, so fix the catalog part (or its alias) before deriving a frame.`,
    );
  }
  const [first] = candidates;
  const distinct = candidates.slice(1).filter((candidate) => {
    // Both frames give one catalog placement when l -> O1^T (O2 l + t2 - t1).
    const back = transpose(first.matrix);
    const turn = multiply(back, candidate.matrix);
    const shift = applyLinear(
      back,
      candidate.translation.map((value, axis) => value - first.translation[axis]),
    );
    return !isSourceSelfMotion(expanded.faces, turn, shift);
  });
  const ldrawId = expanded.root.path.split("/").pop();
  const reviewed = reviewedChoices[ldrawId];
  if (distinct.length > 0 && reviewed !== undefined) {
    const chosen = candidates.find(({ orientationId }) => orientationId === reviewed.orientationId);
    if (chosen === undefined) {
      throw new TypeError(
        `${definition.id}: the reviewed frame ${reviewed.orientationId} for ${ldrawId} is not among the candidates the file's extent and studs leave (${candidates.map(({ orientationId }) => orientationId).join(", ")}); re-review it.`,
      );
    }
    return {
      orientationId: chosen.orientationId,
      translationLdu: chosen.translation,
      candidates: candidates.length,
      basis: "reviewed-choice",
      why: reviewed.why,
    };
  }
  if (distinct.length > 0) {
    throw new TypeError(
      `${definition.id}: ${candidates.length} candidate frames (${candidates.map(({ orientationId, translation }) => `${orientationId} [${translation.join(", ")}]`).join("; ")}) fit the extent and studs, but ${expanded.root.path} is not symmetric under the turn between them, so it does not determine one frame; give the catalog part the stud or connector that tells them apart, or declare the frame by review.`,
    );
  }
  if (reviewed !== undefined) {
    throw new TypeError(
      `${definition.id}: ${ldrawId} has a reviewed frame choice, but the file already determines its frame; remove the stale review from REVIEWED_FRAME_CHOICES.`,
    );
  }
  return {
    orientationId: first.orientationId,
    translationLdu: first.translation,
    candidates: candidates.length,
    basis: "derived",
  };
}
