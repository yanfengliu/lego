import { type BrowserContext } from "playwright";

import { REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS } from "./real-build-prefix50-subbuild-return-review-static-app-manifest.ts";

const PATHS = new Set<string>(
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS.flatMap((asset) => [...asset.requestPaths]),
);
const REASONS = [
  "invalid-url",
  "credentials",
  "foreign-origin",
  "query-or-fragment",
  "unreviewed-path",
  "unsupported-method",
  "websocket",
  "route-error",
] as const;
type Refusal = (typeof REASONS)[number];

export class RealBuildStep44CalibrationRequestRefusal extends Error {
  readonly counts: Readonly<Record<Refusal, number>>;

  constructor(counts: Record<Refusal, number>) {
    super(
      `Step-44 calibration browser request policy refused a request; only credential-free GET/HEAD requests to the owned static assets are allowed. Counts (each capped at 4096): ${JSON.stringify(counts)}.`,
    );
    this.name = "RealBuildStep44CalibrationRequestRefusal";
    this.counts = Object.freeze({ ...counts });
  }
}

function ownedOrigin(appUrl: string): string {
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/$/u.test(appUrl))
    throw new TypeError("Calibration app URL must name the exact owned loopback port and root.");
  const parsed = new URL(appUrl);
  if (parsed.href !== appUrl)
    throw new TypeError("Calibration app URL must use its canonical owned loopback port.");
  return parsed.origin;
}

export function realBuildStep44CalibrationRequestRefusal(input: {
  readonly appUrl: string;
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
}): Refusal | null {
  const origin = ownedOrigin(input.appUrl);
  if (input.url.length > 4096) return "invalid-url";
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return "invalid-url";
  }
  if (
    url.username !== "" ||
    url.password !== "" ||
    Object.keys(input.headers).some((name) =>
      ["authorization", "proxy-authorization", "cookie"].includes(name.toLowerCase()),
    )
  )
    return "credentials";
  if (url.origin !== origin) return "foreign-origin";
  if (url.search !== "" || url.hash !== "") return "query-or-fragment";
  if (!PATHS.has(url.pathname) || input.url !== `${origin}${url.pathname}`)
    return "unreviewed-path";
  if (input.method !== "GET" && input.method !== "HEAD") return "unsupported-method";
  return null;
}

// Bound: requests routed by this one context, including its popups/extra pages.
// This is not a capability boundary against the trusted Node callback or an OS sandbox.
export async function installRealBuildStep44CalibrationRequestPolicy(
  context: BrowserContext,
  appUrl: string,
): Promise<{ finish: () => Promise<void> }> {
  ownedOrigin(appUrl);
  const counts = Object.fromEntries(REASONS.map((reason) => [reason, 0])) as Record<
    Refusal,
    number
  >;
  const pending = new Set<Promise<void>>();
  const record = (reason: Refusal): void => {
    counts[reason] = Math.min(4096, counts[reason] + 1);
  };
  const track = (operation: () => Promise<void>): Promise<void> => {
    const promise = operation().catch(() => record("route-error"));
    pending.add(promise);
    void promise.then(() => pending.delete(promise));
    return promise;
  };
  await context.route("**/*", (route) =>
    track(async () => {
      try {
        const request = route.request();
        const refusal = realBuildStep44CalibrationRequestRefusal({
          appUrl,
          url: request.url(),
          method: request.method(),
          headers: await request.allHeaders(),
        });
        if (refusal === null) await route.continue();
        else {
          record(refusal);
          await route.abort("blockedbyclient");
        }
      } catch {
        record("route-error");
        // Metadata/transport failure must not leave a request waiting for the callback forever.
        await route.abort("blockedbyclient").catch(() => {});
      }
    }),
  );
  await context.routeWebSocket("**/*", (socket) =>
    track(async () => {
      record("websocket");
      // A routed socket has no upstream connection unless connectToServer is called.
      await socket.close({ code: 1008, reason: "Calibration page WebSockets are not allowed." });
    }),
  );
  return {
    finish: async () => {
      // The owner closes the context before draining, so late requests cannot escape accounting.
      while (pending.size > 0) await Promise.all([...pending]);
      if (Object.values(counts).some((count) => count > 0))
        throw new RealBuildStep44CalibrationRequestRefusal(counts);
    },
  };
}
