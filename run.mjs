// Usage: node run.mjs [game-name]   (runs every suite when no name is given)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { failed } from "./harness.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "suites");
const only = process.argv[2];
for (const f of fs.readdirSync(dir).sort()) {
  const name = f.replace(/\.mjs$/, "");
  if (only && only !== name) continue;
  console.log("\n" + name);
  const t0 = Date.now();
  try { await (await import("./suites/" + f)).default(); }
  catch (e) { console.log("  FAIL suite crashed: " + (e && e.stack || e)); process.exitCode = 1; }
  console.log("  (" + ((Date.now() - t0) / 1000).toFixed(1) + "s)");
}
console.log(failed() ? "\n" + failed() + " check(s) failed" : "\nAll checks passed");
process.exit(failed() || process.exitCode ? 1 : 0);
