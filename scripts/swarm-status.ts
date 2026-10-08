#!/usr/bin/env tsx
/**
 * Remaining storage time of every recorded Swarm release (releases/swarm/).
 * Warns about releases that expire within --warn-days (default 7) or have
 * expired, and prints a ready-to-send top-up for each. Anyone can top up.
 * With --strict it also exits with 1 in that case, for use in scripts.
 * A failed chain lookup is reported as UNKNOWN (never as expired) and always
 * exits with 1: the storage state is then simply not known.
 *
 * Usage: yarn swarm:status [--warn-days 7] [--extend-days 90] [--strict]
 */
import { parseArgs } from "node:util"
import { formatUnits } from "viem"
import { POSTAGE_STAMP, XBZZ, XBZZ_DECIMALS, createGnosisClient, postageStampAbi, readPricing, remainingTtl } from "./swarm/batch"
import { checkReleases, topUpCall } from "./swarm/expiry"
import { readReleases } from "./swarm/release"

const { values } = parseArgs({
  options: {
    "warn-days": { type: "string", default: "7" },
    "extend-days": { type: "string", default: "90" },
    strict: { type: "boolean", default: false },
  },
})
const warnDays = Number(values["warn-days"])
const extendDays = Number(values["extend-days"])

const releases = readReleases()
if (releases.length === 0) {
  console.error("No releases recorded in releases/swarm/.")
  process.exit(0)
}

const client = createGnosisClient()
const pricing = await readPricing(client).catch((e: Error) => {
  console.error(`Error: cannot read PostageStamp prices from Gnosis Chain (set SWARM_GNOSIS_RPC_URL to another RPC): ${e.message.split("\n")[0]}`)
  process.exit(1)
})
const statuses = await checkReleases(releases, async (id) => (await remainingTtl(client, id)).secondsLeft, warnDays)

const LABELS = { ok: "ok      ", expiring: "EXPIRING", expired: "EXPIRED ", unknown: "UNKNOWN " }
for (const { release, secondsLeft, state, error } of statuses) {
  const left = secondsLeft === undefined ? "lookup failed" : `${(secondsLeft / 86_400).toFixed(1)} days left`
  console.log(`${LABELS[state]} ${release.createdAt.slice(0, 10)}  ${release.reference.slice(0, 16)}…  batch ${release.batch.id.slice(0, 12)}…  ${left}`)
  if (state === "unknown") {
    console.log(`         could not read the batch (${error}); its storage may still be paid for. Do not re-upload — retry, or set SWARM_GNOSIS_RPC_URL`)
  }
  if (state === "expiring") {
    const remaining = await client.readContract({ address: POSTAGE_STAMP, abi: postageStampAbi, functionName: "remainingBalance", args: [release.batch.id] })
    const call = topUpCall(release.batch.id, release.batch.depth, pricing, extendDays, remaining)
    console.log(
      `         top up +${extendDays} days from any account: approve ${formatUnits(call.total, XBZZ_DECIMALS)} xBZZ on ${XBZZ} for ${POSTAGE_STAMP},`,
      `\n         then topUp(${call.args._batchId}, ${call.args._topupAmountPerChunk})  calldata ${call.data}`,
    )
  }
  if (state === "expired") console.log("         expired: storage is no longer paid for; re-upload with a new batch (yarn deploy:swarm)")
}

if (statuses.some((s) => s.state === "unknown")) process.exit(1)
if (values.strict && statuses.some((s) => s.state !== "ok")) process.exit(1)
