import { getPartDefinition, type LduBounds } from "@lego-studio/catalog";
import {
  canonicalDigest,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { validateValidationReportV1 } from "@lego-studio/protocol";
import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";
import { Box3, Group, Matrix4 } from "three";

import {
  RenderTransformError,
  lduToThreeVector,
  lduTransformToThreeMatrix,
} from "./coordinates.ts";
import {
  PLACEHOLDER_PART_BOUNDS,
  createCatalogPartGeometry,
  createPartOverlay,
  createPlaceholderGeometry,
} from "./geometry.ts";
import { disposeObjectTree } from "./lifecycle.ts";
import { assertRenderBudget } from "./limits.ts";
import type { DeriveBrickSceneOptions, DerivedBrickScene, RenderDiagnostic } from "./types.ts";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function blockingCodesByPart(report: ValidationReportV1): ReadonlyMap<string, readonly string[]> {
  const codes = new Map<string, Set<string>>();
  for (const issue of report.issues) {
    if (issue.severity !== "blocking") continue;
    for (const partId of issue.partIds) {
      const partCodes = codes.get(partId) ?? new Set<string>();
      partCodes.add(issue.code);
      codes.set(partId, partCodes);
    }
  }

  return new Map(
    [...codes].map(([partId, partCodes]) => [partId, [...partCodes].sort(compareStrings)]),
  );
}

function applyPartTransform(
  partObject: Group,
  transform: BrickDocumentV1["parts"][number]["transform"],
): void {
  const matrix = lduTransformToThreeMatrix(transform);
  matrix.decompose(partObject.position, partObject.quaternion, partObject.scale);
  partObject.updateMatrix();
}

function expandTransformedBounds(bounds: Box3, localBounds: LduBounds, matrix: Matrix4): void {
  for (const x of [localBounds.min[0], localBounds.max[0]]) {
    for (const y of [localBounds.min[1], localBounds.max[1]]) {
      for (const z of [localBounds.min[2], localBounds.max[2]]) {
        bounds.expandByPoint(lduToThreeVector([x, y, z]).applyMatrix4(matrix));
      }
    }
  }
}

export function deriveBrickScene(
  document: BrickDocumentV1,
  options: DeriveBrickSceneOptions = {},
): DerivedBrickScene {
  assertRenderBudget(document);
  const diagnostics: RenderDiagnostic[] = [];
  const documentHash = documentStructuralHash(document);
  const locallyValidatedReport = validateBrickDocument(document);
  if (options.validationReport) {
    let suppliedReport: ValidationReportV1 | undefined;
    try {
      const detachedReport: unknown = structuredClone(options.validationReport);
      if (!validateValidationReportV1(detachedReport)) {
        throw new TypeError("Validation report failed its wire schema");
      }
      suppliedReport = detachedReport;
    } catch {
      diagnostics.push({
        code: "MALFORMED_VALIDATION_REPORT",
        message: "Ignored a malformed external validation report",
        partId: null,
      });
      suppliedReport = undefined;
    }
    if (suppliedReport) {
      if (suppliedReport.targetDocumentHash !== documentHash) {
        diagnostics.push({
          code: "STALE_VALIDATION_REPORT",
          message: "Ignored a validation report for a different document hash",
          partId: null,
        });
      } else if (canonicalDigest(suppliedReport) !== canonicalDigest(locallyValidatedReport)) {
        diagnostics.push({
          code: "VALIDATION_REPORT_MISMATCH",
          message: "Ignored a validation report that disagrees with local deterministic validators",
          partId: null,
        });
      }
    }
  }
  const validationReport = locallyValidatedReport;
  const invalidCodes = blockingCodesByPart(validationReport);
  const selectedPartIds = new Set(options.selectedPartIds ?? []);
  const includeStuds = options.includeStuds ?? true;
  const root = new Group();
  root.name = `brick-document:${document.id}`;
  root.userData = {
    renderRole: "brick-document",
    schemaVersion: "lego.derived-brick-scene/1",
    documentId: document.id,
    documentHash,
    sourceOfTruth: "BrickDocument",
  };

  const partObjects = new Map<string, Group>();
  const bounds = new Box3();
  const orderedParts = document.parts
    .map((part, sourceIndex) => ({ part, sourceIndex }))
    .sort(
      (left, right) =>
        compareStrings(left.part.id, right.part.id) || left.sourceIndex - right.sourceIndex,
    );

  for (const { part } of orderedParts) {
    const definition = getPartDefinition(part.catalogPartId);
    const blockingIssueCodes = invalidCodes.get(part.id) ?? [];
    let content: Group;
    if (definition) {
      content = createCatalogPartGeometry(part, definition, includeStuds, diagnostics);
    } else {
      diagnostics.push({
        code: "UNKNOWN_CATALOG_PART",
        message: `Part ${part.id} uses unknown catalog part ${part.catalogPartId}`,
        partId: part.id,
      });
      content = createPlaceholderGeometry(part);
    }

    const partObject = new Group();
    partObject.name = `part:${part.id}`;
    partObject.add(content);
    try {
      applyPartTransform(partObject, part.transform);
    } catch (error) {
      if (!(error instanceof RenderTransformError)) throw error;
      diagnostics.push({
        code: "UNKNOWN_ORIENTATION",
        message: error.message,
        partId: part.id,
      });
      const fallbackPosition = lduToThreeVector(part.transform.positionLdu);
      const fallbackMatrix = new Matrix4().makeTranslation(...fallbackPosition.toArray());
      fallbackMatrix.decompose(partObject.position, partObject.quaternion, partObject.scale);
      partObject.updateMatrix();
    }

    partObject.userData = {
      renderRole: "part",
      partId: part.id,
      catalogPartId: part.catalogPartId,
      colorId: part.colorId,
      orientationId: part.transform.orientationId,
      placeholder: definition === undefined,
      selected: selectedPartIds.has(part.id),
      invalid: blockingIssueCodes.length > 0,
      blockingIssueCodes,
    };

    const partBounds = definition?.boundsLdu ?? PLACEHOLDER_PART_BOUNDS;
    expandTransformedBounds(bounds, partBounds, partObject.matrix);
    if (selectedPartIds.has(part.id)) {
      partObject.add(createPartOverlay(part.id, "selection-overlay", partBounds));
    }
    if (blockingIssueCodes.length > 0) {
      partObject.add(createPartOverlay(part.id, "validation-overlay", partBounds));
    }
    root.add(partObject);

    if (!partObjects.has(part.id)) {
      partObjects.set(part.id, partObject);
    } else {
      diagnostics.push({
        code: "DUPLICATE_PART_ID",
        message: `Duplicate part ID ${part.id} cannot have a unique render lookup key`,
        partId: part.id,
      });
    }
  }

  root.updateMatrixWorld(true);
  let disposed = false;

  return {
    schemaVersion: "lego.derived-brick-scene/1",
    root,
    partObjects,
    bounds,
    documentHash,
    validationReport,
    diagnostics,
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(root);
      partObjects.clear();
    },
  };
}

export function rebuildBrickScene(
  previous: DerivedBrickScene,
  document: BrickDocumentV1,
  options?: DeriveBrickSceneOptions,
): DerivedBrickScene {
  const replacement =
    options === undefined ? deriveBrickScene(document) : deriveBrickScene(document, options);
  previous.dispose();
  return replacement;
}

export function setBrickSceneSelection(
  projection: DerivedBrickScene,
  selectedPartIds: readonly string[],
): void {
  if (projection.disposed) throw new Error("Cannot update selection on a disposed brick scene");
  const selected = new Set(selectedPartIds);

  for (const [partId, partObject] of projection.partObjects) {
    for (const child of [...partObject.children]) {
      if (child.userData.renderRole === "selection-overlay") disposeObjectTree(child);
    }
    const isSelected = selected.has(partId);
    partObject.userData = { ...partObject.userData, selected: isSelected };
    if (!isSelected) continue;

    const definition = getPartDefinition(String(partObject.userData.catalogPartId));
    partObject.add(
      createPartOverlay(
        partId,
        "selection-overlay",
        definition?.boundsLdu ?? PLACEHOLDER_PART_BOUNDS,
      ),
    );
  }
  projection.root.updateMatrixWorld(true);
}
