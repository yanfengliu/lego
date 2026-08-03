import { LDRAW_IDENTIFIER_PROVENANCE, PROJECT_COLOR_PROVENANCE } from "./constants.ts";
import type { ColorDefinition } from "./types.ts";

import { deepFreeze } from "./freeze.ts";

const makeColor = (
  id: string,
  displayName: string,
  displayHex: `#${string}`,
  ldrawCode: number,
): ColorDefinition =>
  deepFreeze({
    id,
    displayName,
    displayHex,
    ldrawCode,
    provenance: PROJECT_COLOR_PROVENANCE,
    ldrawCodeProvenance: LDRAW_IDENTIFIER_PROVENANCE,
  });

/**
 * The palette is catalog truth: every entry is hashed into a document's pinned
 * `TruthSnapshot` and must map to a stable LDraw code so exports round-trip.
 * Entries are therefore only ever added, never renamed or renumbered, and the
 * original eight IDs keep the codes they shipped with.
 */
export const COLOR_DEFINITIONS: readonly ColorDefinition[] = deepFreeze([
  makeColor("builtin:black", "Black", "#05131D", 0),
  makeColor("builtin:blue", "Blue", "#0055BF", 1),
  makeColor("builtin:green", "Green", "#237841", 2),
  makeColor("builtin:dark-turquoise", "Dark Turquoise", "#008F9B", 3),
  makeColor("builtin:red", "Red", "#C91A09", 4),
  makeColor("builtin:dark-pink", "Dark Pink", "#C870A0", 5),
  makeColor("builtin:brown", "Brown", "#583927", 6),
  makeColor("builtin:light-gray", "Light Gray", "#9BA19D", 7),
  makeColor("builtin:dark-gray", "Dark Gray", "#6D6E5C", 8),
  makeColor("builtin:light-blue", "Light Blue", "#B4D2E3", 9),
  makeColor("builtin:bright-green", "Bright Green", "#4B9F4A", 10),
  makeColor("builtin:light-turquoise", "Light Turquoise", "#55A5AF", 11),
  makeColor("builtin:salmon", "Salmon", "#F2705E", 12),
  makeColor("builtin:pink", "Pink", "#FC97AC", 13),
  makeColor("builtin:yellow", "Yellow", "#F2CD37", 14),
  makeColor("builtin:white", "White", "#FFFFFF", 15),
  makeColor("builtin:light-green", "Light Green", "#C2DAB8", 17),
  makeColor("builtin:light-yellow", "Light Yellow", "#FBE696", 18),
  makeColor("builtin:tan", "Tan", "#E4CD9E", 19),
  makeColor("builtin:light-violet", "Light Violet", "#C9CAE2", 20),
  makeColor("builtin:purple", "Purple", "#81007B", 22),
  makeColor("builtin:orange", "Orange", "#FE8A18", 25),
  makeColor("builtin:magenta", "Magenta", "#923978", 26),
  makeColor("builtin:lime", "Lime", "#BBE90B", 27),
  makeColor("builtin:dark-tan", "Dark Tan", "#958A73", 28),
  makeColor("builtin:bright-pink", "Bright Pink", "#E4ADC8", 29),
  makeColor("builtin:reddish-brown", "Reddish Brown", "#582A12", 70),
  makeColor("builtin:light-bluish-gray", "Light Bluish Gray", "#A0A5A9", 71),
  makeColor("builtin:dark-bluish-gray", "Dark Bluish Gray", "#6C6E68", 72),
  makeColor("builtin:medium-blue", "Medium Blue", "#5A93DB", 73),
  makeColor("builtin:medium-green", "Medium Green", "#73DCA1", 74),
  makeColor("builtin:light-pink", "Light Pink", "#FECCCF", 77),
  makeColor("builtin:dark-purple", "Dark Purple", "#3F3691", 85),
  makeColor("builtin:nougat", "Nougat", "#D09168", 92),
  makeColor("builtin:dark-blue", "Dark Blue", "#0A3463", 272),
  makeColor("builtin:dark-green", "Dark Green", "#184632", 288),
  makeColor("builtin:dark-red", "Dark Red", "#720E0F", 320),
  makeColor("builtin:dark-azure", "Dark Azure", "#1498D7", 321),
  makeColor("builtin:medium-azure", "Medium Azure", "#3EC2DD", 322),
  makeColor("builtin:olive-green", "Olive Green", "#77774E", 330),
  makeColor("builtin:sand-green", "Sand Green", "#708E7C", 378),
  makeColor("builtin:sand-blue", "Sand Blue", "#70819A", 379),
  makeColor("builtin:medium-orange", "Medium Orange", "#FFA70B", 462),
  makeColor("builtin:dark-orange", "Dark Orange", "#A95500", 484),
  makeColor("builtin:very-light-gray", "Very Light Gray", "#E6E3DA", 503),
]);

export const AVAILABLE_COLOR_IDS: readonly string[] = deepFreeze(
  COLOR_DEFINITIONS.map(({ id }) => id),
);
