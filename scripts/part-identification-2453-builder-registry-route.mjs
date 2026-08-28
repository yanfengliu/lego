import { isDeepStrictEqual } from "node:util";

import {
  adjudicateBuilder2453Identity,
  verifyBuilder2453IdentityArtifact,
} from "./part-identification-2453-builder-identity.mjs";
import {
  BUILDER_2453_IDENTITY_AUTHORITY,
  CURRENT_BUILDER_2453_IDENTITY_PINS,
} from "./part-identification-2453-builder-identity-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const CONSUMED_DIAGNOSTIC_ROUTES = new WeakSet();

const expectedRoutePin = (route) => ({
  routeId: route.routeId,
  itemNo: CURRENT_BUILDER_2453_IDENTITY_PINS.builderScope.itemNo,
  exactLdrawId: route.exactLdrawId,
  builderToCatalogLocalMatrix: route.localPartFrame.matrix,
  builderToCatalogLocalTranslationLdu: route.localPartFrame.translationLdu,
  proofDigest: CURRENT_BUILDER_2453_IDENTITY_PINS.expectedArtifact.digest,
});

/**
 * Consumes only the in-memory capability minted by the exact evidence compiler.
 * There is deliberately no artifact/path/request parameter for a caller to shape.
 */
export async function consumeBuilder2453DiagnosticRegistryRoute(token) {
  const pins = CURRENT_BUILDER_2453_IDENTITY_PINS;
  const route = adjudicateBuilder2453Identity(token, {
    designRevision: pins.builderScope.designRevision,
    itemNo: pins.builderScope.itemNo,
  });
  const sourceModule = await importRepositoryTypeScript(
    moduleUrl("../apps/web/e2e/real-build-builder-source-pins-m.ts"),
  );
  const rows = sourceModule.BUILDER_PREFIX50_DESIGN_SOURCES_M;
  const source = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
  if (
    source?.designRevision !== pins.builderScope.designRevision ||
    source.catalogPartId !== route.catalogPartId ||
    !isDeepStrictEqual(source.opaqueIdentityRoute, expectedRoutePin(route)) ||
    !isDeepStrictEqual(route.localPartFrame.translationLdu, [0, 60, 0]) ||
    !isDeepStrictEqual(source.ldrawToCatalogLocalTransform, {
      positionLdu: [0, -60, 0],
      orientationId: "upright-yaw-0",
    })
  ) {
    throw new Error(
      "The module-owned 2453;I diagnostic source row does not reproduce its exact opaque 6595205-to-2453b local route.",
    );
  }
  if (
    route.authority !== BUILDER_2453_IDENTITY_AUTHORITY ||
    route.authority.action ||
    route.authority.placement ||
    route.authority.documentMutation ||
    route.authority.replay ||
    route.authority.acceptance ||
    route.authority.completion
  ) {
    throw new Error("The 2453 diagnostic registry route attempted to widen downstream authority.");
  }
  const consumed = Object.freeze({ route, source });
  CONSUMED_DIAGNOSTIC_ROUTES.add(consumed);
  return consumed;
}

/** Only this module can attest that a returned route crossed the opaque-token consumer. */
export function isConsumedBuilder2453DiagnosticRegistryRoute(value) {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    CONSUMED_DIAGNOSTIC_ROUTES.has(value)
  );
}

/** Parsed proof bytes remain useful for verification but can never mint the route capability. */
export function verifyBuilder2453RegistryProofBytes(bytes) {
  return verifyBuilder2453IdentityArtifact(bytes);
}
