import type { LduVector3, PartDefinition, SourceProvenance } from "./types.ts";

import { deepFreeze } from "./freeze.ts";
import {
  LDRAW_INTERCHANGE_FRAME_ARCHIVE,
  LDRAW_INTERCHANGE_FRAME_ROWS,
} from "./ldraw-interchange-frames.generated.ts";

/**
 * The LDraw-to-catalog frame of every parametric part, as catalog truth.
 *
 * A frame is the quarter turn O and whole-LDU offset t with
 * catalog = O * ldraw + t, where t is the catalog-local point the LDraw
 * origin lands on. A 2 x 4 plate is `upright-yaw-90` with [0, -4, 0]: LDraw
 * runs its long side along x and puts the origin on the top face, the catalog
 * runs it along z and puts the origin at the body centre. A mesh-backed part's
 * frame is its `assetToCatalogFrame`; these rows cover the parts drawn from
 * parameters, whose frame nothing else records.
 *
 * Every row is measured by scripts/derive-ldraw-catalog-frames.mjs from the
 * byte-pinned official LDraw archive (the file's extent and stud primitives,
 * matched to the catalog part), so it is a fact about the file, attributed to
 * its author, with no geometry bundled. Two rows are a reviewed choice
 * between measured candidates; `basis` says which.
 */
export interface LdrawInterchangeFrameRow {
  readonly ldrawId: string;
  readonly orientationId: string;
  readonly translationLdu: LduVector3;
  readonly basis: "derived" | "reviewed-choice";
  /** Candidate frames the extent and studs leave; equivalent when derived. */
  readonly candidates: number;
  readonly rootSha256: `sha256:${string}`;
  readonly rootBytes: number;
  readonly closureFileCount: number;
  readonly title: string;
  readonly author: string;
  readonly ldrawOrg: string;
  readonly licenseExpression: string;
}

export type LdrawInterchangeFrame = NonNullable<PartDefinition["ldrawFrame"]>;

function provenanceFor(row: LdrawInterchangeFrameRow): SourceProvenance {
  return {
    sourceId: `ldraw:official:${row.ldrawId}`,
    sourceType: "interoperability-mapping",
    sourceVersion: `${LDRAW_INTERCHANGE_FRAME_ARCHIVE.logicalName} ${LDRAW_INTERCHANGE_FRAME_ARCHIVE.sha256}; ${row.ldrawOrg}; root ${row.rootSha256}`,
    licenseExpression: row.licenseExpression,
    attribution: `${row.ldrawId} ("${row.title}") authored by ${row.author} for LDraw.org; frame ${row.basis === "derived" ? "measured" : "chosen by review among measured candidates"} by scripts/derive-ldraw-catalog-frames.mjs without bundling geometry.`,
    runtimeRole: "interchange-frame-measurement",
    redistributionAllowed: true,
    trainingUseAllowed: false,
    externalGeometryBundled: false,
  };
}

const FRAMES_BY_LDRAW_ID: ReadonlyMap<string, LdrawInterchangeFrame> = new Map(
  LDRAW_INTERCHANGE_FRAME_ROWS.map((row) => [
    row.ldrawId,
    deepFreeze({
      ldrawToCatalogOrientationId: row.orientationId,
      translationLdu: [...row.translationLdu] as unknown as LduVector3,
      provenance: provenanceFor(row),
    }),
  ]),
);

/** The measured frame for a parametric part's LDraw file, or undefined when none is recorded. */
export function ldrawInterchangeFrameFor(ldrawId: string): LdrawInterchangeFrame | undefined {
  return FRAMES_BY_LDRAW_ID.get(ldrawId);
}
