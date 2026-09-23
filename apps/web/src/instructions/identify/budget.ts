/**
 * The run's time limit. Work is checked against it between pages, regions,
 * drawings and assignment nodes, and every pdf.js call is raced against the time
 * left, so a hostile PDF stops the run at its limit rather than holding it.
 */
export interface Budget {
  /** Throws when the run is past its limit, naming where it stopped. */
  check(where: string): void;
  /** Resolves with `work`, or rejects once the time left runs out. */
  race<T>(work: Promise<T>, where: string): Promise<T>;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export function timeBudget(limitMs: number, now: () => number): Budget {
  const started = now();
  const deadline = started + limitMs;
  const overrun = (where: string): Error =>
    new Error(
      `identifyBooklet stopped at ${where}: the run has taken ${seconds(now() - started)} s, over its ${seconds(limitMs)} s limit (timeLimitMs). A booklet this module can read finishes far inside it; if this one is genuine and the machine is slow, raise timeLimitMs.`,
    );
  const check = (where: string): void => {
    if (now() > deadline) throw overrun(where);
  };
  return {
    check,
    async race<T>(work: Promise<T>, where: string): Promise<T> {
      check(where);
      // The race can settle first; a later rejection of the work must not go unhandled.
      work.catch(() => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      const expiry = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(overrun(where)), Math.max(0, deadline - now()));
      });
      try {
        return await Promise.race([work, expiry]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** No limit: for callers that run already-collected pictures, such as tests. */
export const UNLIMITED: Budget = Object.freeze({
  check: () => {},
  race: <T>(work: Promise<T>) => work,
});
