/**
 * Expiry checks for recorded releases and the top-up call that extends them.
 * Anyone can top up a batch; only the batch id is needed.
 */
import { encodeFunctionData, type Hex } from "viem"
import { BLOCK_TIME_SECONDS, POSTAGE_STAMP, isBatchGone, postageStampAbi, type Call, type Pricing } from "./batch"
import type { SwarmRelease } from "./release"

export interface ReleaseStatus {
  release: SwarmRelease
  /** Seconds of storage left at the current price; 0 once expired, undefined if unknown. */
  secondsLeft?: number
  /**
   * "expired" only when confirmed on-chain: balance used up, or PostageStamp
   * reports the batch as gone. "unknown" when the lookup itself failed.
   */
  state: "ok" | "expiring" | "expired" | "unknown"
  /** Why the state is unknown. */
  error?: string
}

export async function checkReleases(
  releases: SwarmRelease[],
  secondsLeftOf: (batchId: Hex) => Promise<number>,
  warnDays: number,
): Promise<ReleaseStatus[]> {
  return Promise.all(
    releases.map(async (release): Promise<ReleaseStatus> => {
      let secondsLeft: number
      try {
        secondsLeft = await secondsLeftOf(release.batch.id)
      } catch (e) {
        if (isBatchGone(e)) return { release, secondsLeft: 0, state: "expired" }
        return { release, state: "unknown", error: (e as Error).message.split("\n")[0] }
      }
      const state = secondsLeft <= 0 ? "expired" : secondsLeft < warnDays * 86_400 ? "expiring" : "ok"
      return { release, secondsLeft, state }
    }),
  )
}

/**
 * `topUp` adding `days` of storage at the current price. PostageStamp also
 * requires the result to keep at least its 24 h minimum balance, so the
 * amount never goes below `minimumPerChunk - remainingPerChunk`.
 */
export function topUpCall(batchId: Hex, depth: number, pricing: Pricing, days: number, remainingPerChunk = 0n): Call & { total: bigint } {
  const blocks = BigInt(Math.ceil((days * 86_400) / BLOCK_TIME_SECONDS))
  const floor = pricing.minimumPerChunk > remainingPerChunk ? pricing.minimumPerChunk - remainingPerChunk : 0n
  const perChunk = pricing.price * blocks > floor ? pricing.price * blocks : floor
  return {
    to: POSTAGE_STAMP,
    functionName: "topUp",
    args: { _batchId: batchId, _topupAmountPerChunk: perChunk.toString() },
    data: encodeFunctionData({ abi: postageStampAbi, functionName: "topUp", args: [batchId, perChunk] }),
    total: perChunk << BigInt(depth),
  }
}
