import { createReadStream, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

import { PLAYER_SETS_VERSION } from "../../apps/web/src/player/player-data.ts";
import { findInput, PLAYER_SETS, playerOutputDir } from "./sets.ts";

/**
 * The dev server's player-data routes, and nothing else: the production
 * build never serves them (`apply: "serve"`).
 *
 * - `/player-data/sets.json`: each manifest set's id and name;
 * - `/player-data/<id>/steps.json` and `/player-data/<id>/model.mpd`: the
 *   set's generated player data, from its output folder;
 * - `/player-data/<id>/booklet.pdf`: the set's booklet, found by walking up
 *   from this checkout, as a worktree must.
 *
 * Every path comes from the manifest; a request names only a set id and one
 * of three fixed file names. A missing file answers 404 with a plain-text
 * message saying what to do, which the player shows as it is.
 */
export const PLAYER_DATA_PREFIX = "/player-data/";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export type PlayerRoute =
  | { readonly kind: "sets"; readonly body: string }
  | {
      readonly kind: "file";
      readonly path: string;
      readonly type: string;
      /** The 404 text when the file is absent. */
      readonly missing: string;
    }
  | { readonly kind: "unknown"; readonly message: string };

const TYPES: Readonly<Record<string, string>> = {
  "steps.json": "application/json; charset=utf-8",
  "model.mpd": "text/plain; charset=utf-8",
  "booklet.pdf": "application/pdf",
};

/** What a request under /player-data/ answers; null for any other URL. */
export function playerRoute(
  url: string,
  root: string = REPOSITORY_ROOT,
  env: Readonly<Record<string, string | undefined>> = process.env,
): PlayerRoute | null {
  const pathname = new URL(url, "http://127.0.0.1").pathname;
  if (!pathname.startsWith(PLAYER_DATA_PREFIX)) return null;
  const rest = pathname.slice(PLAYER_DATA_PREFIX.length);
  if (rest === "sets.json") {
    const sets = PLAYER_SETS.map(({ id, name }) => ({ id, name }));
    return { kind: "sets", body: JSON.stringify({ version: PLAYER_SETS_VERSION, sets }) };
  }
  const match = /^([\w-]{1,64})\/(steps\.json|model\.mpd|booklet\.pdf)$/u.exec(rest);
  if (!match) {
    return {
      kind: "unknown",
      message: `No player data at ${pathname}; the routes are ${PLAYER_DATA_PREFIX}sets.json and ${PLAYER_DATA_PREFIX}<set>/steps.json, model.mpd or booklet.pdf.`,
    };
  }
  const [, id, file] = match as unknown as [string, string, string];
  const set = PLAYER_SETS.find((entry) => entry.id === id);
  if (!set) {
    return {
      kind: "unknown",
      message: `No set ${id} in tools/player/sets.ts; the sets are ${PLAYER_SETS.map((entry) => entry.id).join(", ")}.`,
    };
  }
  if (file === "booklet.pdf") {
    return {
      kind: "file",
      path: findInput(root, set.booklet),
      type: TYPES[file]!,
      missing: `booklet PDF not found at ${set.booklet}; put the set's instruction booklet there.`,
    };
  }
  const path = resolve(playerOutputDir(set, root, env), file);
  return {
    kind: "file",
    path,
    type: TYPES[file]!,
    missing: `Player data missing: ${relative(root, path).replaceAll("\\", "/")} does not exist; run npm start.`,
  };
}

function isFile(path: string): number | null {
  try {
    const stat = statSync(path);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

export function playerDataPlugin(): Plugin {
  return {
    name: "lego-player-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const route = playerRoute(request.url ?? "/");
        if (route === null) {
          next();
          return;
        }
        const reply = (status: number, type: string, body: string) => {
          response.statusCode = status;
          response.setHeader("Content-Type", type);
          response.setHeader("Cache-Control", "no-store");
          response.end(body);
        };
        if (request.method !== "GET" && request.method !== "HEAD") {
          reply(405, "text/plain; charset=utf-8", "Player data is read-only: use GET.");
          return;
        }
        if (route.kind === "sets") {
          reply(200, "application/json; charset=utf-8", route.body);
          return;
        }
        if (route.kind === "unknown") {
          reply(404, "text/plain; charset=utf-8", route.message);
          return;
        }
        const size = isFile(route.path);
        if (size === null) {
          reply(404, "text/plain; charset=utf-8", route.missing);
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", route.type);
        response.setHeader("Content-Length", String(size));
        response.setHeader("Cache-Control", "no-store");
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        createReadStream(route.path)
          .on("error", () => response.destroy())
          .pipe(response);
      });
    },
  };
}
