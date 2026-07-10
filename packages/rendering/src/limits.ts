import { getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

export const RENDER_LIMITS = Object.freeze({
  maxParts: 1_000,
  maxCollisionPrimitives: 8_000,
});

export class RenderBudgetError extends Error {
  readonly code = "RENDER_BUDGET_EXCEEDED" as const;

  constructor(message: string) {
    super(message);
    this.name = "RenderBudgetError";
  }
}

/** Rejects oversized documents before hashing, validation, or Three.js allocation. */
export function assertRenderBudget(document: Pick<BrickDocumentV1, "parts">): void {
  if (document.parts.length > RENDER_LIMITS.maxParts) {
    throw new RenderBudgetError(
      `Document has ${document.parts.length} parts; renderer limit is ${RENDER_LIMITS.maxParts}`,
    );
  }

  let primitiveCount = 0;
  for (const part of document.parts) {
    primitiveCount += getPartDefinition(part.catalogPartId)?.collision.primitives.length ?? 1;
    if (primitiveCount > RENDER_LIMITS.maxCollisionPrimitives) {
      throw new RenderBudgetError(
        `Document requires more than ${RENDER_LIMITS.maxCollisionPrimitives} render primitives`,
      );
    }
  }
}
