import type { LduVector3 } from "@lego-studio/catalog";
import {
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import { occupiedConnectorCapacityClaims } from "../../apps/web/src/connector-capacity.ts";
import { findStudConnections, restsOnBuildPlate } from "../../apps/web/src/placement.ts";
import {
  officialPoseToCatalog,
  shiftTransform,
  worldShiftFor,
  type FrameBasis,
  type OfficialPose,
  type PoseBlock,
} from "./playback-pose.ts";
import type { MeasuredFrames } from "./ldraw-frames.ts";

/**
 * Stage 4: the reference build, replayed printed step by printed step.
 *
 * Every brick the aligner gave a step is placed at its official pose (moved by
 * one integer world shift onto the editor's build plate), and the state after
 * each step is validated by the brick kernel. The state is not one document:
 * a sub-build the booklet boxes is assembled apart and only joins the model on
 * the step that attaches it, so each pending sub-assembly is validated as its
 * own document and the model as another. Connections are discovered the way
 * the editor's place command discovers them (`findStudConnections`), and a
 * part of the model is held when its connected component rests on the build
 * plate — the editor's support rule. The kernel wants one connected assembly;
 * separate model components that each rest on the plate are reported, not
 * failed, because the booklet builds them that way.
 *
 * A brick the catalog or the document cannot represent blocks its step and
 * every later one: the state after it is no longer the booklet's.
 */
export const PLAYBACK_STAGE_VERSION = "lego.booklet-playback/1";

export const PLAYBACK_LIMITS = Object.freeze({
  /** Issues kept per step in status.json. */
  issuesPerStep: 6,
  /** Kernel documents are bounded; the whole set fits well inside this. */
  maxParts: 10_000,
});

export interface PlaybackBrick {
  readonly uuid: string;
  /** Official LDraw file, for reports. */
  readonly design: string;
  /** Null when the catalog has no part for the design. */
  readonly catalogPartId: string | null;
  readonly ldrawColor: number;
  /** Null when the catalog has no colour for the LDraw code. */
  readonly colorId: string | null;
  readonly pose: OfficialPose;
  /** Where `pose` came from: the export's row, or a frame correction (pin or review). */
  readonly poseSource?: PoseSource;
  /** What the export-pairing check says about this brick's row. */
  readonly pairing?: string;
  /** Sub-assembly the brick belongs to once `lastUnit` is built. */
  readonly assemblyAt: (lastUnit: number) => string;
}

export type PoseSource = "export" | "pin" | "review";

export interface PlaybackStepInput {
  readonly step: number;
  readonly page: number;
  readonly lastUnit: number;
  readonly bricks: readonly PlaybackBrick[];
}

export type BlockKind = "design-missing" | PoseBlock;

export interface PlaybackIssue {
  readonly assembly: string;
  readonly code: string;
  readonly message: string;
  readonly bricks: readonly string[];
}

export interface PlaybackStep {
  readonly step: number;
  readonly page: number;
  readonly status: "valid" | "invalid" | "catalog-blocked";
  /** Issues this step introduces (not present after the step before). */
  readonly newIssues: number;
  readonly added: number;
  readonly placedParts: number;
  readonly pendingSubAssemblies: number;
  /** Model components held only by the build plate; more than one means the kernel sees a disconnected model. */
  readonly plateHeldComponents: number;
  readonly issues: readonly PlaybackIssue[];
  readonly blocks: readonly {
    readonly uuid: string;
    readonly design: string;
    readonly kind: BlockKind;
    readonly detail: string;
  }[];
  /** LDraw colour codes this step validated with a stand-in colour (structure ignores colour). */
  readonly colorStandIns: readonly number[];
}

export interface PlacedPart {
  readonly uuid: string;
  readonly step: number;
  readonly design: string;
  readonly catalogPartId: string;
  readonly colorId: string | null;
  readonly ldrawColor: number;
  readonly transform: RigidTransform;
  readonly frameBasis: FrameBasis;
  readonly poseSource: PoseSource;
  readonly pairing: string | null;
}

/** One LDraw file's LDraw-to-catalog frame, as playback used it. */
export interface FrameUse {
  readonly ldrawFile: string;
  readonly catalogPartId: string;
  readonly basis: FrameBasis;
  readonly parts: number;
}

export interface Playback {
  readonly version: typeof PLAYBACK_STAGE_VERSION;
  readonly worldShiftLdu: LduVector3 | null;
  /** How many placed parts used each LDraw-to-catalog frame basis. */
  readonly frameBases: Readonly<Record<FrameBasis, number>>;
  /** Which frame each LDraw file used, so an inferred frame can be named. */
  readonly frameFiles: readonly FrameUse[];
  /** True when `stopAtFirstNonValid` ended the replay before the last step. */
  readonly stoppedEarly: boolean;
  readonly steps: readonly PlaybackStep[];
  readonly placed: readonly PlacedPart[];
}

/** Connectivity findings list every part they cover, which grows each step; key them by assembly alone. */
const issueKey = (issue: PlaybackIssue) =>
  issue.code === "DISCONNECTED_ASSEMBLY" || issue.code === "UNSUPPORTED_COMPONENT"
    ? `${issue.code} ${issue.assembly}`
    : `${issue.code} ${issue.bricks.join(",")}`;
const partIdOf = (uuid: string) => `official:${uuid}`;
const uuidOf = (partId: string) => partId.replace(/^official:/u, "");

function documentFor(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "booklet-reference",
    name: "Booklet reference",
    maxParts: PLAYBACK_LIMITS.maxParts,
  });
  const partIds = parts.map(({ id }) => id);
  return {
    ...base,
    parts: [...parts],
    connections: [...connections],
    submodels: [{ ...base.submodels[0]!, partIds }],
    steps: [{ ...base.steps[0]!, partIds }],
  };
}

