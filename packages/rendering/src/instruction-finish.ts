import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  Matrix3,
  Vector3,
  type Material,
  type MeshBasicMaterial,
  type Object3D,
} from "three";

/**
 * The dialect a LEGO booklet prints in, measured off its own pages.
 *
 * The premise this file replaces was that booklet art is unlit — one flat tone
 * per part, with the shape carried by printed outlines. It is not. Measured
 * over `output/inventory-thumbnails`, which are the set's own printed part
 * pictures at page resolution:
 *
 * - A white 2x3 brick spends three tones on its three visible faces: 246 on the
 *   face pointing right, 240 on top, 223 on the face pointing left.
 * - A light bluish gray 2x2 spends 170 / 161 / 151 on the same three, so the
 *   ratios hold across colours even though the levels do not.
 * - Every stud is a light cap over a near-black wall: 178 then 15 on the grey
 *   brick, 245 then 8 on the white one, and 107 then 1 on a black one. The wall
 *   is near-black whatever the part's colour, which is what makes a stud read as
 *   a bump rather than a circle printed on a surface.
 * - Edges are drawn in a colour that contrasts with the fill, not in one fixed
 *   ink: ~110 on a black part whose body is 47, ~85 on a grey part whose body is
 *   165. A single near-black ink leaves a black part with no visible edges at
 *   all, which is the bug this replaces. LDraw's own palette says the same thing
 *   — black's edge colour is #808080 while white's is #333333.
 *
 * Everything here stays unlit in the Three.js sense: the tone is baked per
 * triangle into a vertex colour, so an instruction scene still needs no lights,
 * still tone-maps nothing, and still lands on an exact, enumerable palette.
 * `instructionFaceTones` is that palette, so a probe can assert it.
 */

/**
 * The key light, in Three.js world space, fitted to the three face tones of the
 * measured white brick. It leans harder toward +X than up, because the
 * reference's brightest face is the one pointing right rather than the top:
 * 246 against 240 on white, 170 against 161 on grey.
 *
 * It is fixed in the world, not carried by the camera, which is what lets the
 * tone be baked into the geometry once and lets a brick at a quarter turn agree
 * with the one beside it. The cost is that a camera swung round to the far side
 * sees only the ambient, the sky wash and the fill — a legible picture, but a
 * flatter one, and `camera-fit` sweeps all 24 azimuths so such a camera is
 * reachable. The panels the closed loop scores are drawn from the +X +Z
 * quadrant, which is the side the key lights. Making the light follow the
 * camera would mean shading in a real shader with the view matrix, and giving
 * up the exact enumerable palette the closed loop keys off.
 */
const KEY_LIGHT = new Vector3(0.848, 0.652, 0.543).normalize();

/**
 * A weak fill from behind and below, aimed into the octant the key light cannot
 * reach. It is angled so no face the key lights receives any of it, which is
 * what lets it separate the shadow side without disturbing the fit: -X and -Z
 * are both unlit by the key alone and printed the same tone, so a corner
 * between them vanished wherever no ink happened to cross it.
 */
const FILL_LIGHT = new Vector3(-1, -0.4, -0.7).normalize();

/** Light that reaches a face from every direction; the floor no face falls below. */
export const INSTRUCTION_AMBIENT_SHADE = 0.56 as const;
/**
 * A weak overhead wash on top of the ambient. It is what keeps an overhang's
 * underside darker than its sides once the key light misses all three — without
 * it every unlit face collapses onto one tone and the form goes with it.
 */
export const INSTRUCTION_SKY_SHADE = 0.08 as const;
/** How much the key light adds to a face pointing straight at it. */
export const INSTRUCTION_KEY_SHADE = 0.552 as const;
/** How much the fill adds to a face pointing straight at it. */
export const INSTRUCTION_FILL_SHADE = 0.14 as const;

