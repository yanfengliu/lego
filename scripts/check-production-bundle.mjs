import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../apps/web/dist/", import.meta.url));
const forbiddenAutomationTokens = [
  "render_app_to_text",
  "capture_model_views",
  "get_model_snapshot",
  "advanceTime",
  "lego.app-observation/1",
  "lego.set-6651557-ldraw-source-audit/1",
  "ldraw-source-resolution-only",
];

/**
 * The build player's data (a set's model, steps and booklet) is served by the
 * dev server alone (tools/player/serve.ts), from ignored folders; no file of
 * it, and no path into those folders, may ship in the production build.
 */
const forbiddenDataExtensions = [".mpd", ".ldr", ".dat", ".pdf"];
const forbiddenDataPaths = ["output/booklet/player", "official-model", "recipes/"];

async function distFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await distFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const everything = await distFiles(distDirectory);
const shippedData = everything.filter((file) =>
  forbiddenDataExtensions.some((extension) => file.toLowerCase().endsWith(extension)),
);
if (shippedData.length > 0) {
  throw new Error(
    `Production build ships player data files, which only the dev server may serve: ${shippedData.join(", ")}`,
  );
}
const files = everything.filter((file) => file.endsWith(".js"));
if (files.length === 0) throw new Error("Production build contains no JavaScript assets");

for (const file of files) {
  const source = await readFile(file, "utf8");
  const exposed = forbiddenAutomationTokens.filter((token) => source.includes(token));
  if (exposed.length > 0) {
    throw new Error(
      `Production bundle exposes development automation tokens: ${exposed.join(", ")}`,
    );
  }
  const dataPaths = forbiddenDataPaths.filter((path) => source.includes(path));
  if (dataPaths.length > 0) {
    throw new Error(
      `Production bundle ${file} names player data paths only the dev server may use: ${dataPaths.join(", ")}`,
    );
  }
}

console.log(`Production bundle guard passed (${files.length} JavaScript asset checked).`);
