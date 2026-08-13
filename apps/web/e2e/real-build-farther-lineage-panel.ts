import {
  emptyLineagedFartherCarryEvidence,
  emptyLineagedFartherPanelEvidence,
  lineagedFartherRefusal,
} from "./real-build-farther-lineage-empty-evidence";
import type {
  FirstLineagedRevealingPanelAuthority,
  FirstLineagedRevealingPanelResult,
  LineagedFartherCarryAuthority,
  LineagedFartherCarryResult,
  LineagedFartherOriginAuthority,
  LineagedFartherOriginResult,
} from "./real-build-farther-panel-types";

const ORIGIN_MESSAGE =
  "Lineaged farther origin requires a nonforgeable prepared-step/search/ledger authority bound to exact immutable document bytes; direct candidate input is inspection-only.";
const CARRY_MESSAGE =
  "Lineaged farther carry requires an exact branded frontier plus a bounded prepared-step/search/ledger batch compiled through automatic placement authority; caller counts and transitions cannot advance execution.";
const PANEL_MESSAGE =
  "Lineaged farther panel selection requires an exact branded frontier plus trusted PDF/crop/render measurement or negative-observation authority; public camera evidence is inspection-only.";

/**
 * No authority producer exists yet. Even a caller cast to the opaque type is refused without
 * inspecting it, so getters, reconstructed cursors, and fabricated provenance remain inert.
 */
export function createLineagedFartherOriginFrontier<D>(
  ..._unavailable: readonly [LineagedFartherOriginAuthority<D>]
): LineagedFartherOriginResult<D> {
  void _unavailable;
  return Object.freeze({
    frontier: null,
    refusal: lineagedFartherRefusal("farther-input-invalid", "input", 0, ORIGIN_MESSAGE),
  });
}

export function carryLineagedFartherFrontier<D>(
  ..._unavailable: readonly [LineagedFartherCarryAuthority<D>]
): LineagedFartherCarryResult<D> {
  void _unavailable;
  return Object.freeze({
    frontier: null,
    refusal: lineagedFartherRefusal("farther-input-invalid", "input", 0, CARRY_MESSAGE),
    evidence: emptyLineagedFartherCarryEvidence(),
  });
}

export function findFirstLineagedRevealingPanel<D>(
  ..._unavailable: readonly [FirstLineagedRevealingPanelAuthority<D>]
): FirstLineagedRevealingPanelResult<D> {
  void _unavailable;
  return Object.freeze({
    decision: null,
    refusal: lineagedFartherRefusal("farther-input-invalid", "input", 0, PANEL_MESSAGE),
    frontier: null,
    evidence: emptyLineagedFartherPanelEvidence(),
  });
}
