#!/usr/bin/env tsx
/// <reference types="node" />

/**
 * Deploy the built dist/ directory to IPFS via Pinata.
 *
 * Required environment variables:
 *   PINATA_JWT          — API JWT from https://app.pinata.cloud/developers/api-keys
 *   PINATA_GATEWAY      — Your dedicated gateway domain (e.g. "my-gateway.mypinata.cloud")
 *
 * Usage:
 *   tsx scripts/deploy-ipfs.ts              # build + upload, name: "safenet-staking-ui"
 *   tsx scripts/deploy-ipfs.ts --skip-build # upload only (dist/ must exist)
 *   tsx scripts/deploy-ipfs.ts --folder     # upload with timestamped name, e.g. "safenet-staking-ui-2026-03-18T14:30:00.000Z"
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join, matchesGlob, relative, resolve } from "node:path";
import { PinataSDK } from "pinata";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");
const IGNORE_FILE_GLOBS = ["**/.DS_Store"];

const skipBuild = process.argv.includes("--skip-build");
const useFolder = process.argv.includes("--folder");

const uploadName = useFolder
  ? `safenet-staking-ui-${new Date().toISOString()}`
  : "safenet-staking-ui";

function run(cmd: string, opts: ExecSyncOptions = {}): Buffer {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd: ROOT, ...opts }) as Buffer;
}

function isIgnoredFile(path: string): boolean {
  return IGNORE_FILE_GLOBS.some((pattern) => matchesGlob(path, pattern));
}

/** Collect all files in a directory into File objects with relative paths. */
function collectFiles(dir: string): File[] {
  const files: File[] = [];
  for (const entry of globSync(`${dir}/**/*`, { withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      const relativePath = relative(dir, path);
      if (isIgnoredFile(relativePath)) {
        continue;
      }
      const content = readFileSync(path);
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
  run("yarn build", { stdio: "inherit" });
}

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("Error: dist/index.html not found. Run `yarn build` first.");
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
