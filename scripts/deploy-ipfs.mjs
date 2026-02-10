#!/usr/bin/env node

/**
 * Deploy the built dist/ directory to IPFS via Storacha.
 *
 * Prerequisites (one-time local setup):
 *   npx storacha login you@example.com   # verify email, select plan
 *   npx storacha space create safenet-staking-ui
 *
 * Usage:
 *   node scripts/deploy-ipfs.mjs          # build + upload
 *   node scripts/deploy-ipfs.mjs --skip-build  # upload only (dist/ must exist)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");

// dweb.link does not set restrictive CSP headers, unlike w3s.link / storacha.link
// which block outbound fetch() to external RPC endpoints.
const GATEWAY = "dweb.link";

const skipBuild = process.argv.includes("--skip-build");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd: ROOT, ...opts });
}

// 1. Build
if (!skipBuild) {
  console.log("\n--- Building production bundle ---");
  run("npm run build", { stdio: "inherit" });
}

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("Error: dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

// 2. Upload to Storacha / IPFS
console.log("\n--- Uploading dist/ to IPFS via Storacha ---");
const output = run(`npx storacha up ${DIST} --json`, { encoding: "utf-8" });
const { root } = JSON.parse(output);
const cid = root["/"];

console.log(`\nCID:  ${cid}`);
console.log(`URL:  https://${cid}.ipfs.${GATEWAY}/`);
