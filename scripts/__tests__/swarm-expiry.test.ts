// @vitest-environment node
import { describe, it, expect } from "vitest"
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  HttpRequestError,
  decodeFunctionData,
  toFunctionSelector,
  type Hex,
} from "viem"
import { postageStampAbi } from "../swarm/batch"
import { checkReleases, topUpCall } from "../swarm/expiry"
import type { SwarmRelease } from "../swarm/release"

const DAY = 86_400
const release = (id: Hex) => ({ batch: { id, depth: 17 } }) as unknown as SwarmRelease
const pricing = { price: 142_236n, minimumPerChunk: 142_236n * 17_280n }

describe("checkReleases", () => {
  it("classifies releases by remaining time", async () => {
    const ttl: Record<string, number> = { "0x01": 30 * DAY, "0x02": 3 * DAY, "0x03": 0 }
    const statuses = await checkReleases(["0x01", "0x02", "0x03"].map((id) => release(id as Hex)), async (id) => ttl[id], 7)
    expect(statuses.map((s) => s.state)).toEqual(["ok", "expiring", "expired"])
  })

  it("treats only PostageStamp's BatchDoesNotExist as expired, other failures as unknown", async () => {
    const gone = new ContractFunctionExecutionError(
      new ContractFunctionRevertedError({ abi: postageStampAbi, data: toFunctionSelector("BatchDoesNotExist()"), functionName: "remainingBalance" }),
      { abi: postageStampAbi, functionName: "remainingBalance", args: [`0x${"00".repeat(32)}`] },
    )
    const statuses = await checkReleases(
      ["0x01", "0x02"].map((id) => release(id as Hex)),
      async (id) => {
        throw id === "0x01" ? gone : new HttpRequestError({ url: "https://rpc.example", status: 503 })
      },
      7,
    )
    expect(statuses.map((s) => [s.state, s.secondsLeft])).toEqual([
      ["expired", 0],
      ["unknown", undefined],
    ])
    expect(statuses[1].error).toMatch(/HTTP request failed/)
  })
})

describe("topUpCall", () => {
  const BATCH: Hex = `0x${"78".repeat(32)}`

  it("adds the requested days at the current price for the whole batch", () => {
    const call = topUpCall(BATCH, 17, pricing, 30, pricing.minimumPerChunk * 10n)
    const perChunk = pricing.price * BigInt((30 * DAY) / 5)
    expect(call.args._topupAmountPerChunk).toBe(perChunk.toString())
    expect(call.total).toBe(perChunk << 17n)
    expect(decodeFunctionData({ abi: postageStampAbi, data: call.data })).toEqual({ functionName: "topUp", args: [BATCH, perChunk] })
  })

  it("tops up to at least PostageStamp's 24 h minimum balance", () => {
    const remaining = pricing.price * 1_000n // well under a day left
    const call = topUpCall(BATCH, 17, pricing, 0.01, remaining)
    expect(BigInt(call.args._topupAmountPerChunk as string) + remaining).toBe(pricing.minimumPerChunk)
  })
})
