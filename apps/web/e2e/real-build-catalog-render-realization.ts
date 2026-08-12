import {
  MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  type LduVector3,
  type OrientationMatrix,
  type PartDefinition,
} from "@lego-studio/catalog";
import { createPartInstance } from "@lego-studio/brick-kernel";
import {
  THREE_UNITS_PER_LDU,
  createCatalogPartGeometry,
  disposeObjectTree,
} from "@lego-studio/rendering";

interface FrameLike {
  readonly matrix: OrientationMatrix;
  readonly translationLdu: LduVector3;
}

export interface FlatRenderTriangleRealization {
  readonly supported: boolean;
  /** Left keys followed by right keys. */
  readonly keys: readonly string[];
  readonly splitIndex: number;
  readonly witness: string | null;
}

interface AttributeLike {
  readonly count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
}

interface GeometryLike {
  readonly userData: Record<string, unknown>;
  readonly drawRange: { readonly start: number; readonly count: number };
  getAttribute(name: string): AttributeLike | undefined;
  getIndex(): AttributeLike | null;
}

interface LocalRenderVertex {
  readonly positionLdu: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
}

interface LocalRenderTriangle {
  readonly role: string;
  readonly vertices: readonly [LocalRenderVertex, LocalRenderVertex, LocalRenderVertex];
}

const NORMAL_QUANTIZATION = 1e-5;
const ORTHONORMAL_TOLERANCE = 1e-9;

const normalized = (value: number): number => (Object.is(value, -0) ? 0 : value);

function matrixPoint(elements: ArrayLike<number>, x: number, y: number, z: number) {
  return [
    elements[0]! * x + elements[4]! * y + elements[8]! * z + elements[12]!,
    elements[1]! * x + elements[5]! * y + elements[9]! * z + elements[13]!,
    elements[2]! * x + elements[6]! * y + elements[10]! * z + elements[14]!,
  ] as const;
}

function matrixNormal(elements: ArrayLike<number>, x: number, y: number, z: number) {
  const columns = [
    [elements[0]!, elements[1]!, elements[2]!],
    [elements[4]!, elements[5]!, elements[6]!],
    [elements[8]!, elements[9]!, elements[10]!],
  ] as const;
  const dot = (left: readonly number[], right: readonly number[]) =>
    left.reduce((sum, value, axis) => sum + value * right[axis]!, 0);
  if (
    columns.some((column) => Math.abs(dot(column, column) - 1) > ORTHONORMAL_TOLERANCE) ||
    Math.abs(dot(columns[0], columns[1])) > ORTHONORMAL_TOLERANCE ||
    Math.abs(dot(columns[0], columns[2])) > ORTHONORMAL_TOLERANCE ||
    Math.abs(dot(columns[1], columns[2])) > ORTHONORMAL_TOLERANCE
  ) {
    throw new TypeError(
      "Flat catalog geometry contains a non-rigid object transform; its normals need an explicit inverse-transpose proof.",
    );
  }
  return [
    elements[0]! * x + elements[4]! * y + elements[8]! * z,
    elements[1]! * x + elements[5]! * y + elements[9]! * z,
    elements[2]! * x + elements[6]! * y + elements[10]! * z,
  ] as const;
}

function readVertex(
  position: AttributeLike,
  normal: AttributeLike,
  index: number,
  elements: ArrayLike<number>,
): LocalRenderVertex {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= position.count ||
    index >= normal.count
  ) {
    throw new RangeError(
      `Flat catalog triangle index ${index} is outside position/normal counts ${position.count}/${normal.count}.`,
    );
  }
  const point = matrixPoint(
    elements,
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  );
  const direction = matrixNormal(
    elements,
    normal.getX(index),
    normal.getY(index),
    normal.getZ(index),
  );
  return {
    positionLdu: [
      point[0] / THREE_UNITS_PER_LDU,
      -point[1] / THREE_UNITS_PER_LDU,
      point[2] / THREE_UNITS_PER_LDU,
    ],
    normal: [direction[0], -direction[1], direction[2]],
  };
}

