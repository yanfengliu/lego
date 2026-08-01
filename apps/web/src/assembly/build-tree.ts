import { canonicalDigest } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

/**
 * Every state a build search has reached, stored as deltas rather than states.
 *
 * Step N differs from step N-1 by one placement, so a tree of deltas with
 * structural sharing holds the whole search. A logged node measures 418 bytes
 * — three quarters of it the three sha256 hex digests it carries — so a
 * 359-step build is 150 KB and a tree exploring ten times the paths is about
 * 1.5 MB, against roughly twenty-five megabytes if each step stored its whole
 * document. The constant is four times the back-of-envelope estimate and the
 * conclusion is unchanged: deltas are two orders of magnitude smaller.
 *
 * Git's internals without git's repository. A node is content-addressed by its
 * parent and its placement, so identical work anywhere in the tree dedupes to
 * one node; backtracking moves a head pointer to an earlier node and deletes
 * nothing; and two children of one parent are two branches, so a rejected
 * branch survives as the counterevidence it is. That is the repo's rule about
 * never overwriting parents, made structural rather than remembered.
 *
 * There is no I/O here. The tree is a value, and `encodeNode` is a line of
 * JSON, so the same structure serves a browser search, a JSON-lines append log
 * and the companion's run ledger without any of them being wired in.
 */
export const BUILD_TREE_SCHEMA_VERSION = "lego.build-tree/1" as const;

export interface Placement {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
  /** Which booklet step this placement belongs to, when following one. */
  readonly stepNumber?: number;
}

export interface BuildNode {
  /** Content address: the digest of parent and placement together. */
  readonly id: string;
  readonly parentId: string | null;
  readonly placement: Placement;
  /** Structural hash of the document this node's chain produces. */
  readonly resultHash: string;
  /** Placements from the root to here, inclusive. */
  readonly depth: number;
}

export class BuildTreeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BuildTreeError";
  }
}

/** The content address of a node, which is what makes identical work dedupe. */
export function buildNodeId(parentId: string | null, placement: Placement): string {
  return canonicalDigest({
    schemaVersion: BUILD_TREE_SCHEMA_VERSION,
    parentId,
    placement,
  });
}

export interface AppendResult {
  readonly node: BuildNode;
  /** The node already existed, so this placement was searched before. */
  readonly deduped: boolean;
}

export class BuildTree {
  readonly #nodes = new Map<string, BuildNode>();
  readonly #children = new Map<string, string[]>();
  #head: string | null = null;

