#!/usr/bin/env node

/**
 * Deploy the built dist/ directory to IPFS via Pinata.
 *
 * Required environment variables:
 *   PINATA_JWT          — API JWT from https://app.pinata.cloud/developers/api-keys
 *   PINATA_GATEWAY      — Your dedicated gateway domain (e.g. "my-gateway.mypinata.cloud")
 *
 * Usage:
 *   node scripts/deploy-ipfs.mjs              # build + upload, name: "safenet-staking-ui"
 *   node scripts/deploy-ipfs.mjs --skip-build # upload only (dist/ must exist)
 *   node scripts/deploy-ipfs.mjs --folder     # upload with timestamped name, e.g. "safenet-staking-ui-2026-03-18_14-30-00"
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { PinataSDK } from "pinata";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");

const skipBuild = process.argv.includes("--skip-build");
const useFolder = process.argv.includes("--folder");

const timestamp = new Date()
  .toISOString()
  .replace(/T/, "_")
  .replace(/:/g, "-")
  .slice(0, 19);
const uploadName = useFolder
  ? `safenet-staking-ui-${timestamp}`
  : "safenet-staking-ui";

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd: ROOT, ...opts });
}

/** Recursively collect all files in a directory into File objects. */
function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else {
      const relativePath = relative(base, fullPath);
      const content = readFileSync(fullPath);
      files.push(new File([content], relativePath));
    }
  }
  return files;
}

// --- Validate env ---
const jwt = process.env.PINATA_JWT;
const gateway = process.env.PINATA_GATEWAY;

if (!jwt) {
  console.error("Error: PINATA_JWT environment variable is required.");
  console.error("Get one at https://app.pinata.cloud/developers/api-keys");
  process.exit(1);
}

if (!gateway) {
  console.error("Error: PINATA_GATEWAY environment variable is required.");
  console.error("Find yours at https://app.pinata.cloud/gateway");
  process.exit(1);
}

// --- 1. Build ---
if (!skipBuild) {
  console.log("\n--- Building production bundle ---");
  run("npm run build", { stdio: "inherit" });
}

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("Error: dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

// --- 2. Upload to Pinata / IPFS ---
console.log(`\n--- Uploading dist/ to IPFS via Pinata (name: "${uploadName}") ---`);

const pinata = new PinataSDK({
  pinataJwt: jwt,
  pinataGateway: gateway,
});

const files = collectFiles(DIST);
console.log(`Collected ${files.length} files from dist/`);

const upload = await pinata.upload.public
  .fileArray(files)
  .name(uploadName);

const cid = upload.cid;
const gatewayUrl = `https://${gateway}/ipfs/${cid}`;

console.log(`\nCID:        ${cid}`);
console.log(`IPFS:       ipfs://${cid}`);
console.log(`Pinata:     ${gatewayUrl}`);
console.log(`dweb.link:  https://${cid}.ipfs.dweb.link/`);
console.log(`cf-ipfs:    https://cloudflare-ipfs.com/ipfs/${cid}`);
