import { memo } from "react";

import {
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  resolvePreloadedMeshAsset,
  sampleBodyArcPlanBoundary,
  type CollisionPrimitive,
  type MeshAssetResolver,
  type PartDefinition,
  type ResolvedMeshAsset,
} from "@lego-studio/catalog";

import {
  ISO_X,
  ISO_Y,
  STUD_PX,
  createPreviewFrame,
  lduBoxToScene,
  outwardEdgeNormals,
  project,
  type SceneBox,
} from "./part-preview-projection";

const MAX_PREVIEW_MESH_TRIANGLES = 2_000;

function sampledTriangleNumbers(asset: ResolvedMeshAsset): readonly number[] {
  const { triangleCount } = asset;
  const sampleCount = Math.min(triangleCount, MAX_PREVIEW_MESH_TRIANGLES);
  if (sampleCount === triangleCount) {
    return Array.from({ length: triangleCount }, (_, index) => index);
  }
  const selected = new Set<number>([
    ...asset.groups.map(({ triangleStart }) => triangleStart),
    ...asset.componentFirstTriangles,
    ...asset.extremalTriangles,
  ]);
  if (selected.size > sampleCount) {
    throw new RangeError(
      `Mesh preview needs ${selected.size} mandatory group/component/extremal triangles but its deterministic cap is ${sampleCount}; the closed resolver's group and component limits should have rejected this asset.`,
    );
  }
  const remaining = sampleCount - selected.size;
  for (let index = 0; index < remaining; index += 1) {
    let candidate = Math.floor(((index + 0.5) * triangleCount) / remaining);
    while (selected.has(candidate) && candidate + 1 < triangleCount) candidate += 1;
    while (selected.has(candidate) && candidate > 0) candidate -= 1;
    selected.add(candidate);
  }
  for (let triangle = 0; selected.size < sampleCount && triangle < triangleCount; triangle += 1) {
    selected.add(triangle);
  }
  return [...selected].sort((left, right) => left - right);
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
  readonly resolveMeshAsset?: MeshAssetResolver;
}

