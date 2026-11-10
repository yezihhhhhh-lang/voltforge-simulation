import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const required = [
  ".openai/hosting.json",
  "drizzle/0000_initial.sql",
  "web/index.html",
  "web/client.js",
  "worker/server.js",
  "netlify/functions/api.mjs",
  "netlify/database/adapter.mjs",
  "netlify/database/migrations/0002_formal_simulation/migration.sql",
  "netlify.toml",
  "dist/server/index.js",
  "dist/.openai/hosting.json",
];
for (const file of required) await stat(file);
const hosting = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
if (hosting.static) throw new Error("Server-backed build must not declare static hosting.");
if (hosting.d1 !== "DB") throw new Error("D1 binding must be DB.");
for (const file of ["web/client.js", "dist/server/index.js", "netlify/functions/api.mjs", "netlify/database/adapter.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
}
const html = await readFile("web/index.html", "utf8");
for (const id of ["cover", "auth", "student", "admin", "modal"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing UI section: ${id}`);
}
console.log("VoltForge build validated.");

