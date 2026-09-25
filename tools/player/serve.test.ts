import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";

import { byteRange, playerDataPlugin, playerRoute } from "./serve.ts";
import { PLAYER_SETS } from "./sets.ts";

const ROOT = resolve("/checkout");
const SET = PLAYER_SETS[0]!;

describe("the dev server's player-data routes", () => {
  it("lists the manifest's sets and maps a set's files to its output folder", () => {
    const sets = playerRoute("/player-data/sets.json", ROOT, {});
    expect(sets?.kind).toBe("sets");
    expect(JSON.parse((sets as { body: string }).body)).toEqual({
      version: "lego.player-sets/1",
      sets: PLAYER_SETS.map(({ id, name }) => ({ id, name })),
    });
    expect(playerRoute(`/player-data/${SET.id}/model.mpd?x=1`, ROOT, {})).toMatchObject({
      kind: "file",
      path: resolve(ROOT, SET.output, "model.mpd"),
      missing: `Player data missing: ${SET.output}/model.mpd does not exist; run npm start.`,
    });
    expect(
      playerRoute(`/player-data/${SET.id}/steps.json`, ROOT, { BOOKLET_OUT: "/elsewhere" }),
    ).toMatchObject({ kind: "file", path: resolve("/elsewhere", "player", SET.id, "steps.json") });
    expect(playerRoute(`/player-data/${SET.id}/booklet.pdf`, ROOT, {})).toMatchObject({
      kind: "file",
      type: "application/pdf",
      missing: `booklet PDF not found at ${SET.booklet}; put the set's instruction booklet there.`,
    });
  });

  it("answers only its three file names for a manifest set, and leaves every other URL alone", () => {
    expect(playerRoute("/", ROOT, {})).toBeNull();
    expect(playerRoute("/editor.html", ROOT, {})).toBeNull();
    // The URL is normalised before routing, so dot segments cannot climb out.
    expect(playerRoute(`/player-data/${SET.id}/../../package.json`, ROOT, {})).toBeNull();
    for (const url of [
      `/player-data/${SET.id}/stamp.json`,
      `/player-data/${SET.id}%2F..%2Fsteps.json`,
      "/player-data/sets.json/x",
    ]) {
      expect(playerRoute(url, ROOT, {})?.kind).toBe("unknown");
    }
    expect(playerRoute("/player-data/nope/steps.json", ROOT, {})).toEqual({
      kind: "unknown",
      message: `No set nope in tools/player/sets.ts; the sets are ${PLAYER_SETS.map(({ id }) => id).join(", ")}.`,
    });
  });

  it("reads one byte range from a Range header, and refuses any other", () => {
    expect(byteRange(undefined, 100)).toBeNull();
    expect(byteRange("bytes=0-9", 100)).toEqual({ first: 0, last: 9 });
    expect(byteRange("bytes=90-", 100)).toEqual({ first: 90, last: 99 });
    expect(byteRange("bytes=90-500", 100)).toEqual({ first: 90, last: 99 });
    expect(byteRange("bytes=-10", 100)).toEqual({ first: 90, last: 99 });
    expect(byteRange("bytes=-500", 100)).toEqual({ first: 0, last: 99 });
    for (const header of [
      "bytes=100-",
      "bytes=9-0",
      "bytes=-0",
      "bytes=-",
      "bytes=0-9,20-29",
      "items=0-9",
      "bytes=a-b",
    ]) {
      expect(byteRange(header, 100), header).toBe("unsatisfiable");
    }
    expect(byteRange("bytes=0-", 0)).toBe("unsatisfiable");
  });
});

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

/**
 * The plugin's real middleware behind a real HTTP server, reading a set's
 * files from a temporary BOOKLET_OUT; a URL it passes on answers 418 "next".
 */
describe("the player-data middleware over HTTP", () => {
  const steps = '{"version":"lego.player-steps/1","steps":[]}\n';
  const savedOut = process.env.BOOKLET_OUT;
  let dataRoot = "";
  let server: Server | undefined;
  let base = "";

  beforeAll(async () => {
    dataRoot = mkdtempSync(join(tmpdir(), "player-serve-"));
    mkdirSync(join(dataRoot, "player", SET.id), { recursive: true });
    writeFileSync(join(dataRoot, "player", SET.id, "steps.json"), steps);
    process.env.BOOKLET_OUT = dataRoot;
    let handler: Handler | undefined;
    const hook = playerDataPlugin().configureServer;
    const configure = (typeof hook === "function" ? hook : hook?.handler) as
      ((server: ViteDevServer) => unknown) | undefined;
    await configure?.({
      middlewares: { use: (registered: Handler) => (handler = registered) },
    } as unknown as ViteDevServer);
    if (!handler) throw new Error("playerDataPlugin's configureServer registered no middleware.");
    const middleware = handler;
    server = createServer((request, response) =>
      middleware(request, response, () => {
        response.statusCode = 418;
        response.end("next");
      }),
    );
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
    if (savedOut === undefined) delete process.env.BOOKLET_OUT;
    else process.env.BOOKLET_OUT = savedOut;
    rmSync(dataRoot, { recursive: true, force: true });
  });

  const stepsUrl = () => `${base}/player-data/${SET.id}/steps.json`;

  it("serves a set's file to GET and its headers alone to HEAD", async () => {
    const got = await fetch(stepsUrl());
    expect(got.status).toBe(200);
    expect(got.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(got.headers.get("Accept-Ranges")).toBe("bytes");
    expect(await got.text()).toBe(steps);

    const head = await fetch(stepsUrl(), { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Length")).toBe(String(Buffer.byteLength(steps)));
    expect(await head.text()).toBe("");
  });

  it("serves one byte range as 206, and answers 416 to a range it cannot serve", async () => {
    const part = await fetch(stepsUrl(), { headers: { Range: "bytes=2-11" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe(`bytes 2-11/${steps.length}`);
    expect(part.headers.get("Content-Length")).toBe("10");
    expect(await part.text()).toBe(steps.slice(2, 12));

    for (const range of [`bytes=${steps.length}-`, "bytes=9-2", "bytes=0-1,4-5"]) {
      const refused = await fetch(stepsUrl(), { headers: { Range: range } });
      expect(refused.status, range).toBe(416);
      expect(refused.headers.get("Content-Range")).toBe(`bytes */${steps.length}`);
      expect(await refused.text()).toContain("is not one satisfiable byte range");
    }

    // If-Range names a version this route cannot check, so the whole file comes back.
    const whole = await fetch(stepsUrl(), {
      headers: { Range: "bytes=2-11", "If-Range": '"some-etag"' },
    });
    expect(whole.status).toBe(200);
    expect(await whole.text()).toBe(steps);
  });

  it("refuses writes, names a missing file or set, and passes other URLs on", async () => {
    const post = await fetch(stepsUrl(), { method: "POST", body: "{}" });
    expect(post.status).toBe(405);
    expect(await post.text()).toContain("read-only");

    const missing = await fetch(`${base}/player-data/${SET.id}/model.mpd`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toMatch(/model\.mpd does not exist; run npm start\.$/u);

    const unknown = await fetch(`${base}/player-data/nope/steps.json`);
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toContain("No set nope in tools/player/sets.ts");

    const other = await fetch(`${base}/index.html`);
    expect(other.status).toBe(418);
    expect(await other.text()).toBe("next");
  });
});