function meshPreviewPlaceholder(part: PartDefinition, code: string, message: string) {
  return (
    <svg
      className="part-preview"
      viewBox="0 0 64 48"
      role="img"
      aria-label={`${part.displayName} preview unavailable: ${message}`}
      focusable="false"
      data-preview-source="mesh-placeholder"
      data-preview-diagnostic={code}
    >
      <title>{message}</title>
      <rect x="2" y="2" width="60" height="44" fill="none" stroke="#ff2bd6" strokeWidth="4" />
      <path d="M8 8 L56 40 M56 8 L8 40" fill="none" stroke="#ff2bd6" strokeWidth="4" />
    </svg>
  );
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
 * A derived SVG thumbnail of a catalog part. It reads the same
 * authoritative dimensions the renderer does and maps them through the
 * renderer's own basis change, so the palette cannot drift from what actually
 * gets placed, down to its hand. `part-preview-projection.ts` holds the view.
 *
 * Memoized because it is a pure function of its props and the palette draws 84
 * of them: `part` comes from the module-level `PART_DEFINITIONS`, `colorHex` is
 * a string, and the resolver is the module default unless a test supplies one.
 * Unmemoized, every unrelated re-render of the app re-projected and re-sorted
 * every triangle of every thumbnail.
 */
export const PartPreview = memo(function PartPreview({
  part,
  colorHex,
  resolveMeshAsset = resolvePreloadedMeshAsset,
}: PartPreviewProps) {
  const { widthStuds, lengthStuds, heightLdu } = part.dimensions;
  const height = heightLdu / STUD_PITCH_LDU;
  const studRadius = (STUD_RADIUS_LDU / STUD_PITCH_LDU) * STUD_PX;

  // Preview space is scene space in studs, with the part's base at y = 0: the
  // catalog body measures down in LDU from the part's centre, so its base is at
  // LDU y = heightLdu / 2 and its top at `height`.
  const toScene = createPreviewFrame({
    min: [part.bodyBoundsLdu.min[0], -heightLdu / 2, part.bodyBoundsLdu.min[2]],
    max: [part.bodyBoundsLdu.max[0], heightLdu / 2, part.bodyBoundsLdu.max[2]],
  });
  const toScenePlan = (x: number, z: number): PlanPoint => {
    const [sceneX, , sceneZ] = toScene(x, 0, z);
    return [sceneX, sceneZ];
  };
  // Studs come from the part's own collision primitives, the same source the
  // renderer draws from, so a studless part such as a tile shows none.
  const studTops = (): readonly (readonly [number, number])[] =>
    part.collision.primitives
      .filter(
        (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
          primitive.kind === "cylinder" && primitive.tag === "stud",
      )
      .map((primitive) => {
        const [x, z] = toScenePlan(primitive.centerLdu[0], primitive.centerLdu[2]);
        return project(x, height, z);
      });
  if (part.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
    const resolution = resolveMeshAsset(part.geometry);
    if (!resolution.ok) {
      return meshPreviewPlaceholder(part, resolution.code, resolution.message);
    }

    const { positionsLdu, indices } = resolution.asset;
    const toMeshScene = createPreviewFrame(part.boundsLdu);
    const triangleNumbers = sampledTriangleNumbers(resolution.asset);
    const vertices = new Map<
      number,
      { readonly x: number; readonly y: number; readonly z: number; readonly projected: PlanPoint }
    >();
    const vertex = (index: number) => {
      const cached = vertices.get(index);
      if (cached !== undefined) return cached;
      const offset = index * 3;
      const [x, y, z] = toMeshScene(
        positionsLdu[offset]!,
        positionsLdu[offset + 1]!,
        positionsLdu[offset + 2]!,
      );
      const value = { x, y, z, projected: project(x, y, z) };
      vertices.set(index, value);
      return value;
    };
    const vertexIndex = (triangle: number, corner: number): number =>
      indices?.[triangle * 3 + corner] ?? triangle * 3 + corner;
    const triangles = triangleNumbers.map((triangleNumber) => {
      const aIndex = vertexIndex(triangleNumber, 0);
      const bIndex = vertexIndex(triangleNumber, 1);
      const cIndex = vertexIndex(triangleNumber, 2);
      const a = vertex(aIndex);
      const b = vertex(bIndex);
      const c = vertex(cIndex);
      const ab = [b.x - a.x, b.y - a.y, b.z - a.z] as const;
      const ac = [c.x - a.x, c.y - a.y, c.z - a.z] as const;
      const normal = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ] as const;
      // Shade by the scene axis a triangle faces most, as the box faces are:
      // the top (scene +Y) full, the right side (scene +X) 0.8 and the LDraw
      // front (scene +Z) 0.62.
      // A triangle turned away takes its axis's shade too, and the far-first
      // order below draws it before the nearer faces that hide it.
      const factor =
        Math.abs(normal[1]) >= Math.max(Math.abs(normal[0]), Math.abs(normal[2]))
          ? 1
          : Math.abs(normal[0]) >= Math.abs(normal[2])
            ? 0.8
            : 0.62;
      return {
        triangleNumber,
        key: `${triangleNumber}:${aIndex}:${bIndex}:${cIndex}`,
        depth: a.x + a.y + a.z + b.x + b.y + b.z + c.x + c.y + c.z,
        factor,
        points: [a.projected, b.projected, c.projected] as const,
      };
    });
    // The camera sits toward scene (1, 1, 1), so a larger x + y + z is nearer.
    triangles.sort((left, right) => left.depth - right.depth);
    const boundsPoints: PlanPoint[] = [];
    for (const x of [part.boundsLdu.min[0], part.boundsLdu.max[0]]) {
      for (const y of [part.boundsLdu.min[1], part.boundsLdu.max[1]]) {
        for (const z of [part.boundsLdu.min[2], part.boundsLdu.max[2]]) {
          boundsPoints.push(project(...toMeshScene(x, y, z)));
        }
      }
    }
    const points = [...boundsPoints, ...triangles.flatMap((triangle) => triangle.points)];
    const pad = 2;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    minX -= pad;
    minY -= pad;
    const previewWidth = maxX - minX + pad;
    const previewHeight = maxY - minY + pad;
    return (
      <svg
        className="part-preview"
        viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${previewWidth.toFixed(2)} ${previewHeight.toFixed(2)}`}
        role="img"
        aria-label={`${part.displayName} preview`}
        focusable="false"
        data-preview-source="preloaded-mesh-asset"
        data-mesh-asset-id={resolution.asset.assetId}
        data-preview-source-triangles={resolution.asset.triangleCount}
        data-preview-rendered-triangles={triangles.length}
        data-preview-sampled={triangles.length < resolution.asset.triangleCount}
      >
        {triangles.map(({ triangleNumber, key, factor, points: triangle }) => (
          <polygon
            key={key}
            points={polygon(triangle)}
            fill={shade(colorHex, factor)}
            data-preview-surface="mesh-triangle"
            data-preview-source-triangle={triangleNumber}
          />
        ))}
      </svg>
    );
  }
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
    const boundary = planBoundary.map(([x, z]) => toScenePlan(x, z));
    const outward = outwardEdgeNormals(boundary);
    const top = boundary.map(([x, z]) => project(x, height, z));
    // The camera sees a side whose outward normal has a positive component
    // along scene (1, 0, 1); the rest are culled, and the seen ones are drawn
    // far first.
    const sides = boundary
      .flatMap(([x, z], index) => {
        const [nextX, nextZ] = boundary[(index + 1) % boundary.length]!;
        const [outwardX, outwardZ] = outward[index]!;
        if (outwardX + outwardZ <= 0) return [];
        return [
          {
            key: `${index}:${x}:${z}`,
            depth: x + z + nextX + nextZ,
            shade: outwardX >= outwardZ ? 0.8 : 0.62,
            points: [
              project(x, height, z),
              project(nextX, height, nextZ),
              project(nextX, 0, nextZ),
              project(x, 0, z),
            ] as const,
          },
        ];
      })
      .sort((left, right) => left.depth - right.depth);
    const studs = studTops();
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
  // A fallback footprint has no LDU box: it spans the part's width, height
  // and length in scene axes from the frame's origin corner.
  const cuboids: readonly SceneBox[] =
    bodyBoxes.length > 0
      ? bodyBoxes.map(({ minLdu, maxLdu }) => lduBoxToScene(toScene, minLdu, maxLdu))
      : [{ x0: 0, x1: widthStuds, y0: 0, y1: height, z0: 0, z1: lengthStuds }];

  // Painter's order for a camera toward scene (1, 1, 1): the farthest box is
  // the one whose near corner is smallest. Each box shows the three faces that
  // camera sees: its top (+Y), its right side (+X) and its LDraw front (+Z).
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
      front: [
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

  const all = faces.flatMap(({ top, front, right }) => [...top, ...front, ...right]);
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const pad = studRadius + 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const depth = Math.max(...ys) - minY + pad;

  const studs = studTops();

  return (
    <svg
      className="part-preview"
      viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${depth.toFixed(2)}`}
      role="img"
      aria-label={`${part.displayName} preview`}
      focusable="false"
    >
      {faces.map(({ key, top, front, right }) => (
        <g key={key}>
          <polygon points={polygon(front)} fill={shade(colorHex, 0.62)} />
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
});
