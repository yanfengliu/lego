import { STUD_PITCH_LDU, type LduVector3 } from "@lego-studio/catalog";

export const LATERAL_SNAP_LDU = STUD_PITCH_LDU / 2;

export interface LduBox {
  readonly min: LduVector3;
  readonly max: LduVector3;
}
