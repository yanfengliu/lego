export interface RealBuildPrefix50Step44OneShotGate {
  claim(capability: object): void;
}

export function createRealBuildPrefix50Step44OneShotGate(
  replayMessage: string,
): RealBuildPrefix50Step44OneShotGate {
  const consumed = new WeakSet<object>();
  return Object.freeze({
    claim(capability: object): void {
      if (consumed.has(capability)) throw new TypeError(replayMessage);
      consumed.add(capability);
    },
  });
}
