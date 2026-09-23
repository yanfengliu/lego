import type {
  MeasuredClutchPortSemanticRow,
  MeasuredPartBlueprint,
} from "./measured-part-types.ts";

const CLUTCH_PORT_ID = /^undersideClutch:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/u;

function fail(blueprint: MeasuredPartBlueprint, message: string): never {
  throw new Error(`Measured part ${blueprint.designId} (${blueprint.ldrawId}) ${message}`);
}

/** Validate generated stable clutch ids before the measured factory uses them. */
export function compileMeasuredClutchPortSemantics(
  blueprint: MeasuredPartBlueprint,
): readonly MeasuredClutchPortSemanticRow[] | undefined {
  const rows = blueprint.clutchPortSemantics;
  if (rows === undefined) return undefined;
  if (blueprint.clutchSharedCapacityGroupIds !== undefined) {
    fail(
      blueprint,
      "declares both stable clutch semantics and legacy clutch shared-capacity rows; one declaration must own each measured seat's identity and capacity claims.",
    );
  }
  if (!Array.isArray(rows) || rows.length !== blueprint.clutchesLdu.length) {
    fail(
      blueprint,
      `declares ${Array.isArray(rows) ? rows.length : "a non-array set of"} stable clutch semantic rows for ${blueprint.clutchesLdu.length} underside clutches; generated rows must stay aligned one-for-one with the exact measured source seats.`,
    );
  }

  const compiled: MeasuredClutchPortSemanticRow[] = [];
  const ids = new Set<string>();
  rows.forEach((unsafeRow, index) => {
    if (unsafeRow === null || typeof unsafeRow !== "object") {
      fail(blueprint, `stable clutch semantic row ${index} is not an object.`);
    }
    const row = unsafeRow as Partial<MeasuredClutchPortSemanticRow>;
    const position = row.positionLdu;
    const expectedPosition = blueprint.clutchesLdu[index]!;
    if (
      !Array.isArray(position) ||
      position.length !== 3 ||
      !position.every(Number.isSafeInteger) ||
      position.some((coordinate, axis) => coordinate !== expectedPosition[axis])
    ) {
      fail(
        blueprint,
        `stable clutch semantic row ${index} witnesses positionLdu ${JSON.stringify(position)} but exact measured source seat ${index} is [${expectedPosition.join(", ")}]; rows must preserve source-sorted position and identity together.`,
      );
    }
    if (typeof row.id !== "string" || !CLUTCH_PORT_ID.test(row.id)) {
      fail(
        blueprint,
        `stable clutch semantic row ${index} names id ${JSON.stringify(row.id)}; require undersideClutch:<non-empty colon-separated token>.`,
      );
    }
    if (ids.has(row.id)) {
      fail(blueprint, `stable clutch semantic row ${index} repeats connector id ${row.id}.`);
    }
    ids.add(row.id);

    const groups = row.sharedCapacityGroupIds;
    if (
      groups !== undefined &&
      (!Array.isArray(groups) ||
        groups.length === 0 ||
        new Set(groups).size !== groups.length ||
        groups.some((group) => typeof group !== "string" || group.trim().length === 0))
    ) {
      fail(
        blueprint,
        `stable clutch semantic row ${index} has sharedCapacityGroupIds ${JSON.stringify(groups)}; when present they must be non-empty unique text.`,
      );
    }
    compiled.push({
      positionLdu: [position[0], position[1], position[2]],
      id: row.id,
      ...(groups === undefined ? {} : { sharedCapacityGroupIds: groups }),
    });
  });
  return compiled;
}
