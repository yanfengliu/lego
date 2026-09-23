import type { LatticeHand, PanelFace } from "../src/assembly/panel-face.ts";

export type RealBuildPrefix50Step42QuarterTurn = 0 | 1 | 2 | 3;
export type RealBuildPrefix50Step42SourceBranchKey =
  `face:${PanelFace}/hand:${LatticeHand}/turn:${RealBuildPrefix50Step42QuarterTurn}`;
