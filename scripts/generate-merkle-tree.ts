#!/usr/bin/env tsx
/**
 * CLI script to generate Merkle proofs from a config file.
 *
 * Reads scripts/merkle-config.json, builds the Merkle tree,
 * and writes proof files to public/rewards/.
 *
 * Usage: yarn generate:proofs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve, dirname } from "path"
import { getAddress, type Address } from "viem"
import { buildMerkleTree, type MerkleEntry } from "./merkle-tree"

interface MerkleConfig {
  epoch: number
  entries: Record<string, string>
}

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname)
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..")
const CONFIG_PATH = resolve(SCRIPT_DIR, "merkle-config.json")
const PROOFS_DIR = resolve(PROJECT_ROOT, "public/rewards/proofs")
const LATEST_PATH = resolve(PROJECT_ROOT, "public/rewards/latest.json")

function loadConfig(): MerkleConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8")
  const config: unknown = JSON.parse(raw)

  if (
    typeof config !== "object" ||
    config === null ||
    typeof (config as Record<string, unknown>).epoch !== "number" ||
    typeof (config as Record<string, unknown>).entries !== "object"
  ) {
    throw new Error("Invalid merkle-config.json format")
  }

  return config as MerkleConfig
}

function main() {
  console.log("Reading config from", CONFIG_PATH)
  const config = loadConfig()

  const entries: MerkleEntry[] = Object.entries(config.entries).map(
    ([addr, amount]) => ({
      address: getAddress(addr) as Address,
      amount: BigInt(amount),
    }),
  )

  if (entries.length === 0) {
    throw new Error("No entries in config")
  }

  console.log(`Building Merkle tree with ${entries.length} entries...`)
  const tree = buildMerkleTree(entries)
  console.log(`Root: ${tree.root}`)

  // Compute total
  const total = entries.reduce((sum, e) => sum + e.amount, 0n)

  // Write individual proof files
  mkdirSync(PROOFS_DIR, { recursive: true })

  let written = 0
  for (const entry of entries) {
    const addr = getAddress(entry.address)
    const proof = tree.proofs.get(addr)!
    const proofFile = {
      cumulativeAmount: entry.amount.toString(),
      merkleRoot: tree.root,
      proof,
    }

    const filePath = resolve(
      PROOFS_DIR,
      `${addr.toLowerCase()}.json`,
    )
    writeFileSync(filePath, JSON.stringify(proofFile, null, 2) + "\n")
    written++
  }

  console.log(`Wrote ${written} proof files to public/rewards/proofs/`)

  // Write latest.json
  const latest = {
    merkleRoot: tree.root,
    tokenTotal: total.toString(),
    updatedAt: new Date().toISOString(),
    epoch: config.epoch,
  }

  writeFileSync(LATEST_PATH, JSON.stringify(latest, null, 2) + "\n")
  console.log("Updated public/rewards/latest.json")
  console.log("Done!")
}

main()
