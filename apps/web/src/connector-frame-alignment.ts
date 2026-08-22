import { connectorPairRule, type ConnectorKind, type LduVector3 } from "@lego-studio/catalog";

export interface DirectionalConnectorFrame {
  readonly kind: ConnectorKind;
  readonly normal: LduVector3;
}

/** Applies the catalog pair rule to two connector directions in one frame. */
export function connectorAxesAlign(
  left: DirectionalConnectorFrame,
  right: DirectionalConnectorFrame,
): boolean {
  const pair = connectorPairRule(left.kind, right.kind);
  if (pair === undefined) return false;

  const same = left.normal.every((coordinate, axis) => coordinate === right.normal[axis]);
  const opposed = left.normal.every((coordinate, axis) => coordinate === -right.normal[axis]!);
  return pair.axisMatching === "collinear" ? same || opposed : opposed;
}
