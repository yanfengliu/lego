import { publishRealBuildViteShutdownUnconfirmed } from "./real-build-vite-shutdown-preservation.ts";

export interface ClosableViteServer {
  listen(): Promise<unknown>;
  close(): Promise<unknown>;
}

/** Starts a Vite server or closes the partially started resource before rejecting. */
export async function listenWithCloseOnFailure(
  server: ClosableViteServer,
  options: Readonly<{ environment?: NodeJS.ProcessEnv }> = {},
): Promise<() => Promise<void>> {
  const environment = options.environment ?? process.env;
  try {
    await server.listen();
  } catch (listenError) {
    try {
      await server.close();
    } catch (closeError) {
      let markerError: unknown = null;
      try {
        publishRealBuildViteShutdownUnconfirmed(environment);
      } catch (error) {
        markerError = error;
      }
      throw new AggregateError(
        [listenError, closeError, ...(markerError === null ? [] : [markerError])],
        "Vite server failed to listen and its partially started server could not be closed.",
        { cause: closeError },
      );
    }
    throw listenError;
  }
  return async () => {
    try {
      await server.close();
    } catch (closeError) {
      try {
        publishRealBuildViteShutdownUnconfirmed(environment);
      } catch (markerError) {
        throw new AggregateError(
          [closeError, markerError],
          "Vite server teardown could not confirm shutdown or publish its preservation marker.",
          { cause: markerError },
        );
      }
      throw closeError;
    }
  };
}
