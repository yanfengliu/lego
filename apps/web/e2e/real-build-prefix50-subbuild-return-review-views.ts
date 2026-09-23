import { deepFreeze } from "@lego-studio/brick-kernel";
import type { CanonicalViewName } from "@lego-studio/rendering";

export const REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS = deepFreeze([
  {
    fixtureKey: "canonicalIsometric",
    reviewedView: "canonical-isometric",
    canonicalViewName: "isometric",
  },
  {
    fixtureKey: "frontOrthographic",
    reviewedView: "front-orthographic",
    canonicalViewName: "front",
  },
  {
    fixtureKey: "backOrthographic",
    reviewedView: "back-orthographic",
    canonicalViewName: "back",
  },
  {
    fixtureKey: "leftOrthographic",
    reviewedView: "left-orthographic",
    canonicalViewName: "left",
  },
  {
    fixtureKey: "rightOrthographic",
    reviewedView: "right-orthographic",
    canonicalViewName: "right",
  },
  {
    fixtureKey: "topOrthographic",
    reviewedView: "top-orthographic",
    canonicalViewName: "top",
  },
  {
    fixtureKey: "undersideOrthographic",
    reviewedView: "underside-orthographic",
    canonicalViewName: "underside",
  },
] as const satisfies readonly {
  readonly fixtureKey: string;
  readonly reviewedView: string;
  readonly canonicalViewName: CanonicalViewName;
}[]);

export type RealBuildPrefix50Step44ReviewFixtureKey =
  (typeof REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS)[number]["fixtureKey"];

export type RealBuildPrefix50Step44ReviewedRenderView =
  (typeof REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS)[number]["reviewedView"];

export const REAL_BUILD_PREFIX50_STEP44_CANONICAL_VIEW_NAMES = deepFreeze(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(({ canonicalViewName }) => canonicalViewName),
);
