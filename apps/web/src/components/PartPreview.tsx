import {
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  sampleBodyArcPlanBoundary,
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

type PlanPoint = readonly [x: number, z: number];

/** Exact horizontal section of the catalog's cut-prism primitive. */
function sampleWedgePlanBoundary(
  wedge: Extract<CollisionPrimitive, { kind: "wedge" }>,
): readonly PlanPoint[] {
  const [nx, nz] = wedge.cutNormalXZ;
  const corners: readonly PlanPoint[] = [
    [wedge.minLdu[0], wedge.minLdu[2]],
    [wedge.maxLdu[0], wedge.minLdu[2]],
    [wedge.maxLdu[0], wedge.maxLdu[2]],
    [wedge.minLdu[0], wedge.maxLdu[2]],
  ];
  const inside = ([x, z]: PlanPoint): boolean => nx * x + nz * z <= wedge.cutOffsetLdu;
  const clipped: PlanPoint[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index]!;
    const previous = corners[(index + corners.length - 1) % corners.length]!;
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside) {
      const currentDistance = nx * current[0] + nz * current[1] - wedge.cutOffsetLdu;
      const previousDistance = nx * previous[0] + nz * previous[1] - wedge.cutOffsetLdu;
      const fraction = previousDistance / (previousDistance - currentDistance);
      clipped.push([
        previous[0] + fraction * (current[0] - previous[0]),
        previous[1] + fraction * (current[1] - previous[1]),
      ]);
    }
    if (currentInside) clipped.push(current);
  }
  const unique = clipped.filter(
    (point, index) =>
      index === 0 || point[0] !== clipped[index - 1]![0] || point[1] !== clipped[index - 1]![1],
  );
  if (
    unique.length > 1 &&
    unique[0]![0] === unique[unique.length - 1]![0] &&
    unique[0]![1] === unique[unique.length - 1]![1]
  ) {
    unique.pop();
  }
  return unique;
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
  const toX = (ldu: number): number => (ldu - part.bodyBoundsLdu.min[0]) / STUD_PITCH_LDU;
  const toZ = (ldu: number): number => (ldu - part.bodyBoundsLdu.min[2]) / STUD_PITCH_LDU;
  const arc = part.geometry.bodyArc;
  const wedge = part.collision.primitives.find(
    (primitive): primitive is Extract<CollisionPrimitive, { kind: "wedge" }> =>
      primitive.kind === "wedge" && primitive.tag === "body",
  );
  const planBoundary = arc
    ? sampleBodyArcPlanBoundary(arc, 2)
    : wedge
      ? sampleWedgePlanBoundary(wedge)
      : null;
  if (planBoundary) {
    const boundary = planBoundary.map(([x, z]) => [toX(x), toZ(z)] as const);
    const top = boundary.map(([x, z]) => project(x, height, z));
    const sides = boundary.flatMap(([x, z], index) => {
      const [nextX, nextZ] = boundary[(index + 1) % boundary.length]!;
      const dx = nextX - x;
      const dz = nextZ - z;
      const outwardX = dz;
      const outwardZ = -dx;
      if (outwardX + outwardZ <= 0) return [];
      return [
        {
          key: `${index}:${x}:${z}`,
          shade: outwardX >= outwardZ ? 0.8 : 0.62,
          points: [
            project(x, height, z),
            project(nextX, height, nextZ),
            project(nextX, 0, nextZ),
            project(x, 0, z),
          ] as const,
        },
      ];
    });
    const studs = part.collision.primitives
      .filter(
        (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
          primitive.kind === "cylinder" && primitive.tag === "stud",
      )
      .map((primitive) =>
        project(toX(primitive.centerLdu[0]), height, toZ(primitive.centerLdu[2])),
      );
    const all = [...top, ...sides.flatMap(({ points }) => points), ...studs];
    const xs = all.map(([x]) => x);
    const ys = all.map(([, y]) => y);
    const pad = studRadius + 2;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const previewWidth = Math.max(...xs) - minX + pad;
    const previewHeight = Math.max(...ys) - minY + pad;
    return (
      <svg
        className="part-preview"
        viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${previewWidth.toFixed(2)} ${previewHeight.toFixed(2)}`}
        role="img"
        aria-label={`${part.displayName} preview`}
        focusable="false"
      >
        {sides.map(({ key, shade: factor, points }) => (
          <polygon key={key} points={polygon(points)} fill={shade(colorHex, factor)} />
        ))}
        <polygon
          points={polygon(top)}
          fill={colorHex}
          data-preview-surface="plan-top"
          data-plan-vertices={boundary.length}
        />
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
  // The same body boxes the renderer draws, so an arch shows its void and a
  // corner plate its missing quarter. Round body cylinders have no boxes and
  // retain the footprint fallback; cut prisms and arcs were handled exactly
  // above rather than being widened into that fallback rectangle.
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
    .map((primitive) => project(toX(primitive.centerLdu[0]), height, toZ(primitive.centerLdu[2])));

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
