import type { LxfmlModel, LxfmlMultiBuild, LxfmlStep } from "./lxfml.ts";

/**
 * The official build sequence flattened into physical build order.
 *
 * Every LXFML Step becomes exactly one unit, emitted after the units of the
 * sub-builds it attaches — a sub-build is assembled before the step that
 * attaches it, whatever order the file lists them in. A repeat copy made by a
 * MultiBuild joins the unit of the master brick it duplicates, because the
 * booklet's callouts count every copy in the step that builds the master
 * ("4x" beside a sub-build built four times).
 *
 * A printed step is a run of consecutive units; the aligner decides which.
 */
export interface BuildUnit {
  readonly index: number;
  readonly stepName: string;
  readonly stepOrdinal: number;
  /** Enclosing sub-builds, 0 for the top level. */
  readonly depth: number;
  /** Bricks added here: each direct brick followed by its repeat copies. */
  readonly brickRefs: readonly string[];
  /** How many of `brickRefs` are MultiBuild copies. */
  readonly copyCount: number;
  /** Sub-build uuids this step attaches. */
  readonly attachesSubBuilds: readonly string[];
}

/** One level of sub-build nesting a brick sits in, outermost first. */
export interface AssemblyLevel {
  /** Unique per physical sub-assembly: repeat copies get their own key. */
  readonly key: string;
  /** Unit that attaches this sub-assembly to its parent. */
  readonly attachUnit: number;
}

export interface BrickPlacement {
  readonly unit: number;
  readonly levels: readonly AssemblyLevel[];
  /** Set for a MultiBuild copy: the brick it duplicates. */
  readonly copyOf: string | null;
}

export interface BuildSequence {
  readonly units: readonly BuildUnit[];
  readonly placements: ReadonlyMap<string, BrickPlacement>;
  /** Inventory bricks no step adds, in inventory order. */
  readonly unplaced: readonly string[];
  /** Structural contradictions in the sequence, each naming the offending reference. */
  readonly problems: readonly string[];
}

interface CopyEdge {
  readonly actual: string;
  readonly multiBuild: LxfmlMultiBuild;
}

interface PendingLevel {
  readonly segment: string;
  attachUnit: number;
}

interface RawPlacement {
  readonly unit: number;
  readonly chain: readonly PendingLevel[];
  readonly copy: { readonly of: string; readonly multiBuild: LxfmlMultiBuild } | null;
}

function collectCopies(steps: readonly LxfmlStep[], into: Map<string, CopyEdge[]>): void {
  for (const step of steps) {
    for (const multiBuild of step.multiBuilds) {
      for (const copy of multiBuild.copies) {
        const edges = into.get(copy.original) ?? [];
        edges.push({ actual: copy.actual, multiBuild });
        into.set(copy.original, edges);
      }
    }
    for (const subBuild of step.subBuilds) collectCopies(subBuild.steps, into);
  }
}

export function flattenBuildSequence(model: LxfmlModel): BuildSequence {
  const problems: string[] = [];
  const known = new Set(model.bricks.map(({ uuid }) => uuid));
  const units: BuildUnit[] = [];
  const raw = new Map<string, RawPlacement>();
  const copies = new Map<string, CopyEdge[]>();
  const steps = model.instruction?.steps ?? [];
  collectCopies(steps, copies);

  const place = (ref: string, placement: RawPlacement, into: string[]): number => {
    if (!known.has(ref)) {
      problems.push(
        `Step unit ${placement.unit} adds brick ${ref}, which is not in the Bricks inventory.`,
      );
      return 0;
    }
    if (raw.has(ref)) {
      problems.push(
        `Brick ${ref} is added twice (units ${raw.get(ref)!.unit} and ${placement.unit}); a brick is placed once.`,
      );
      return 0;
    }
    raw.set(ref, placement);
    into.push(ref);
    let added = 0;
    for (const edge of copies.get(ref) ?? []) {
      added +=
        1 +
        place(edge.actual, { ...placement, copy: { of: ref, multiBuild: edge.multiBuild } }, into);
    }
    return added;
  };

  const flatten = (step: LxfmlStep, chain: readonly PendingLevel[]): void => {
    const attached: PendingLevel[] = [];
    for (const subBuild of step.subBuilds) {
      const level: PendingLevel = { segment: subBuild.uuid, attachUnit: -1 };
      for (const inner of subBuild.steps) flatten(inner, [...chain, level]);
      attached.push(level);
    }
    const index = units.length;
    for (const level of attached) level.attachUnit = index;
    const brickRefs: string[] = [];
    let copyCount = 0;
    for (const ref of step.brickRefs) {
      copyCount += place(ref, { unit: index, chain, copy: null }, brickRefs);
    }
    units.push(
      Object.freeze({
        index,
        stepName: step.name,
        stepOrdinal: step.ordinal,
        depth: chain.length,
        brickRefs: Object.freeze(brickRefs),
        copyCount,
        attachesSubBuilds: Object.freeze(step.subBuilds.map(({ uuid }) => uuid)),
      }),
    );
  };
  for (const step of steps) flatten(step, []);

  for (const [original, edges] of copies) {
    if (!raw.has(original)) {
      for (const edge of edges) {
        problems.push(
          `MultiBuild ${JSON.stringify(edge.multiBuild.name)} copies brick ${original}, which no step adds, so copy ${edge.actual} has no step.`,
        );
      }
    }
  }

  const resolved = new Map<string, readonly string[]>();
  const segmentsOf = (ref: string): readonly string[] => {
    const cached = resolved.get(ref);
    if (cached) return cached;
    const placement = raw.get(ref)!;
    let segments = placement.chain.map(({ segment }) => segment);
    if (placement.copy) {
      const base = [...segmentsOf(placement.copy.of)];
      const master = placement.chain.findIndex(
        ({ segment }) => segment === placement.copy!.multiBuild.masterSubBuildRef,
      );
      if (master < 0) {
        problems.push(
          `MultiBuild ${JSON.stringify(placement.copy.multiBuild.name)} names master sub-build ${placement.copy.multiBuild.masterSubBuildRef}, which does not enclose brick ${placement.copy.of}.`,
        );
      } else {
        base[master] = `${base[master]}#m${placement.copy.multiBuild.ordinal}`;
      }
      segments = base;
    }
    resolved.set(ref, segments);
    return segments;
  };

  const placements = new Map<string, BrickPlacement>();
  for (const [ref, placement] of raw) {
    const segments = segmentsOf(ref);
    placements.set(
      ref,
      Object.freeze({
        unit: placement.unit,
        copyOf: placement.copy?.of ?? null,
        levels: Object.freeze(
          placement.chain.map((level, depth) =>
            Object.freeze({
              key: segments.slice(0, depth + 1).join("/"),
              attachUnit: level.attachUnit,
            }),
          ),
        ),
      }),
    );
  }

  return Object.freeze({
    units: Object.freeze(units),
    placements,
    unplaced: Object.freeze(
      model.bricks.filter(({ uuid }) => !raw.has(uuid)).map(({ uuid }) => uuid),
    ),
    problems: Object.freeze(problems),
  });
}

/**
 * Which sub-assembly a placed brick belongs to once units 0..`lastUnit` are
 * built: the deepest sub-build not yet attached, or the finished model.
 */
export function assemblyKeyAt(placement: BrickPlacement, lastUnit: number): string {
  for (let depth = placement.levels.length - 1; depth >= 0; depth -= 1) {
    const level = placement.levels[depth]!;
    if (level.attachUnit > lastUnit) return level.key;
  }
  return "model";
}
