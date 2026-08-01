import { describe, expect, it } from "vitest";

import {
  BuildTree,
  BuildTreeError,
  buildNodeId,
  decodeNode,
  encodeNode,
  replayBuildTree,
  type Placement,
} from "./build-tree";

function placement(x: number, catalogPartId = "builtin:brick-2x4"): Placement {
  return {
    catalogPartId,
    colorId: "builtin:red",
    transform: { positionLdu: [x, 0, 0], orientationId: "upright-yaw-0" },
  };
}

const RESULT = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function grow(tree: BuildTree, count: number): string {
  let parentId: string | null = null;
  for (let index = 0; index < count; index += 1) {
    parentId = tree.append(parentId, placement(index * 20), `${RESULT}${index}`).node.id;
  }
  return parentId!;
}

describe("the build tree", () => {
  it("addresses a node by its parent and its placement", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    const child = tree.append(root.id, placement(20), RESULT).node;

    expect(root.id).toBe(buildNodeId(null, placement(0)));
    expect(child.id).toBe(buildNodeId(root.id, placement(20)));
    // The same placement under a different parent is a different state.
    expect(buildNodeId(null, placement(20))).not.toBe(child.id);
  });

  it("dedupes identical work instead of storing it twice", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;

    const first = tree.append(root.id, placement(20), RESULT);
    const second = tree.append(root.id, placement(20), RESULT);

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.node.id).toBe(first.node.id);
    expect(tree.size).toBe(2);
  });

  it("refuses to let one state claim two different documents", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    tree.append(root.id, placement(20), `${RESULT}a`);

    expect(() => tree.append(root.id, placement(20), `${RESULT}b`)).toThrowError(
      /must produce the same document/,
    );
  });

  it("keeps a rejected branch rather than erasing it", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    const kept = tree.append(root.id, placement(20), RESULT).node;
    const rejected = tree.append(root.id, placement(40), RESULT).node;

    tree.moveHead(root.id);

    expect(tree.head).toBe(root.id);
    expect(tree.node(rejected.id)).toBeDefined();
    expect(
      tree
        .children(root.id)
        .map((node) => node.id)
        .sort(),
    ).toEqual([kept.id, rejected.id].sort());
  });

  it("walks a chain from the root in build order", () => {
    const tree = new BuildTree();
    const leaf = grow(tree, 5);

    const chain = tree.chainTo(leaf);

    expect(chain).toHaveLength(5);
    expect(chain[0]!.parentId).toBeNull();
    expect(chain.at(-1)!.id).toBe(leaf);
    expect(chain.map((node) => node.placement.transform.positionLdu[0])).toEqual([
      0, 20, 40, 60, 80,
    ]);
    expect(chain.map((node) => node.depth)).toEqual([1, 2, 3, 4, 5]);
  });

  it("reports the frontier a beam would carry", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    const left = tree.append(root.id, placement(20), RESULT).node;
    const right = tree.append(root.id, placement(40), RESULT).node;
    tree.append(left.id, placement(60), RESULT);

    expect(
      tree
        .leaves()
        .map((node) => node.id)
        .sort(),
    ).toEqual([right.id, tree.children(left.id)[0]!.id].sort());
  });

  it("names what it cannot do rather than failing silently", () => {
    const tree = new BuildTree();

    expect(() => tree.append("sha256:nope", placement(0), RESULT)).toThrowError(
      /no such node in a tree of 0/,
    );
    expect(() => tree.moveHead("sha256:nope")).toThrowError(/Backtracking moves the head/);
    expect(() => tree.chainTo("sha256:nope")).toThrowError(BuildTreeError);
  });

  it("round-trips through its log, and the log verifies itself", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    tree.append(root.id, placement(20), `${RESULT}a`);
    tree.append(root.id, placement(40), `${RESULT}b`);
    const lines = tree.nodes().map(encodeNode);

    const replayed = replayBuildTree(lines);

    expect(replayed.size).toBe(tree.size);
    for (const node of tree.nodes()) {
      expect(replayed.node(node.id)?.resultHash).toBe(node.resultHash);
      expect(replayed.node(node.id)?.parentId).toBe(node.parentId);
    }
  });

  it("catches a log line that was altered after it was written", () => {
    const tree = new BuildTree();
    const root = tree.append(null, placement(0), RESULT).node;
    tree.append(root.id, placement(20), RESULT);
    const lines = tree.nodes().map(encodeNode);
    const tampered = lines.map((line) => line.replace('"positionLdu":[20', '"positionLdu":[999'));

    expect(() => replayBuildTree(tampered)).toThrowError(
      /records id sha256:[0-9a-f]+ but its parent and placement digest to sha256:[0-9a-f]+/,
    );
  });

  it("refuses a log from a schema it does not read", () => {
    expect(() =>
      decodeNode('{"v":"lego.build-tree/99","id":"a","parent":null,"result":"b"}'),
    ).toThrowError(/declares schema lego.build-tree\/99, but this reader is lego.build-tree\/1/);
    expect(() => decodeNode("not json")).toThrowError(/is not JSON/);
  });

  it("stores a long build in kilobytes, not megabytes", () => {
    const tree = new BuildTree();
    grow(tree, 359);

    const log = tree.nodes().map(encodeNode).join("\n");
    const bytesPerStep = log.length / 359;

    expect(tree.size).toBe(359);
    // Measured at 418 bytes per node, three quarters of it the three sha256
    // hex digests. A full booklet's build is therefore 150 KB, against roughly
    // 25 MB if each step stored its whole document — which is the entire point
    // of storing deltas. The bound guards that ratio, not the exact constant.
    expect(bytesPerStep).toBeLessThan(500);
    expect(log.length).toBeLessThan(200_000);
  });
});