/**
 * A white sheen, in tone levels, that a fully lit surface picks up on top of
 * its own colour.
 *
 * Multiplying a colour can only ever darken it, and a colour as dark as this
 * catalog's black (#05131D, luminance 0.07) has nothing left to darken: all six
 * of its faces land within two levels of each other and the brick prints as a
 * silhouette. The reference does not do that — its black bricks show 42 on one
 * face and 48 on the next — because a glossy surface reflects the room whatever
 * its pigment. That reflection is additive, so it is what separates a dark
 * part's faces. It is scaled by how much room the colour has left below white,
 * so a white brick's top face stays 240 instead of clipping to 255.
 */
export const INSTRUCTION_SHEEN_LEVELS = 46 as const;

/**
 * A stud's cap is the one surface that shows the part's colour undimmed, which
 * is why it reads brighter than the top face it stands on: measured 178 against
 * a 161 top face in light bluish gray, 245 against 240 in white.
 */
export const INSTRUCTION_STUD_CAP_SHADE = 1 as const;
/**
 * A stud's cylinder wall, which prints near-black on every colour measured —
 * 15 on a 165 grey, 8 on a 255 white, 1 on a 47 black. It is the crevice at the
 * base of the stud: no light reaches it, so it takes no sheen either, and that
 * is the whole reason a printed stud reads as raised rather than as a circle
 * drawn on a surface.
 */
export const INSTRUCTION_STUD_WALL_SHADE = 0.1 as const;

/**
 * Below this relative luminance a colour has no room to take a darker edge, so
 * its ink is lightened instead. Black lands at 0.07 and takes a light edge;
 * blue at 0.29 and red at 0.24 keep a dark one, as LDraw's palette does.
 */
export const INSTRUCTION_INK_LUMINANCE_SPLIT = 0.12 as const;
/** How far a light colour's ink is darkened. Measured ~0.42 on white and grey. */
export const INSTRUCTION_INK_DARK_FACTOR = 0.4 as const;
/** How far a dark colour's ink is lifted toward white. Measured ~0.42 on black. */
export const INSTRUCTION_INK_LIGHT_MIX = 0.42 as const;

/**
 * How far toward the camera an outline is pushed, in Three.js world units
 * (0.4 LDU), so it never fights the face it lies on.
 *
 * The pass this replaces pushed the *fill* backwards with a constant
 * `polygonOffsetUnits`, which is a depth-buffer quantity rather than a world
 * one: at 4 units it still lost the fight on 38-68% of a silhouette, and it
 * simultaneously pushed faces behind the hidden lines they were supposed to
 * occlude, so studs' bottom rims printed through solid top faces. Biasing the
 * line in view space instead is exact under an orthographic camera, leaves the
 * fill's depth alone so hidden-line removal still works, and is far smaller
 * than the smallest real separation it must not jump — a stud is 4 LDU tall.
 */
export const INSTRUCTION_LINE_DEPTH_BIAS = 0.02 as const;

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Every tone here is arithmetic on a colour's channels, and arithmetic on a
 * `NaN` returns a `NaN` that `clampByte` passes straight through — the whole
 * part would then draw in whatever a `NaN` colour resolves to, with nothing
 * saying why. So a bad hex is refused where it enters instead.
 */
function requireDisplayHex(displayHex: number): number {
  if (!Number.isInteger(displayHex) || displayHex < 0 || displayHex > 0xffffff) {
    throw new RangeError(
      `Display colour must be an integer 0x000000 to 0xffffff, received ${String(displayHex)}. ` +
        `Parse the catalog's "#rrggbb" with Number.parseInt(hex.slice(1), 16) — the "#" and a ` +
        `three-digit shorthand both parse to NaN, and NaN silently poisons every tone derived from it.`,
    );
  }
  return displayHex;
}