function extractLocalTriangles(definition: PartDefinition): LocalRenderTriangle[] {
  const diagnostics: Parameters<typeof createCatalogPartGeometry>[3] = [];
  const group = createCatalogPartGeometry(
    createPartInstance({
      id: "catalog-realization-witness",
      catalogPartId: definition.id,
      colorId: definition.availableColorIds[0] ?? "builtin:red",
    }),
    definition,
    true,
    diagnostics,
    "flat",
  );
  try {
    if (diagnostics.length > 0) {
      throw new TypeError(
        `Flat geometry for catalog part ${definition.id} emitted ${diagnostics.map(({ code, message }) => `${code}: ${message}`).join("; ")}.`,
      );
    }
    group.updateMatrixWorld(true);
    const triangles: LocalRenderTriangle[] = [];
    group.traverse((object) => {
      const renderable = object as typeof object & {
        readonly isMesh?: boolean;
        readonly geometry?: GeometryLike;
      };
      if (renderable.isMesh !== true || renderable.geometry === undefined) return;
      const geometry = renderable.geometry;
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      if (position === undefined || normal === undefined || normal.count !== position.count) {
        throw new TypeError(
          `Flat geometry mesh ${JSON.stringify(object.name)} for ${definition.id} lacks one normal per position.`,
        );
      }
      const index = geometry.getIndex();
      const scalarCount = index?.count ?? position.count;
      const start = geometry.drawRange.start;
      const requestedCount = geometry.drawRange.count;
      const end = Number.isFinite(requestedCount)
        ? Math.min(scalarCount, start + requestedCount)
        : scalarCount;
      if (!Number.isSafeInteger(start) || start < 0 || (end - start) % 3 !== 0) {
        throw new TypeError(
          `Flat geometry mesh ${JSON.stringify(object.name)} for ${definition.id} has non-triangular draw range ${start}..${end}.`,
        );
      }
      const role = String(
        object.userData.renderRole ?? geometry.userData.renderRole ?? object.name ?? "unnamed-mesh",
      );
      const elements = object.matrixWorld.elements;
      const sourceIndex = (offset: number): number => index?.getX(offset) ?? offset;
      for (let offset = start; offset < end; offset += 3) {
        triangles.push({
          role,
          vertices: [
            readVertex(position, normal, sourceIndex(offset), elements),
            readVertex(position, normal, sourceIndex(offset + 1), elements),
            readVertex(position, normal, sourceIndex(offset + 2), elements),
          ],
        });
      }
    });
    if (triangles.length === 0) {
      throw new TypeError(
        `Flat geometry for catalog part ${definition.id} contains no render triangles.`,
      );
    }
    return triangles;
  } finally {
    disposeObjectTree(group);
  }
}

function rotate(frame: FrameLike, point: readonly [number, number, number]) {
  const m = frame.matrix;
  return [
    m[0] * point[0] + m[1] * point[1] + m[2] * point[2],
    m[3] * point[0] + m[4] * point[1] + m[5] * point[2],
    m[6] * point[0] + m[7] * point[1] + m[8] * point[2],
  ] as const;
}

function quantized(value: number, quantum: number): number {
  const result = Math.round(normalized(value) / quantum);
  return result === 0 ? 0 : result;
}

function triangleKeys(triangles: readonly LocalRenderTriangle[], frame: FrameLike): string[] {
  return triangles
    .map((triangle) => {
      const vertices = triangle.vertices
        .map((vertex) => {
          const point = rotate(frame, vertex.positionLdu);
          const direction = rotate(frame, vertex.normal);
          return JSON.stringify({
            p: point.map((value, axis) =>
              quantized(
                value + frame.translationLdu[axis]!,
                MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
              ),
            ),
            n: direction.map((value) => quantized(value, NORMAL_QUANTIZATION)),
          });
        })
        .sort((left, right) => left.localeCompare(right));
      return `${triangle.role}:${vertices.join("|")}`;
    })
    .sort((left, right) => left.localeCompare(right));
}

/** Full flat triangle+normal witness, quantized only at the renderer's admitted precision. */
export function flatRenderTriangleRealizationKeys(
  definition: PartDefinition,
  left: FrameLike,
  right: FrameLike,
): FlatRenderTriangleRealization {
  try {
    const triangles = extractLocalTriangles(definition);
    const leftKeys = triangleKeys(triangles, left);
    const rightKeys = triangleKeys(triangles, right);
    return {
      supported: true,
      keys: [...leftKeys, ...rightKeys],
      splitIndex: leftKeys.length,
      witness: null,
    };
  } catch (error) {
    return {
      supported: false,
      keys: [],
      splitIndex: 0,
      witness:
        error instanceof Error
          ? error.message
          : "flat render realization failed without an Error object",
    };
  }
}
