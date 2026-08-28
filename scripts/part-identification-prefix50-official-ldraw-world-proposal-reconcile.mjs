import { isDeepStrictEqual } from "node:util";

import {
  PREFIX50_OFFICIAL_LDRAW_COLOR_BINDINGS,
  PREFIX50_OFFICIAL_LDRAW_EXACT_IDENTITY_ALIASES,
  PREFIX50_OFFICIAL_LDRAW_LOCAL_INVARIANCE_TOLERANCE,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

function compareRows(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new TypeError(`${label} drifted: received ${JSON.stringify(actual)}.`);
  }
}

export function reconcilePrefix50OfficialLeaves(leaves) {
  const colors = new Map();
  const aliases = new Map();
  const groups = new Map();
  for (const leaf of leaves) {
    const colorKey = `${leaf.xmlMaterialId}|${leaf.ldrawColorCode}`;
    colors.set(colorKey, (colors.get(colorKey) ?? 0) + 1);
    if (`${leaf.xmlDesignId}.dat` !== leaf.ldrawFilename) {
      const aliasKey = `${leaf.xmlDesignId}|${leaf.ldrawFilename}`;
      aliases.set(aliasKey, (aliases.get(aliasKey) ?? 0) + 1);
    }
    const groupKey = `${leaf.designRevision}|${leaf.ldrawFilename}`;
    const members = groups.get(groupKey) ?? [];
    members.push(leaf);
    groups.set(groupKey, members);
  }
  const colorBindings = [...colors]
    .map(([key, count]) => {
      const [xmlMaterialId, ldrawColorCode] = key.split("|");
      return { xmlMaterialId, ldrawColorCode: Number(ldrawColorCode), count };
    })
    .sort((left, right) => Number(left.xmlMaterialId) - Number(right.xmlMaterialId));
  const exactIdentityAliases = [...aliases]
    .map(([key, count]) => {
      const [xmlDesignId, ldrawFilename] = key.split("|");
      return { xmlDesignId, ldrawFilename, count };
    })
    .sort((left, right) => left.xmlDesignId.localeCompare(right.xmlDesignId));
  compareRows(
    colorBindings,
    PREFIX50_OFFICIAL_LDRAW_COLOR_BINDINGS,
    "Official XML/LDraw color bindings",
  );
  compareRows(
    exactIdentityAliases,
    PREFIX50_OFFICIAL_LDRAW_EXACT_IDENTITY_ALIASES,
    "Official XML/LDraw exact identity aliases",
  );
  let maximumRepeatedMatrixDeviation = 0;
  let maximumRepeatedTranslationDeviationLdu = 0;
  const localTransformGroups = [...groups]
    .map(([key, members]) => {
      const first = members[0];
      const maximumMatrixDeviation = Math.max(
        0,
        ...members.flatMap((member) =>
          member.localMatrix.map((value, index) => Math.abs(value - first.localMatrix[index])),
        ),
      );
      const maximumTranslationDeviationLdu = Math.max(
        0,
        ...members.flatMap((member) =>
          member.localTranslationLdu.map((value, index) =>
            Math.abs(value - first.localTranslationLdu[index]),
          ),
        ),
      );
      maximumRepeatedMatrixDeviation = Math.max(
        maximumRepeatedMatrixDeviation,
        maximumMatrixDeviation,
      );
      maximumRepeatedTranslationDeviationLdu = Math.max(
        maximumRepeatedTranslationDeviationLdu,
        maximumTranslationDeviationLdu,
      );
      if (
        maximumMatrixDeviation > PREFIX50_OFFICIAL_LDRAW_LOCAL_INVARIANCE_TOLERANCE ||
        maximumTranslationDeviationLdu > PREFIX50_OFFICIAL_LDRAW_LOCAL_INVARIANCE_TOLERANCE
      ) {
        throw new TypeError(
          `Official XML/LDraw local transform ${key} is not invariant within ${PREFIX50_OFFICIAL_LDRAW_LOCAL_INVARIANCE_TOLERANCE}: matrix ${maximumMatrixDeviation}, translation ${maximumTranslationDeviationLdu}.`,
        );
      }
      const separator = key.lastIndexOf("|");
      return Object.freeze({
        designRevision: key.slice(0, separator),
        ldrawFilename: key.slice(separator + 1),
        occurrences: members.length,
        localMatrix: first.localMatrix,
        localTranslationLdu: first.localTranslationLdu,
        maximumMatrixDeviation,
        maximumTranslationDeviationLdu,
      });
    })
    .sort(
      (left, right) =>
        left.designRevision.localeCompare(right.designRevision) ||
        left.ldrawFilename.localeCompare(right.ldrawFilename),
    );
  return Object.freeze({
    leaves: Object.freeze(leaves),
    leafByBrickRef: new Map(
      leaves.filter((leaf) => leaf.xmlPartRow === 1).map((leaf) => [leaf.brickRef, leaf]),
    ),
    colorBindings: Object.freeze(colorBindings),
    exactIdentityAliases: Object.freeze(exactIdentityAliases),
    localTransformGroups: Object.freeze(localTransformGroups),
    measurements: Object.freeze({
      maximumRepeatedMatrixDeviation,
      maximumRepeatedTranslationDeviationLdu,
    }),
  });
}
