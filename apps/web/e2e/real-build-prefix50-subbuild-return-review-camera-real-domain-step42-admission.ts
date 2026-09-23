import { getPartDefinition } from "@lego-studio/catalog";
import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import {
  readRealBuildPrefix50Step42SourceGeometryReceipt,
  type RealBuildPrefix50Step42SourceGeometryReceipt,
} from "./real-build-prefix50-projection-step42.ts";
import {
  REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING,
  REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts";

export interface RealBuildPrefix50Step42SourceGeometryAdmission {
  readonly __opaqueStep42SourceGeometryAdmission: never;
}

const sourceGeometryAdmissions = new WeakMap<
  object,
  RealBuildPrefix50Step42SourceGeometryReceipt
>();

export function admitRealBuildPrefix50Step42SourceGeometry(
  unsafeReader: unknown,
): RealBuildPrefix50Step42SourceGeometryAdmission {
  const receipt = readRealBuildPrefix50Step42SourceGeometryReceipt(unsafeReader);
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step42-source-geometry-admission/2" ||
    receipt.admittedBindingCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT ||
    receipt.verifierManifestCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.verifierManifestCommitment ||
    receipt.semanticGeometryCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT ||
    receipt.admittedBinding.semanticGeometryCommitment !==
      REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT ||
    canonicalDigest(receipt.admittedBinding) !== receipt.admittedBindingCommitment
  )
    throw new TypeError(
      "Step-42 source geometry admission must reproduce the exact verifier manifest, semantic geometry, and binding commitments.",
    );
  const admission = Object.freeze({}) as RealBuildPrefix50Step42SourceGeometryAdmission;
  sourceGeometryAdmissions.set(admission, receipt);
  return admission;
}

export function requireRealBuildPrefix50Step42SourceGeometryAdmission(
  value: unknown,
): RealBuildPrefix50Step42SourceGeometryReceipt {
  const receipt =
    typeof value === "object" && value !== null ? sourceGeometryAdmissions.get(value) : undefined;
  if (receipt === undefined)
    throw new TypeError(
      "Step-42 source geometry requires the process-local opaque admission minted from the real verifier receipt; copied binding literals carry no geometry authority.",
    );
  return receipt;
}

export function deriveRealBuildPrefix50Step42LocalTopology(
  admission: RealBuildPrefix50Step42SourceGeometryAdmission,
) {
  const receipt = requireRealBuildPrefix50Step42SourceGeometryAdmission(admission);
  const spatialRows = [...receipt.admittedBinding.members].sort(
    (left, right) =>
      right.catalogWorldTransform.positionLdu[0] - left.catalogWorldTransform.positionLdu[0],
  );
  const topology = spatialRows.map((row) => {
    const part = getPartDefinition(row.catalogPartId);
    if (part === undefined)
      throw new TypeError(
        `Step-42 source-geometry identity ${row.catalogPartId} is absent from catalog.`,
      );
    const topStuds = part.connectors.filter(
      ({ kind, normal }) =>
        kind === "stud" && normal[0] === 0 && normal[1] === -1 && normal[2] === 0,
    );
    const expectedLength =
      row.officialDesignId === "6636" ? 6 : row.officialDesignId === "3710" ? 4 : 2;
    const expectedStuds = row.officialDesignId === "3710" ? 4 : 0;
    if (
      part.dimensions.widthStuds !== 1 ||
      part.dimensions.lengthStuds !== expectedLength ||
      part.dimensions.widthLdu !== 20 ||
      part.dimensions.lengthLdu !== expectedLength * 20 ||
      topStuds.length !== expectedStuds
    )
      throw new TypeError(
        `Step-42 ${row.officialDesignId}/${row.catalogPartId} lost its exact 1x${expectedLength} local topology or ${expectedStuds}-stud top.`,
      );
    return {
      occurrenceOrdinal: row.occurrenceOrdinal,
      officialDesignId: row.officialDesignId,
      catalogPartId: row.catalogPartId,
      catalogWorldTransform: row.catalogWorldTransform,
      lengthStuds: expectedLength,
      topStudCount: expectedStuds,
    };
  });
  if (
    canonicalDigest(topology.map(({ occurrenceOrdinal }) => occurrenceOrdinal)) !==
    canonicalDigest([274, 276, 275])
  )
    throw new TypeError(
      "Step-42 source-geometry X positions do not uniquely order 6636 -> 3710 -> 3069.",
    );
  return deepFreeze({
    sourceGeometryBindingCommitment: receipt.admittedBindingCommitment,
    semanticGeometryCommitment: receipt.semanticGeometryCommitment,
    verifierManifestCommitment: receipt.verifierManifestCommitment,
    spatialRows: topology,
    spatialLengthRoster: topology.map(({ lengthStuds }) => lengthStuds),
    totalLengthStuds: topology.reduce((sum, { lengthStuds }) => sum + lengthStuds, 0),
    middleStudCount: topology[1]!.topStudCount,
    commitment: canonicalDigest(topology),
  });
}
