import type { ConnectorOrientationId, LduVector3 } from "./types.ts";

export type ConnectorAxisName = "x" | "y" | "z";

export interface ConnectorAxisFrame {
  readonly axis: ConnectorAxisName;
  readonly axisIndex: 0 | 1 | 2;
  readonly sign: -1 | 1;
  readonly orientationId: ConnectorOrientationId;
}

const AXIS_FRAMES: readonly (ConnectorAxisFrame & { readonly normal: LduVector3 })[] = [
  { axis: "x", axisIndex: 0, sign: -1, orientationId: "connector-x-negative", normal: [-1, 0, 0] },
  { axis: "x", axisIndex: 0, sign: 1, orientationId: "connector-x-positive", normal: [1, 0, 0] },
  { axis: "y", axisIndex: 1, sign: -1, orientationId: "connector-up", normal: [0, -1, 0] },
  { axis: "y", axisIndex: 1, sign: 1, orientationId: "connector-down", normal: [0, 1, 0] },
  { axis: "z", axisIndex: 2, sign: -1, orientationId: "connector-z-negative", normal: [0, 0, -1] },
  { axis: "z", axisIndex: 2, sign: 1, orientationId: "connector-z-positive", normal: [0, 0, 1] },
];

export function connectorAxisFrame(normal: LduVector3): ConnectorAxisFrame | undefined {
  return AXIS_FRAMES.find(({ normal: expected }) =>
    expected.every((coordinate, index) => coordinate === normal[index]),
  );
}
