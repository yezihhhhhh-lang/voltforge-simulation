import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const [template, html, client, hosting] = await Promise.all([
  readFile("worker/server.js", "utf8"),
  readFile("web/index.html", "utf8"),
  readFile("web/client.js", "utf8"),
  readFile(".openai/hosting.json", "utf8"),
]);

if (!template.includes("__INDEX_HTML__") || !template.includes("__CLIENT_JS__")) {
  throw new Error("Worker template placeholders are missing.");
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
const output = template
  .replace("__INDEX_HTML__", JSON.stringify(html))
  .replace("__CLIENT_JS__", JSON.stringify(client));
await writeFile("dist/server/index.js", output);
await writeFile("dist/.openai/hosting.json", hosting);

