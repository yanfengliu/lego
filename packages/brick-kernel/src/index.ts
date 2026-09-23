export const BRICK_KERNEL_VERSION = "lego.brick-kernel/1" as const;

export * from "./assemblies.ts";
export * from "./compound-bodies.ts";
export * from "./build-comparison.ts";
export * from "./build-playback-trace.ts";
export * from "./build-sequence.ts";
export * from "./canonical.ts";
export {
  COLLISION_WORLD_WORK_KEYS,
  createCollisionWorld,
  findCatalogCollisions,
  type CollisionFinding,
  type CollisionWorld,
  type CollisionWorldWork,
  type CollisionWorldWorkObserver,
} from "./collisions.ts";
export * from "./compiler-candidate.ts";
export {
  BUILD_PROGRAM_COMPILER_MANIFEST,
  BUILD_PROGRAM_COMPILER_VERSION,
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  compileBuildProgram,
  type CompilationContext,
  type CompilationFailure,
  type CompilationIssue,
  type CompilationIssueCode,
  type CompilationResult,
  type CompilationSuccess,
} from "./compiler.ts";
export * from "./document.ts";
export * from "./factory.ts";
export * from "./ldraw.ts";
export * from "./migration.ts";
export * from "./normalization.ts";
export * from "./operations.ts";
export * from "./patch-diff.ts";
export * from "./patch-verification.ts";
export * from "./template-admission.ts";
export { isBoundedDataOnlyJson, type DataOnlyJsonLimits } from "./template-admission-input.ts";
export * from "./transforms.ts";
export * from "./truth-manifests.ts";
export * from "./validation.ts";
