import type { PartBlueprint } from "./part-blueprint-types.ts";

import { SET_6651557_PART_BLUEPRINTS } from "./part-blueprints-6651557.ts";
import { RECTILINEAR_PART_BLUEPRINTS } from "./part-blueprints-rectilinear.ts";
import { SPECIAL_PART_BLUEPRINTS } from "./part-blueprints-special.ts";

export const PART_BLUEPRINTS = [
  ...RECTILINEAR_PART_BLUEPRINTS,
  ...SPECIAL_PART_BLUEPRINTS,
  ...SET_6651557_PART_BLUEPRINTS,
] as const satisfies readonly PartBlueprint[];
