import assert from "node:assert/strict";

const minimumNodeMajor = 24;
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);

assert.ok(
  Number.isInteger(nodeMajor) && nodeMajor >= minimumNodeMajor,
  `Shared TypeScript packages require Node ${minimumNodeMajor} or newer; found ${process.versions.node}`,
);

const protocol = await import("@lego-studio/protocol");
assert.equal(protocol.PROTOCOL_VERSION, "lego.protocol/1");
assert.equal(
  protocol.validateRigidTransform({
    positionLdu: [0, 0, 0],
    orientationId: "upright-yaw-0",
  }),
  true,
  "The generated Ajv validator must load and accept a valid transform",
);
assert.equal(
  protocol.validateRigidTransform({
    positionLdu: [0.5, 0, 0],
    orientationId: "upright-yaw-0",
  }),
  false,
  "The generated Ajv validator must enforce integer LDU coordinates",
);
assert.equal(
  protocol.validateTemplateSnapshotV1({}),
  false,
  "The TemplateSnapshot standalone and semantic validator must load under Node",
);
assert.equal(
  typeof protocol.templateSnapshotContentHash,
  "function",
  "The canonical TemplateSnapshot hash helper must load under Node",
);

const catalog = await import("@lego-studio/catalog");
assert.ok(catalog.PART_DEFINITIONS.length > 0, "The built-in catalog must load under Node");
assert.ok(catalog.getPartDefinition("builtin:brick-1x1"));

const kernel = await import("@lego-studio/brick-kernel");
assert.equal(
  typeof kernel.validateTemplateSnapshotAgainstTruth,
  "function",
  "The truth-bound TemplateSnapshot admission gate must load under Node",
);
assert.match(
  kernel.TEMPLATE_ADMISSION_SNAPSHOT_HASH,
  /^sha256:[0-9a-f]{64}$/,
  "The TemplateSnapshot admission policy must expose its pinned hash under Node",
);
assert.equal(kernel.BRICK_KERNEL_VERSION, "lego.brick-kernel/1");
const emptyDocument = kernel.createEmptyBrickDocument({
  id: "node-consumer-contract",
  name: "Node consumer contract",
});
assert.match(kernel.documentStructuralHash(emptyDocument), /^sha256:[0-9a-f]{64}$/);

const rendering = await import("@lego-studio/rendering");
const projection = rendering.deriveBrickScene(emptyDocument);
assert.equal(rendering.createCanonicalViewPacket(projection).views.length, 7);
projection.dispose();

const generation = await import("@lego-studio/generation");
assert.equal(generation.GENERATION_VERSION, "lego.generation/1");
assert.match(
  generation.RANKING_POLICY_HASH,
  /^sha256:[0-9a-f]{64}$/,
  "The deterministic maker must expose its pinned ranking-policy hash under Node",
);
assert.equal(
  typeof generation.runDeterministicMakerPopulation,
  "function",
  "The bounded deterministic maker population must load under Node",
);

console.log(
  `Node consumer contract passed on Node ${process.versions.node}: protocol, catalog, brick-kernel, generation, rendering`,
);
