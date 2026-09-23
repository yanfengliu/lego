const CLOSED_STORAGE_MESSAGE = "Later-source ledger storage is unavailable; access remains closed.";

function sanitized(error: unknown): TypeError | RangeError {
  const cause = new Error("Underlying later-source storage details were withheld.");
  if (error instanceof RangeError) return new RangeError(error.message, { cause });
  if (error instanceof TypeError) return new TypeError(error.message, { cause });
  return new TypeError(CLOSED_STORAGE_MESSAGE, { cause });
}

export function runRealBuildPrefix50Step44LaterSourceLedgerClosed<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    throw sanitized(error);
  }
}

export async function runRealBuildPrefix50Step44LaterSourceLedgerClosedAsync<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw sanitized(error);
  }
}