  /**
   * Adds one placement under a parent. Re-adding the same placement under the
   * same parent returns the node that already exists rather than a second copy:
   * two search paths that converge are one state, and storing them twice would
   * make the tree grow with the search instead of with the states reached.
   */
  public append(parentId: string | null, placement: Placement, resultHash: string): AppendResult {
    if (parentId !== null && !this.#nodes.has(parentId)) {
      throw new BuildTreeError(
        `Cannot append under ${parentId}: no such node in a tree of ${this.#nodes.size}. ` +
          `A parent must be appended before its child, and an id is the digest returned by append, not a step number.`,
      );
    }
    const id = buildNodeId(parentId, placement);
    const existing = this.#nodes.get(id);
    if (existing) {
      if (existing.resultHash !== resultHash) {
        throw new BuildTreeError(
          `Node ${id} already records result ${existing.resultHash} but this append claims ${resultHash}. ` +
            `The same placement on the same parent must produce the same document, so one of the two was computed against a different catalog or a different base.`,
        );
      }
      return { node: existing, deduped: true };
    }

    const node: BuildNode = {
      id,
      parentId,
      placement,
      resultHash,
      depth: parentId === null ? 1 : this.#nodes.get(parentId)!.depth + 1,
    };
    this.#nodes.set(id, node);
    const siblings = this.#children.get(parentId ?? "");
    if (siblings) siblings.push(id);
    else this.#children.set(parentId ?? "", [id]);
    if (this.#head === null) this.#head = id;
    return { node, deduped: false };
  }

  public get size(): number {
    return this.#nodes.size;
  }

  public get head(): string | null {
    return this.#head;
  }

  public node(id: string): BuildNode | undefined {
    return this.#nodes.get(id);
  }

  public children(id: string | null): readonly BuildNode[] {
    return (this.#children.get(id ?? "") ?? []).map((childId) => this.#nodes.get(childId)!);
  }

  /**
   * Moves the head to an existing node. This is what backtracking is: nothing
   * is deleted, so the abandoned branch stays available as evidence and as a
   * cache if the search returns to it.
   */
  public moveHead(id: string | null): void {
    if (id !== null && !this.#nodes.has(id)) {
      throw new BuildTreeError(
        `Cannot move the head to ${id}: no such node in a tree of ${this.#nodes.size}. ` +
          `Backtracking moves the head to a node already appended; it never removes one.`,
      );
    }
    this.#head = id;
  }

  /** The placements from the root down to a node, in build order. */
  public chainTo(id: string): readonly BuildNode[] {
    const chain: BuildNode[] = [];
    let at: string | null = id;
    while (at !== null) {
      const node = this.#nodes.get(at);
      if (!node) {
        throw new BuildTreeError(
          `Chain from ${id} reached ${at}, which is not in this tree of ${this.#nodes.size}. ` +
            `A chain is only walkable inside the tree that built it — replay the log into this tree first.`,
        );
      }
      chain.push(node);
      at = node.parentId;
    }
    return chain.reverse();
  }

  /** Nodes with no children: the frontier a beam search carries. */
  public leaves(): readonly BuildNode[] {
    return [...this.#nodes.values()]
      .filter((node) => (this.#children.get(node.id) ?? []).length === 0)
      .sort((left, right) => (left.id < right.id ? -1 : 1));
  }

  /** Every node in append order, which is the order a log replays in. */
  public nodes(): readonly BuildNode[] {
    return [...this.#nodes.values()];
  }
}

/** One node as one line of JSON, which is the whole persistence format. */
export function encodeNode(node: BuildNode): string {
  return JSON.stringify({
    v: BUILD_TREE_SCHEMA_VERSION,
    id: node.id,
    parent: node.parentId,
    placement: node.placement,
    result: node.resultHash,
  });
}

export function decodeNode(line: string): {
  readonly id: string;
  readonly parentId: string | null;
  readonly placement: Placement;
  readonly resultHash: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    throw new BuildTreeError(
      `Build-tree line is not JSON: ${error instanceof Error ? error.message : String(error)}. ` +
        `The log is one node per line, so a line that fails to parse means the file was truncated mid-write or concatenated without a newline.`,
    );
  }
  const record = parsed as Record<string, unknown>;
  if (record.v !== BUILD_TREE_SCHEMA_VERSION) {
    throw new BuildTreeError(
      `Build-tree line declares schema ${String(record.v)}, but this reader is ${BUILD_TREE_SCHEMA_VERSION}. ` +
        `A log is not reinterpreted across schema versions; migrate it explicitly or replay it with the reader it was written by.`,
    );
  }
  if (typeof record.id !== "string" || typeof record.result !== "string") {
    throw new BuildTreeError(
      `Build-tree line is missing its id or result: id=${String(record.id)}, result=${String(record.result)}.`,
    );
  }
  return {
    id: record.id,
    parentId: record.parent === null ? null : String(record.parent),
    placement: record.placement as Placement,
    resultHash: record.result,
  };
}

/**
 * Rebuilds a tree from its log. Reconstruction is replay, and because ids are
 * content addresses the replay verifies itself: a line whose recorded id does
 * not match the digest of its own parent and placement has been altered.
 */
export function replayBuildTree(lines: Iterable<string>): BuildTree {
  const tree = new BuildTree();
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber += 1;
    if (line.trim() === "") continue;
    const record = decodeNode(line);
    const expected = buildNodeId(record.parentId, record.placement);
    if (expected !== record.id) {
      throw new BuildTreeError(
        `Build-tree line ${lineNumber} records id ${record.id} but its parent and placement digest to ${expected}. ` +
          `Ids are content addresses, so this line was edited after it was written, or written by a different schema.`,
      );
    }
    tree.append(record.parentId, record.placement, record.resultHash);
  }
  return tree;
}
