import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const build = spawnSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

await rm("dist/public", { recursive: true, force: true });
await mkdir("dist/public", { recursive: true });
await cp("web/index.html", "dist/public/index.html");
await cp("web/client.js", "dist/public/client.js");