/** Relative luminance of an sRGB hex, 0 to 1. */
export function instructionLuminance(displayHex: number): number {
  requireDisplayHex(displayHex);
  const red = (displayHex >> 16) & 0xff;
  const green = (displayHex >> 8) & 0xff;
  const blue = displayHex & 0xff;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

/** What a surface with this world normal is drawn at, before its own colour. */
export interface InstructionIllumination {
  /** Multiplier on the part's display colour. */
  readonly shade: number;
  /** Share of the full sheen this surface picks up, 0 to 1. */
  readonly sheen: number;
}

/**
 * Ambient, plus an overhead wash, plus a key light, plus a fill. The terms that
 * reach a face the booklet's camera can see are fitted to the measured face
 * tones of the printed white and grey bricks, not invented.
 */
export function instructionIllumination(
  normalX: number,
  normalY: number,
  normalZ: number,
): InstructionIllumination {
  const key = Math.max(0, normalX * KEY_LIGHT.x + normalY * KEY_LIGHT.y + normalZ * KEY_LIGHT.z);
  const fill = Math.max(
    0,
    normalX * FILL_LIGHT.x + normalY * FILL_LIGHT.y + normalZ * FILL_LIGHT.z,
  );
  const sky = 0.5 + 0.5 * normalY;
  const lit =
    INSTRUCTION_SKY_SHADE * sky + INSTRUCTION_KEY_SHADE * key + INSTRUCTION_FILL_SHADE * fill;
  return {
    shade: INSTRUCTION_AMBIENT_SHADE + lit,
    // Normalised against the key-lit maximum rather than every light at once,
    // so adding the fill cannot dim the faces the model was fitted to.
    sheen: Math.min(1, lit / (INSTRUCTION_SKY_SHADE + INSTRUCTION_KEY_SHADE)),
  };
}

/** The part colour scaled by one factor, rounded to the byte it will be drawn as. */
function scaleHex(displayHex: number, factor: number): number {
  const red = clampByte(Math.round(((displayHex >> 16) & 0xff) * factor));
  const green = clampByte(Math.round(((displayHex >> 8) & 0xff) * factor));
  const blue = clampByte(Math.round((displayHex & 0xff) * factor));
  return (red << 16) | (green << 8) | blue;
}

/** Which part of a part a triangle belongs to; each takes its own light. */
export type InstructionSurfaceKind = "face" | "stud-cap" | "stud-wall";

/**
 * The tone one triangle prints at: the part's colour, dimmed by the light that
 * reaches its world normal, lifted by the sheen the same light leaves on it.
 */
export function instructionTone(
  displayHex: number,
  normalX: number,
  normalY: number,
  normalZ: number,
  kind: InstructionSurfaceKind = "face",
): number {
  const lit = instructionIllumination(normalX, normalY, normalZ);
  const shade =
    kind === "stud-cap"
      ? INSTRUCTION_STUD_CAP_SHADE
      : kind === "stud-wall"
        ? INSTRUCTION_STUD_WALL_SHADE
        : lit.shade;
  const sheen = kind === "stud-wall" ? 0 : lit.sheen;
  const lift = INSTRUCTION_SHEEN_LEVELS * sheen * (1 - instructionLuminance(displayHex));
  const channel = (shift: number): number =>
    clampByte(Math.round(((displayHex >> shift) & 0xff) * shade + lift));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * The ink this colour's edges are drawn in. A light part takes a darker edge, a
 * dark part a lighter one — which is the difference between a black brick with
 * visible edges and a black silhouette.
 */
export function instructionEdgeHex(displayHex: number): number {
  requireDisplayHex(displayHex);
  if (instructionLuminance(displayHex) > INSTRUCTION_INK_LUMINANCE_SPLIT) {
    return scaleHex(displayHex, INSTRUCTION_INK_DARK_FACTOR);
  }
  const lift = (channel: number): number =>
    clampByte(Math.round(channel + (255 - channel) * INSTRUCTION_INK_LIGHT_MIX));
  return (
    (lift((displayHex >> 16) & 0xff) << 16) |
    (lift((displayHex >> 8) & 0xff) << 8) |
    lift(displayHex & 0xff)
  );
}

/** The six axis normals a box can present, in Three.js world space. */
const AXIS_NORMALS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Every tone a box-and-stud part of this colour can print, plus its ink. A
 * probe asserts the render lands on exactly this set, which is what keeps
 * "shaded" from quietly becoming "smoothly lit".
 */
export function instructionFaceTones(displayHex: number): readonly number[] {
  const tones = new Set<number>();
  for (const [x, y, z] of AXIS_NORMALS) tones.add(instructionTone(displayHex, x, y, z));
  tones.add(instructionTone(displayHex, 0, 1, 0, "stud-cap"));
  tones.add(instructionTone(displayHex, 0, -1, 0, "stud-wall"));
  tones.add(instructionEdgeHex(displayHex));
  return [...tones].sort((left, right) => left - right);
}

/**
 * The colour an instruction fill material carries while it is drawing art.
 *
 * White, so the vertex colour the shader multiplies it by *is* the tone: a
 * multiplier could never reach a channel the part's own colour leaves at zero,
 * and blue's red channel is exactly that — its sheen went missing on 2.3% of a
 * probe render before this became absolute. The part's own colour is kept in
 * `userData.displayHex` and comes back the moment shading is switched off.
 */
export const INSTRUCTION_ART_MATERIAL_HEX = 0xffffff as const;

export type InstructionSurface = "body" | "stud";

const NORMAL_UP_THRESHOLD = 0.5;

/**
 * Bakes one tone per triangle into a geometry's vertex colours.
 *
 * Per triangle rather than per vertex, because a booklet's shading is faceted:
 * a wheel prints as a run of flat bands, not a gradient. The geometry is
 * de-indexed first so neighbouring faces stop sharing vertices and a box corner
 * can hold three different tones at once.
 *
 * The normal is taken into world space before it is shaded. Shading a part in
 * its own frame would light a brick rotated a quarter turn differently from the
 * one beside it, which no printed page does.
 *
 * Returns the geometry to draw. When the source had an index it is a new
 * geometry and the source is disposed, so callers must build any
 * `EdgesGeometry` from the source first.
 */
export function instructionFillGeometry(
  source: BufferGeometry,
  rotation: Matrix3,
  displayHex: number,
  surface: InstructionSurface,
): BufferGeometry {
  requireDisplayHex(displayHex);
  const flat = source.index === null ? source : source.toNonIndexed();
  if (flat !== source) source.dispose();

  const position = flat.getAttribute("position");
  const vertexCount = position.count;
  const colors = new Float32Array(vertexCount * 3);
  // Three reads a colour attribute as already being in the working (linear)
  // space, so the tone goes through `Color` exactly as a material colour would.
  // That is what keeps the shaded pixel landing on the byte `instructionTone`
  // promised, and the probe's palette assertion honest.
  const tones = new Map<number, Color>();
  const edge1 = new Vector3();
  const edge2 = new Vector3();
  const normal = new Vector3();
  const corner = new Vector3();

  for (let first = 0; first + 2 < vertexCount; first += 3) {
    corner.fromBufferAttribute(position, first);
    edge1.fromBufferAttribute(position, first + 1).sub(corner);
    edge2.fromBufferAttribute(position, first + 2).sub(corner);
    normal.crossVectors(edge1, edge2);
    // A degenerate triangle has no normal to shade by; the top tone keeps it
    // from printing as a black sliver if one ever reaches here.
    if (normal.lengthSq() === 0) normal.set(0, 1, 0);
    normal.normalize().applyMatrix3(rotation).normalize();

    const kind: InstructionSurfaceKind =
      surface === "body" ? "face" : normal.y > NORMAL_UP_THRESHOLD ? "stud-cap" : "stud-wall";
    const toneHex = instructionTone(displayHex, normal.x, normal.y, normal.z, kind);
    let tone = tones.get(toneHex);
    if (!tone) {
      tone = new Color(toneHex);
      tones.set(toneHex, tone);
    }
    for (let offset = 0; offset < 3; offset += 1) {
      colors[(first + offset) * 3] = tone.r;
      colors[(first + offset) * 3 + 1] = tone.g;
      colors[(first + offset) * 3 + 2] = tone.b;
    }
  }

  flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return flat;
}

/** One body box of a part, in the same Three.js units the scene is built in. */
export interface InstructionBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/**
 * How far outside an edge a probe looks for another box's material, in
 * Three.js units (0.2 LDU). Under the thinnest step this repo builds — a
 * cheese slope's 3 LDU rise — and over any rounding in a catalog extent.
 */
const SEAM_PROBE = 0.01;

function contains(box: InstructionBox, x: number, y: number, z: number): boolean {
  return (
    x > box.min[0] &&
    x < box.max[0] &&
    y > box.min[1] &&
    y < box.max[1] &&
    z > box.min[2] &&
    z < box.max[2]
  );
}

/**
 * Whether a box's edge is a crease of the union its part is made of.
 *
 * An arch, a curved slope and a cheese slope are all a staircase of boxes,
 * because a collision prism's cut is vertical and a slope's fall is not. Where
 * two of those boxes sit side by side their outer faces are coplanar, and
 * inking the boundary between them draws a line across what is one flat
 * surface — a four-step cheese slope then reads as four separate fins rather
 * than one moulded ramp.
 *
 * Look at the four quadrants around the edge, in the plane across it. The box
 * itself fills one. Writing the other three as `across n1`, `across n2` and
 * `across both`, the union's surface is flat over this edge in exactly three
 * arrangements: only `across n1` filled, only `across n2` filled, or all three
 * filled and the edge buried entirely. Every other arrangement leaves a real
 * corner, convex or concave, and a booklet draws it.
 */
function isUnionCrease(
  boxes: readonly InstructionBox[],
  self: number,
  point: readonly [number, number, number],
  normal1: readonly [number, number, number],
  normal2: readonly [number, number, number],
): boolean {
  const filled = (sign1: number, sign2: number): boolean => {
    const x = point[0] + SEAM_PROBE * (sign1 * normal1[0] + sign2 * normal2[0]);
    const y = point[1] + SEAM_PROBE * (sign1 * normal1[1] + sign2 * normal2[1]);
    const z = point[2] + SEAM_PROBE * (sign1 * normal1[2] + sign2 * normal2[2]);
    return boxes.some((box, index) => index !== self && contains(box, x, y, z));
  };
  const acrossFirst = filled(1, -1);
  const acrossSecond = filled(-1, 1);
  const acrossBoth = filled(1, 1);
  const flat =
    (acrossFirst && !acrossSecond && !acrossBoth) ||
    (!acrossFirst && acrossSecond && !acrossBoth) ||
    (acrossFirst && acrossSecond && acrossBoth);
  return !flat;
}

/** Every coordinate along `axis` where some other box starts or stops. */
function splitPoints(
  boxes: readonly InstructionBox[],
  self: number,
  axis: number,
  from: number,
  to: number,
): number[] {
  const cuts = new Set([from, to]);
  for (const [index, box] of boxes.entries()) {
    if (index === self) continue;
    for (const value of [box.min[axis]!, box.max[axis]!]) {
      if (value > from && value < to) cuts.add(value);
    }
  }
  return [...cuts].sort((left, right) => left - right);
}

/**
 * The printed outline of one box of a part, in the part's own frame, with the
 * seams its siblings bury left out.
 *
 * The vertices are absolute rather than centred on the box, because a
 * compound part's boxes are not centred on the part and an outline drawn at the
 * part origin would sit somewhere the solid is not.
 */
export function instructionBoxOutline(
  boxes: readonly InstructionBox[],
  self: number,
): BufferGeometry {
  const box = boxes[self];
  if (!box) {
    throw new RangeError(
      `Box ${self} is out of range for a part with ${boxes.length} body boxes. ` +
        `Pass the index of the box being outlined within the same array the seams are tested against.`,
    );
  }
  const positions: number[] = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const first = (axis + 1) % 3;
    const second = (axis + 2) % 3;
    for (const sign1 of [-1, 1]) {
      for (const sign2 of [-1, 1]) {
        const normal1: [number, number, number] = [0, 0, 0];
        const normal2: [number, number, number] = [0, 0, 0];
        normal1[first] = sign1;
        normal2[second] = sign2;
        const corner: [number, number, number] = [0, 0, 0];
        corner[first] = (sign1 < 0 ? box.min[first] : box.max[first])!;
        corner[second] = (sign2 < 0 ? box.min[second] : box.max[second])!;
        const cuts = splitPoints(boxes, self, axis, box.min[axis]!, box.max[axis]!);
        for (let step = 0; step + 1 < cuts.length; step += 1) {
          const start = cuts[step]!;
          const end = cuts[step + 1]!;
          const midpoint: [number, number, number] = [...corner];
          midpoint[axis] = (start + end) / 2;
          if (!isUnionCrease(boxes, self, midpoint, normal1, normal2)) continue;
          const from: [number, number, number] = [...corner];
          const to: [number, number, number] = [...corner];
          from[axis] = start;
          to[axis] = end;
          positions.push(...from, ...to);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

/**
 * The ink one part's outlines are drawn in.
 *
 * The depth bias lives in the vertex shader rather than in `polygonOffset`
 * because WebGL only offsets polygons, never lines: the only way to move a line
 * is to move it. Biasing in view space means the shift is a fixed distance in
 * world units at every depth and every face angle, which is what a constant
 * depth-buffer offset never was.
 */
export function createInstructionInkMaterial(
  displayHex: number,
  partId: string,
): LineBasicMaterial {
  const material = new LineBasicMaterial({ color: instructionEdgeHex(displayHex) });
  material.name = `instruction-outline-material:${partId}`;
  material.userData = { renderRole: "instruction-outline-material", displayHex };
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      {
        vec4 inkViewPosition = modelViewMatrix * vec4( transformed, 1.0 );
        inkViewPosition.z += ${INSTRUCTION_LINE_DEPTH_BIAS.toFixed(5)};
        gl_Position = projectionMatrix * inkViewPosition;
      }`,
    );
  };
  return material;
}

interface MaybeRenderable extends Object3D {
  readonly material?: Material | Material[];
}

/** A part fill, which is the only material this switch is allowed to touch. */
function partFillMaterial(object: Object3D): MeshBasicMaterial | null {
  const material = (object as MaybeRenderable).material;
  if (!material || Array.isArray(material)) return null;
  if (material.userData.renderRole !== "part-material") return null;
  if (typeof material.userData.displayHex !== "number") return null;
  return material as MeshBasicMaterial;
}

/**
 * Switches an instruction scene between printed art and a silhouette key.
 *
 * The closed loop identifies a candidate part by rendering it in a colour no
 * other part uses and keying that exact hex out of the render. Shaded art has
 * no single exact hex to key — that is the point of shading it — so a mask
 * render turns shading off and the fill goes back to one flat pass of the
 * part's display hex, which is byte for byte what this renderer drew before it
 * learned to shade. Ink goes off with it, because outlines drawn over a keyed
 * fill leave the silhouette riddled with one-pixel holes: panel one of the
 * closed loop reported eighteen highlight regions instead of one.
 */
export function setInstructionSilhouetteMode(root: Object3D, enabled: boolean): void {
  const finish = root.userData.finish;
  if (finish !== "instruction") {
    throw new Error(
      `Cannot set silhouette mode on a "${String(finish)}" scene root: only an instruction scene ` +
        `draws the shaded fills and ink this switches. Derive the scene with { finish: "instruction" }, ` +
        `and pass its \`root\`, not a part object inside it.`,
    );
  }
  root.traverse((object) => {
    if (object.userData.renderRole === "instruction-outline") {
      object.visible = !enabled;
      return;
    }
    const material = partFillMaterial(object);
    if (!material) return;
    const shaded = !enabled;
    if (material.vertexColors === shaded) return;
    material.vertexColors = shaded;
    material.color.setHex(
      shaded ? INSTRUCTION_ART_MATERIAL_HEX : (material.userData.displayHex as number),
    );
    material.needsUpdate = true;
  });
}
