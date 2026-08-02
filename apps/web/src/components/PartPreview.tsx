import {
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  type CollisionPrimitive,
  type PartDefinition,
} from "@lego-studio/catalog";

/** Isometric basis: X goes down-right, Z down-left, height straight up. */
const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);
const STUD_PX = 9;

function project(x: number, y: number, z: number): readonly [number, number] {
  return [(x - z) * ISO_X * STUD_PX, ((x + z) * ISO_Y - y) * STUD_PX];
}

function polygon(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** Multiplies an sRGB hex toward black for the shaded faces. */
function shade(hex: string, factor: number): string {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    Math.round(Math.min(255, Number.parseInt(value.slice(offset, offset + 2), 16) * factor)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

interface PartPreviewProps {
  readonly part: PartDefinition;
  readonly colorHex: string;
}

/**
 * A derived, dependency-free thumbnail of a catalog part. It reads the same
 * authoritative dimensions the renderer does, so the palette cannot drift from
 * what actually gets placed.
 */
export function PartPreview({ part, colorHex }: PartPreviewProps) {
  const { widthStuds, lengthStuds, heightLdu } = part.dimensions;
  const height = heightLdu / STUD_PITCH_LDU;
  const studRadius = (STUD_RADIUS_LDU / STUD_PITCH_LDU) * STUD_PX;

  // Preview space puts the part's own base at zero and measures up in studs,
  // while the catalog measures down in LDU from the part's centre.
  const toY = (ldu: number): number => (heightLdu / 2 - ldu) / STUD_PITCH_LDU;
  const toX = (ldu: number): number => ldu / STUD_PITCH_LDU + widthStuds / 2;
  const toZ = (ldu: number): number => ldu / STUD_PITCH_LDU + lengthStuds / 2;
  // The same body boxes the renderer draws, so an arch shows its void and a
  // corner plate its missing quarter. A part whose body is a wedge or a
  // cylinder has no boxes and falls back to its footprint, which is what this
  // preview has always drawn for it.
  const bodyBoxes = part.collision.primitives.filter(
    (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
      primitive.kind === "box" && primitive.tag === "body",
  );
  const cuboids: readonly {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
    readonly z0: number;
    readonly z1: number;
  }[] =
    bodyBoxes.length > 0
      ? bodyBoxes.map(({ minLdu, maxLdu }) => ({
          x0: toX(minLdu[0]),
          x1: toX(maxLdu[0]),
          // LDU y runs downward, so the box's minimum is its top.
          y0: toY(maxLdu[1]),
          y1: toY(minLdu[1]),
          z0: toZ(minLdu[2]),
          z1: toZ(maxLdu[2]),
        }))
      : [{ x0: 0, x1: widthStuds, y0: 0, y1: height, z0: 0, z1: lengthStuds }];

  // Painter's order for an isometric view seen from large x, y and z: the
  // farthest box is the one whose near corner is smallest.
  const faces = [...cuboids]
    .sort((left, right) => left.x1 + left.y1 + left.z1 - (right.x1 + right.y1 + right.z1))
    .map(({ x0, x1, y0, y1, z0, z1 }) => ({
      key: `${x0}:${y0}:${z0}:${x1}:${y1}:${z1}`,
      top: [
        project(x0, y1, z0),
        project(x1, y1, z0),
        project(x1, y1, z1),
        project(x0, y1, z1),
      ] as const,
      left: [
        project(x0, y1, z1),
        project(x1, y1, z1),
        project(x1, y0, z1),
        project(x0, y0, z1),
      ] as const,
      right: [
        project(x1, y1, z0),
        project(x1, y1, z1),
        project(x1, y0, z1),
        project(x1, y0, z0),
      ] as const,
    }));

  const all = faces.flatMap(({ top, left, right }) => [...top, ...left, ...right]);
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const pad = studRadius + 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const depth = Math.max(...ys) - minY + pad;

  // Studs come from the part's own collision primitives, the same source the
  // renderer draws from, so a studless part such as a tile shows none.
  const studs = part.collision.primitives
    .filter(
      (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
        primitive.kind === "cylinder" && primitive.tag === "stud",
    )
    .map((primitive) =>
      project(
        primitive.centerLdu[0] / STUD_PITCH_LDU + widthStuds / 2,
        height,
        primitive.centerLdu[2] / STUD_PITCH_LDU + lengthStuds / 2,
      ),
    );

  return (
    <svg
      className="part-preview"
      viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${depth.toFixed(2)}`}
      role="img"
      aria-label={`${part.displayName} preview`}
      focusable="false"
    >
      {faces.map(({ key, top, left, right }) => (
        <g key={key}>
          <polygon points={polygon(left)} fill={shade(colorHex, 0.62)} />
          <polygon points={polygon(right)} fill={shade(colorHex, 0.8)} />
          <polygon points={polygon(top)} fill={colorHex} />
        </g>
      ))}
      {studs.map(([x, y]) => (
        <ellipse
          key={`${x.toFixed(2)}:${y.toFixed(2)}`}
          cx={x}
          cy={y - studRadius * ISO_Y}
          rx={studRadius * ISO_X}
          ry={studRadius * ISO_Y}
          fill={shade(colorHex, 1.14)}
          stroke={shade(colorHex, 0.72)}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}
