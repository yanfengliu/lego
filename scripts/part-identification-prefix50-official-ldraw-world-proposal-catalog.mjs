import {
  snapPrefix50HalfLduPosition,
  snapPrefix50ProperWorldOrientation,
} from "./part-identification-prefix50-official-ldraw-world-proposal-math.mjs";
import {
  multiplyMatrices,
  transformPoint,
} from "./part-identification-prefix50-official-ldraw-world-proposal-parser.mjs";
import { PREFIX50_OFFICIAL_LDRAW_EXACT_IDENTITY_ALIASES } from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

function transpose(matrix) {
  return [
    matrix[0],
    matrix[3],
    matrix[6],
    matrix[1],
    matrix[4],
    matrix[7],
    matrix[2],
    matrix[5],
    matrix[8],
  ];
}

export function catalogFrame(definition, orientationById) {
  const ldrawAliases = definition.aliases
    .filter(({ namespace }) => namespace === "ldraw")
    .map(({ value }) => value);
  if (ldrawAliases.length !== 1 || !/^\d+[a-z0-9]*\.dat$/u.test(ldrawAliases[0])) {
    throw new TypeError(
      `Catalog ${definition.id} must expose exactly one numeric closed LDraw alias; received ${JSON.stringify(ldrawAliases)}.`,
    );
  }
  const geometryFrame =
    definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1"
      ? definition.geometry.assetToCatalogFrame
      : null;
  const frame =
    geometryFrame === null
      ? {
          kind: "ldraw-interchange-frame",
          orientationId: definition.ldrawFrame?.ldrawToCatalogOrientationId ?? "upright-yaw-0",
          translationLdu: [0, 0, 0],
          assetId: null,
        }
      : {
          kind: "mesh-asset-to-catalog-frame",
          orientationId: geometryFrame.orientationId,
          translationLdu: [...geometryFrame.translationLdu],
          assetId: definition.geometry.assetId,
        };
  if (
    orientationById.get(frame.orientationId) === undefined ||
    frame.translationLdu.length !== 3 ||
    frame.translationLdu.some((value) => !Number.isSafeInteger(value))
  ) {
    throw new TypeError(`Catalog ${definition.id} has an invalid exact source-to-catalog frame.`);
  }
  if (frame.assetId !== null && frame.assetId !== `ldraw:official:${ldrawAliases[0]}`) {
    throw new TypeError(
      `Catalog ${definition.id} mesh asset ${frame.assetId} disagrees with its only LDraw alias ${ldrawAliases[0]}.`,
    );
  }
  return Object.freeze({ catalogLdrawFilename: ldrawAliases[0], ...frame });
}

export function identityRelation(leaf, frame, binding) {
  if (
    binding.ldrawFilename !== leaf.ldrawFilename ||
    binding.catalogLdrawFilename !== frame.catalogLdrawFilename
  ) {
    throw new TypeError(
      `Action ${leaf.designRevision}/${leaf.ldrawFilename} does not retain its full occurrence binding to ${frame.catalogLdrawFilename}.`,
    );
  }
  if (binding.bindingKind === "identity-moved-root") {
    return Object.freeze({
      state: "projectable",
      basis: binding.identityBasis,
      occurrenceScoped: true,
      archiveIdentityProofRequired: true,
      movedRootProofId: binding.movedRootProofId,
    });
  }
  if (frame.catalogLdrawFilename === leaf.ldrawFilename) {
    return Object.freeze({
      state: "projectable",
      basis: binding.occurrenceScoped ? binding.identityBasis : "exact-catalog-ldraw-filename",
      occurrenceScoped: binding.occurrenceScoped,
      archiveIdentityProofRequired: false,
      movedRootProofId: null,
    });
  }
  const alias = PREFIX50_OFFICIAL_LDRAW_EXACT_IDENTITY_ALIASES.find(
    (row) => row.xmlDesignId === leaf.xmlDesignId && row.ldrawFilename === leaf.ldrawFilename,
  );
  if (alias !== undefined && frame.catalogLdrawFilename === `${leaf.xmlDesignId}.dat`) {
    return Object.freeze({
      state: "projectable",
      basis: "exact-closed-xml-ldraw-alias",
      occurrenceScoped: false,
      archiveIdentityProofRequired: false,
      movedRootProofId: null,
    });
  }
  throw new TypeError(
    `Action ${leaf.designRevision}/${leaf.ldrawFilename} cannot be related to catalog filename ${frame.catalogLdrawFilename} by the exact closed aliases.`,
  );
}

export function catalogWorldProposal(leaf, frame, properOrientations, orientationById) {
  const sourceToCatalog = orientationById.get(frame.orientationId).matrix;
  const catalogWorldMatrix = multiplyMatrices(leaf.ldrawWorldMatrix, transpose(sourceToCatalog));
  const orientation = snapPrefix50ProperWorldOrientation(catalogWorldMatrix, properOrientations);
  const rotatedTranslation = transformPoint(catalogWorldMatrix, frame.translationLdu);
  const rawPosition = leaf.ldrawWorldPositionLdu.map(
    (coordinate, axis) => coordinate - rotatedTranslation[axis],
  );
  const position = snapPrefix50HalfLduPosition(rawPosition);
  return Object.freeze({
    orientationId: orientation.orientationId,
    positionLdu: position.positionLdu,
    orientationResidual: orientation.residual,
    positionResidualLdu: position.residual,
  });
}

export function connectorSeatProposals(definition, proposed, orientationById) {
  if (definition.id !== "builtin:axle-1x3" || proposed === null) return Object.freeze([]);
  const worldMatrix = orientationById.get(proposed.orientationId).matrix;
  return Object.freeze(
    definition.connectors.map((connector) => {
      const originDeltaLdu = transformPoint(worldMatrix, connector.positionLdu);
      return Object.freeze({
        connectorId: connector.id,
        kind: connector.kind,
        localPositionLdu: Object.freeze([...connector.positionLdu]),
        originDeltaLdu: Object.freeze(originDeltaLdu),
        worldPositionLdu: Object.freeze(
          proposed.positionLdu.map((coordinate, axis) => coordinate + originDeltaLdu[axis]),
        ),
      });
    }),
  );
}
