import { resolve } from "node:path";

import {
  normalizedServedResponseSourceRoot,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  servedResponseChunkName,
  servedResponseDigest,
  servedResponseRequestKey,
  strictServedResponseHeaders,
} from "../e2e/real-build-served-response-policy";

/** Current /4 fixture with one source URL under the exact verifier checkout boundary. */
export function currentArtifactServedEvidence(input: {
  readonly sourceRoot: string;
  readonly pdfBytes: number;
  readonly pdfDigest: string;
}): {
  readonly runnerFile: string;
  readonly runnerBytes: Buffer;
  readonly manifestFile: typeof REAL_BUILD_SERVED_RESPONSE_MANIFEST;
  readonly manifestBytes: Buffer;
} {
  const runnerBytes = Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY);
  const runnerDigest = servedResponseDigest(runnerBytes);
  const runnerFile = servedResponseChunkName(0);
  const runnerRequestHeaders = strictServedResponseHeaders({ accept: "*/*" });
  const runnerRequestKey = servedResponseRequestKey(
    REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
    runnerRequestHeaders,
  );
  const pdfRequestHeaders = strictServedResponseHeaders({});
  const pdfRequestUrl = `/@fs/${resolve(process.cwd(), "inputs/booklet.pdf").replaceAll("\\", "/")}`;
  const pdfRequestKey = servedResponseRequestKey(pdfRequestUrl, pdfRequestHeaders);
  const responses = [
    {
      requestKey: runnerRequestKey,
      requestUrl: REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
      requestHeaders: runnerRequestHeaders,
      sourcePath: null,
      status: REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
      headers: strictServedResponseHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS),
      body: { kind: "bundle", offset: 0, bytes: runnerBytes.length, digest: runnerDigest },
    },
    {
      requestKey: pdfRequestKey,
      requestUrl: pdfRequestUrl,
      requestHeaders: pdfRequestHeaders,
      sourcePath: "inputs/booklet.pdf",
      status: 200,
      headers: strictServedResponseHeaders({}),
      body: {
        kind: "source",
        path: "inputs/booklet.pdf",
        bytes: input.pdfBytes,
        digest: input.pdfDigest,
      },
    },
  ]
    .sort((left, right) => left.requestKey.localeCompare(right.requestKey))
    .map((response, index) => ({ index, ...response }));
  const responseIndex = (requestKey: string): number =>
    responses.find(({ requestKey: candidate }) => candidate === requestKey)!.index;
  return {
    runnerFile,
    runnerBytes,
    manifestFile: REAL_BUILD_SERVED_RESPONSE_MANIFEST,
    manifestBytes: Buffer.from(
      `${JSON.stringify({
        schemaVersion: REAL_BUILD_SERVED_RESPONSE_SCHEMA,
        sourceRoot: normalizedServedResponseSourceRoot(input.sourceRoot),
        events: [
          {
            sequence: 0,
            outcome: "fulfilled",
            requestKey: runnerRequestKey,
            responseIndex: responseIndex(runnerRequestKey),
            cacheHit: false,
          },
          {
            sequence: 1,
            outcome: "fulfilled",
            requestKey: pdfRequestKey,
            responseIndex: responseIndex(pdfRequestKey),
            cacheHit: false,
          },
        ],
        responses,
        bodyChunks: [{ file: runnerFile, bytes: runnerBytes.length, digest: runnerDigest }],
      })}\n`,
    ),
  };
}