/** Connected components of `parts` under `connections`, each as its part ids. */
function components(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): string[][] {
  const parent = new Map(parts.map(({ id }) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const { a, b } of connections) parent.set(find(a.partId), find(b.partId));
  const groups = new Map<string, string[]>();
  for (const { id } of parts) groups.set(find(id), [...(groups.get(find(id)) ?? []), id]);
  return [...groups.values()];
}

interface AssemblyVerdict {
  readonly issues: PlaybackIssue[];
  readonly plateHeld: number;
}

function validateAssembly(
  key: string,
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): AssemblyVerdict {
  const report = validateBrickDocument(documentFor(parts, connections));
  const issues: PlaybackIssue[] = [];
  let plateHeld = 0;
  for (const issue of report.issues) {
    if (issue.severity !== "blocking") continue;
    if (issue.code === "DISCONNECTED_ASSEMBLY" && key === "model") continue;
    issues.push({
      assembly: key,
      code: issue.code,
      message: issue.message,
      bricks: (issue.partIds ?? []).map(uuidOf),
    });
  }
  if (key === "model") {
    const byId = new Map(parts.map((part) => [part.id, part] as const));
    for (const component of components(parts, connections)) {
      if (component.some((id) => restsOnBuildPlate(byId.get(id)!))) {
        plateHeld += 1;
        continue;
      }
      issues.push({
        assembly: key,
        code: "UNSUPPORTED_COMPONENT",
        message: `${component.length} connected part(s) of the model neither rest on the build plate nor connect to anything that does`,
        bricks: component.map(uuidOf),
      });
    }
  }
  return { issues, plateHeld };
}

/**
 * Replays `steps` in order. Pure apart from the kernel and editor code it calls.
 * `stopAtFirstNonValid` ends the replay after the first step that is not valid,
 * for a caller that needs only how far it stays valid.
 */
export function playBack(
  steps: readonly PlaybackStepInput[],
  measured: MeasuredFrames | null = null,
  options: { readonly stopAtFirstNonValid?: boolean } = {},
): Playback {
  let shift: LduVector3 | null = null;
  for (const brick of steps.flatMap(({ bricks }) => bricks)) {
    if (brick.catalogPartId === null) continue;
    const pose = officialPoseToCatalog(brick.catalogPartId, brick.design, brick.pose, measured);
    if (!pose.ok) continue;
    shift = worldShiftFor({ catalogPartId: brick.catalogPartId, transform: pose.transform });
    break;
  }

  const parts = new Map<string, PartInstance>();
  const groupOf = new Map<string, string>();
  const bricks = new Map<string, PlaybackBrick>();
  const connections: ConnectionEdge[] = [];
  const verdicts = new Map<string, AssemblyVerdict>();
  const placed: PlacedPart[] = [];
  const results: PlaybackStep[] = [];
  let blocked = false;
  let previousIssueKeys = new Set<string>();

  const membersOf = (key: string) =>
    [...parts.values()].filter(({ id }) => groupOf.get(id) === key);
  const connect = (
    part: PartInstance,
    targets: readonly PartInstance[],
    pool: readonly PartInstance[],
  ) => {
    const inPool = new Set(pool.map(({ id }) => id));
    const occupied = new Set(
      occupiedConnectorCapacityClaims(
        pool,
        connections.filter(({ a, b }) => inPool.has(a.partId) && inPool.has(b.partId)),
      ),
    );
    for (const found of findStudConnections(part, targets, occupied)) {
      connections.push({
        id: `connection-${connections.length}`,
        kind: "stud-tube",
        a: { partId: found.targetPartId, portId: found.targetPortId },
        b: { partId: part.id, portId: found.candidatePortId },
        provenance: { source: "import" },
      });
    }
  };

  for (const input of steps) {
    const changed = new Set<string>();
    const blocks: PlaybackStep["blocks"][number][] = [];
    const standIns = new Set<number>();

    // Sub-assemblies this step attaches join their parent before its new bricks land.
    const previous = new Map<string, string>();
    for (const [id, key] of groupOf) {
      const next = bricks.get(uuidOf(id))!.assemblyAt(input.lastUnit);
      if (next === key) continue;
      previous.set(id, key);
      groupOf.set(id, next);
      verdicts.delete(key);
      changed.add(next);
    }
    const settled = new Set<string>();
    for (const [id] of previous) {
      const members = membersOf(groupOf.get(id)!);
      const from = previous.get(id);
      const targets = members.filter(
        (other) =>
          (previous.get(other.id) ?? groupOf.get(other.id)) !== from &&
          (!previous.has(other.id) || settled.has(other.id)),
      );
      connect(parts.get(id)!, targets, members);
      settled.add(id);
    }

    for (const brick of input.bricks) {
      bricks.set(brick.uuid, brick);
      if (brick.catalogPartId === null) {
        blocks.push({
          uuid: brick.uuid,
          design: brick.design,
          kind: "design-missing",
          detail: `no catalog part declares ${brick.design}`,
        });
        continue;
      }
      const catalogPose = officialPoseToCatalog(
        brick.catalogPartId,
        brick.design,
        brick.pose,
        measured,
      );
      const pose =
        catalogPose.ok && shift
          ? shiftTransform(catalogPose.transform, shift, catalogPose.frameBasis)
          : catalogPose;
      if (!pose.ok) {
        blocks.push({
          uuid: brick.uuid,
          design: brick.design,
          kind: pose.block,
          detail: pose.detail,
        });
        continue;
      }
      const key = brick.assemblyAt(input.lastUnit);
      const part = createPartInstance({
        id: partIdOf(brick.uuid),
        catalogPartId: brick.catalogPartId,
        colorId: brick.colorId ?? "builtin:black",
        transform: pose.transform,
        source: "import",
        sourceId: brick.uuid,
      });
      if (brick.colorId === null) standIns.add(brick.ldrawColor);
      const members = membersOf(key);
      parts.set(part.id, part);
      groupOf.set(part.id, key);
      connect(part, members, [...members, part]);
      changed.add(key);
      placed.push({
        uuid: brick.uuid,
        step: input.step,
        design: brick.design,
        catalogPartId: brick.catalogPartId,
        colorId: brick.colorId,
        ldrawColor: brick.ldrawColor,
        transform: pose.transform,
        frameBasis: pose.frameBasis,
        poseSource: brick.poseSource ?? "export",
        pairing: brick.pairing ?? null,
      });
    }

    blocked ||= blocks.length > 0;
    const keys = [...new Set(groupOf.values())].sort();
    let issues: PlaybackIssue[] = [];
    let plateHeld = 0;
    if (!blocked) {
      for (const key of keys) {
        if (!changed.has(key) && verdicts.has(key)) continue;
        const members = membersOf(key);
        const ids = new Set(members.map(({ id }) => id));
        verdicts.set(
          key,
          validateAssembly(
            key,
            members,
            connections.filter(({ a, b }) => ids.has(a.partId) && ids.has(b.partId)),
          ),
        );
      }
      for (const key of keys) {
        issues = issues.concat(verdicts.get(key)?.issues ?? []);
        if (key === "model") plateHeld = verdicts.get(key)?.plateHeld ?? 0;
      }
    }
    // A collision stays in every later state; a step is worth reading when it adds a problem of its own.
    const issueKeys = new Set(issues.map(issueKey));
    const newIssues = issues.filter((issue) => !previousIssueKeys.has(issueKey(issue))).length;
    previousIssueKeys = issueKeys;
    results.push({
      step: input.step,
      page: input.page,
      status: blocked ? "catalog-blocked" : issues.length === 0 ? "valid" : "invalid",
      newIssues,
      added: input.bricks.length,
      placedParts: parts.size,
      pendingSubAssemblies: keys.filter((key) => key !== "model").length,
      plateHeldComponents: plateHeld,
      issues: issues.slice(0, PLAYBACK_LIMITS.issuesPerStep),
      blocks,
      colorStandIns: [...standIns].sort((left, right) => left - right),
    });
    if (options.stopAtFirstNonValid && results.at(-1)!.status !== "valid") break;
  }
  const frameBases: Record<FrameBasis, number> = {
    measured: 0,
    declared: 0,
    "inferred-top-of-body": 0,
  };
  const files = new Map<string, FrameUse>();
  for (const part of placed) {
    frameBases[part.frameBasis] += 1;
    const use = files.get(part.design);
    files.set(part.design, {
      ldrawFile: part.design,
      catalogPartId: part.catalogPartId,
      basis: part.frameBasis,
      parts: (use?.parts ?? 0) + 1,
    });
  }
  return {
    version: PLAYBACK_STAGE_VERSION,
    worldShiftLdu: shift,
    frameBases,
    frameFiles: [...files.values()].sort((left, right) =>
      left.ldrawFile.localeCompare(right.ldrawFile),
    ),
    stoppedEarly: results.length < steps.length,
    steps: results,
    placed,
  };
}
