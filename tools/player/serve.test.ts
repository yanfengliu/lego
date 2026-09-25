import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { playerRoute } from "./serve.ts";
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
});
