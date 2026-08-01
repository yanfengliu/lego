#!/usr/bin/env node
// Reads exact stud positions and body extents out of the official LDraw part
// files, which are the authority for what a real part measures.
//
// A part file references subfiles by a 3x3 matrix and a translation, so the
// only way to get a stud's true position is to walk the tree and compose the
// transforms. stud.dat is the leaf that marks a stud; the body extent comes
// from the triangles and quads.
//
// Network tool, run by hand. Its output is pasted into the catalog as
// blueprint data; nothing at runtime fetches anything.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const CACHE = new URL("./ldraw-cache/", import.meta.url).pathname.replace(/^\//, "");
mkdirSync(CACHE, { recursive: true });

const BASE = "https://library.ldraw.org/library/official";

/** LDraw spells subdirectories with a backslash and is case-insensitive. */
function candidateUrls(name) {
  const clean = name.replaceAll("\\", "/").toLowerCase();
  if (clean.startsWith("s/")) return [`${BASE}/parts/${clean}`];
  return [`${BASE}/p/${clean}`, `${BASE}/parts/${clean}`, `${BASE}/p/48/${clean}`];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches a part file, distinguishing "no such part" from "the library said no
 * right now". Conflating them reported eight real parts as nonexistent when the
 * library was simply rate limiting a burst of subfile requests.
 */
async function fetchFile(name) {
  const key = `${CACHE}/${name.replaceAll("\\", "__").replaceAll("/", "__").toLowerCase()}`;
  if (existsSync(key)) return readFileSync(key, "utf8");
  let sawRetryable = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(400 * 2 ** attempt);
    sawRetryable = 0;
    for (const url of candidateUrls(name)) {
      let response;
      try {
        response = await fetch(url);
      } catch {
        sawRetryable += 1;
        continue;
      }
      if (response.ok) {
        const text = await response.text();
        writeFileSync(key, text);
        await sleep(60);
        return text;
      }
      if (response.status !== 404) sawRetryable += 1;
    }
    if (sawRetryable === 0) break;
  }
  throw new Error(
    sawRetryable > 0
      ? `LDraw did not serve ${name} after 4 attempts; the library rate limits bursts, so slow down and retry rather than treating it as missing`
      : `LDraw has no file named ${name} under p/, p/48/ or parts/`,
  );
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

/** Compose parent * child, both as [a..i, x, y, z]. */
function compose(p, c) {
  const [a, b, cc, d, e, f, g, h, i, x, y, z] = p;
  const [A, B, C, D, E, F, G, H, I, X, Y, Z] = c;
  return [
    a * A + b * D + cc * G,
    a * B + b * E + cc * H,
    a * C + b * F + cc * I,
    d * A + e * D + f * G,
    d * B + e * E + f * H,
    d * C + e * F + f * I,
    g * A + h * D + i * G,
    g * B + h * E + i * H,
    g * C + h * F + i * I,
    a * X + b * Y + cc * Z + x,
    d * X + e * Y + f * Z + y,
    g * X + h * Y + i * Z + z,
  ];
}

function apply(m, px, py, pz) {
  return [
    m[0] * px + m[1] * py + m[2] * pz + m[9],
    m[3] * px + m[4] * py + m[5] * pz + m[10],
    m[6] * px + m[7] * py + m[8] * pz + m[11],
  ];
}

const STUD_LEAVES = new Set(["stud.dat", "stud2.dat", "stud2a.dat", "stud3.dat", "stud4.dat"]);

async function walk(name, matrix, out, depth = 0) {
  if (depth > 12) throw new Error(`LDraw reference nesting exceeded 12 at ${name}`);
  const lower = name.replaceAll("\\", "/").toLowerCase().split("/").pop();
  if (STUD_LEAVES.has(lower)) {
    const [x, y, z] = apply(matrix, 0, 0, 0);
    out.studs.push({
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      kind: lower,
    });
    return;
  }
  let text;
  try {
    text = await fetchFile(name);
  } catch {
    out.unresolved.add(name);
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const parts = line.split(/\s+/);
    const kind = parts[0];
    if (kind === "1") {
      const nums = parts.slice(2, 14).map(Number);
      const child = [
        nums[3],
        nums[4],
        nums[5],
        nums[6],
        nums[7],
        nums[8],
        nums[9],
        nums[10],
        nums[11],
        nums[0],
        nums[1],
        nums[2],
      ];
      await walk(parts.slice(14).join(" "), compose(matrix, child), out, depth + 1);
    } else if (kind === "3" || kind === "4") {
      const count = kind === "3" ? 3 : 4;
      const nums = parts.slice(2, 2 + count * 3).map(Number);
      for (let v = 0; v < count; v += 1) {
        const [x, y, z] = apply(matrix, nums[v * 3], nums[v * 3 + 1], nums[v * 3 + 2]);
        out.min = [Math.min(out.min[0], x), Math.min(out.min[1], y), Math.min(out.min[2], z)];
        out.max = [Math.max(out.max[0], x), Math.max(out.max[1], y), Math.max(out.max[2], z)];
      }
    }
  }
}

/**
 * The studs on top, deduped.
 *
 * LDraw builds a part's underside tubes out of stud primitives too, so a 2x4
 * brick reports eleven until they are separated: eight on top and three tubes
 * beneath. LDraw is Y-down, so the top face is the smallest y, and the tubes
 * sit at the other end of the part.
 */
function topStuds(studs, topY) {
  const seen = new Map();
  for (const s of studs) {
    if (Math.abs(s.y - topY) > 0.6) continue;
    seen.set(`${s.x.toFixed(1)},${s.z.toFixed(1)}`, s);
  }
  return [...seen.values()].sort((a, b) => a.x - b.x || a.z - b.z);
}

const ids = process.argv.slice(2);
const report = [];
for (const id of ids) {
  const out = { studs: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], unresolved: new Set() };
  const file = id.endsWith(".dat") ? id : `${id}.dat`;
  let header;
  try {
    header = (await fetchFile(file)).split("\n")[0].replace(/^0\s*/, "").trim();
    await walk(file, IDENTITY, out);
  } catch (error) {
    report.push({ id, error: String(error.message) });
    continue;
  }
  const studs = topStuds(out.studs, out.min[1]);
  // LDraw is Y-down: the top of a part is its most negative y.
  report.push({
    id,
    name: header,
    bodyMinLdu: out.min.map((v) => Math.round(v * 100) / 100),
    bodyMaxLdu: out.max.map((v) => Math.round(v * 100) / 100),
    widthLdu: Math.round((out.max[0] - out.min[0]) * 100) / 100,
    lengthLdu: Math.round((out.max[2] - out.min[2]) * 100) / 100,
    heightLdu: Math.round((out.max[1] - out.min[1]) * 100) / 100,
    studCount: studs.length,
    studsXZ: studs.map((s) => [s.x, s.z]),
    undersideTubes: out.studs.length - studs.length,
    unresolved: [...out.unresolved],
  });
}
console.log(JSON.stringify(report, null, 1));
