import { STUD_PITCH_LDU, STUD_RADIUS_LDU, type PartDefinition } from "@lego-studio/catalog";

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

  const top = [
    project(0, height, 0),
    project(widthStuds, height, 0),
    project(widthStuds, height, lengthStuds),
    project(0, height, lengthStuds),
  ] as const;
  const left = [
    project(0, height, lengthStuds),
    project(widthStuds, height, lengthStuds),
    project(widthStuds, 0, lengthStuds),
    project(0, 0, lengthStuds),
  ] as const;
  const right = [
    project(widthStuds, height, 0),
    project(widthStuds, height, lengthStuds),
    project(widthStuds, 0, lengthStuds),
    project(widthStuds, 0, 0),
  ] as const;

  const all = [...top, ...left, ...right];
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const pad = studRadius + 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const depth = Math.max(...ys) - minY + pad;

  const studs = Array.from({ length: widthStuds }, (_, xIndex) =>
    Array.from({ length: lengthStuds }, (_, zIndex) => project(xIndex + 0.5, height, zIndex + 0.5)),
  ).flat();

  return (
    <svg
      className="part-preview"
      viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${depth.toFixed(2)}`}
      role="img"
      aria-label={`${part.displayName} preview`}
      focusable="false"
    >
      <polygon points={polygon(left)} fill={shade(colorHex, 0.62)} />
      <polygon points={polygon(right)} fill={shade(colorHex, 0.8)} />
      <polygon points={polygon(top)} fill={colorHex} />
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
