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
];

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await javascriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const files = await javascriptFiles(distDirectory);
if (files.length === 0) throw new Error("Production build contains no JavaScript assets");

for (const file of files) {
  const source = await readFile(file, "utf8");
  const exposed = forbiddenAutomationTokens.filter((token) => source.includes(token));
  if (exposed.length > 0) {
    throw new Error(
      `Production bundle exposes development automation tokens: ${exposed.join(", ")}`,
    );
  }
}

console.log(`Production bundle guard passed (${files.length} JavaScript asset checked).`);
