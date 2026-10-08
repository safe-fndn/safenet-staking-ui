/**
 * Postage batches on Gnosis Chain: pricing, purchase parameters for a human
 * wallet, discovery and validation of the purchased batch, and remaining TTL.
 *
 * Read-only: this module never sends transactions. The batch is bought from a
 * person's wallet with `_owner` set to the release's ephemeral stamping key.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem"
import { gnosis } from "viem/chains"
import { BUCKET_DEPTH } from "./stamping"

export const POSTAGE_STAMP: Address = "0x45a1502382541Cd610CC9068e88727426b696293"
export const XBZZ: Address = "0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da"
export const XBZZ_DECIMALS = 16
export const BLOCK_TIME_SECONDS = 5
export const DEFAULT_GNOSIS_RPC_URL = "https://rpc.gnosischain.com"

export const postageStampAbi = parseAbi([
  "function lastPrice() view returns (uint64)",
  "function minimumInitialBalancePerChunk() view returns (uint256)",
  "function remainingBalance(bytes32 _batchId) view returns (uint256)",
  "function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) returns (bytes32)",
  "function topUp(bytes32 _batchId, uint256 _topupAmountPerChunk)",
  "event BatchCreated(bytes32 indexed batchId, uint256 totalAmount, uint256 normalisedBalance, address owner, uint8 depth, uint8 bucketDepth, bool immutableFlag)",
  "error BatchDoesNotExist()",
])

/**
 * True if `error` is PostageStamp's `BatchDoesNotExist` revert, which it uses
 * for batches that never existed or have expired and been removed. Any other
 * error (RPC failure, timeout, …) says nothing about the batch.
 */
export function isBatchGone(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
  return revert instanceof ContractFunctionRevertedError && revert.data?.errorName === "BatchDoesNotExist"
}
const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"])

export type GnosisClient = Pick<PublicClient, "readContract" | "getLogs" | "getBlockNumber">

export function createGnosisClient(rpcUrl = process.env.SWARM_GNOSIS_RPC_URL || DEFAULT_GNOSIS_RPC_URL): GnosisClient {
  return createPublicClient({ chain: gnosis, transport: http(rpcUrl) })
}

export interface Pricing {
  /** xBZZ (smallest unit) per chunk per block. */
  price: bigint
  /** Contract minimum per chunk for a new batch (24 h at the current price). */
  minimumPerChunk: bigint
}

export async function readPricing(client: GnosisClient): Promise<Pricing> {
  const [price, minimumPerChunk] = await Promise.all([
    client.readContract({ address: POSTAGE_STAMP, abi: postageStampAbi, functionName: "lastPrice" }),
    client.readContract({ address: POSTAGE_STAMP, abi: postageStampAbi, functionName: "minimumInitialBalancePerChunk" }),
  ])
  return { price, minimumPerChunk }
}

export interface Quote {
  perChunk: bigint
  total: bigint
  depth: number
  /** TTL at the current price; shrinks if the storage price rises. */
  ttlDays: number
}

/**
 * Balance for a TTL of `ttlDays` at the current price, plus `marginPercent`
 * so the purchase still meets the contract minimum if the price rises before
 * it is mined.
 */
export function quote(pricing: Pricing, depth: number, ttlDays: number, marginPercent = 5): Quote {
  if (!(ttlDays > 0)) throw new Error("ttlDays must be positive")
  const blocks = BigInt(Math.ceil((ttlDays * 86_400) / BLOCK_TIME_SECONDS))
  const base = pricing.price * blocks > pricing.minimumPerChunk ? pricing.price * blocks : pricing.minimumPerChunk
  const perChunk = (base * BigInt(100 + marginPercent)) / 100n
  return { perChunk, total: perChunk << BigInt(depth), depth, ttlDays: ttlSeconds(perChunk, pricing.price) / 86_400 }
}

export const ttlSeconds = (perChunk: bigint, price: bigint) => Number(perChunk / price) * BLOCK_TIME_SECONDS

export interface Call {
  to: Address
  functionName: string
  args: Record<string, string | number | boolean>
  data: Hex
}

/** The two transactions the human wallet sends: approve xBZZ, then create the immutable batch. */
export function purchaseCalls(owner: Address, q: Quote, nonce: Hex): { approve: Call; createBatch: Call } {
  return {
    approve: {
      to: XBZZ,
      functionName: "approve",
      args: { spender: POSTAGE_STAMP, amount: q.total.toString() },
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [POSTAGE_STAMP, q.total] }),
    },
    createBatch: {
      to: POSTAGE_STAMP,
      functionName: "createBatch",
      args: {
        _owner: owner,
        _initialBalancePerChunk: q.perChunk.toString(),
        _depth: q.depth,
        _bucketDepth: BUCKET_DEPTH,
        _nonce: nonce,
        _immutable: true,
      },
      data: encodeFunctionData({
        abi: postageStampAbi,
        functionName: "createBatch",
        args: [owner, q.perChunk, q.depth, BUCKET_DEPTH, nonce, true],
      }),
    },
  }
}

export interface BatchInfo {
  batchId: Hex
  owner: Address
  depth: number
  bucketDepth: number
  immutable: boolean
  /** xBZZ paid: balance per chunk × 2^depth. */
  totalAmount: bigint
  transactionHash: Hex
  blockNumber: bigint
}

/** What the release needs: our owner key, the planned depth and at least the quoted payment. */
export interface ExpectedBatch {
  owner: Address
  depth: number
  minTotal: bigint
}

/** Why `batch` can't hold the release; empty if it can. */
export function batchProblems(batch: BatchInfo, expected: ExpectedBatch): string[] {
  return [
    batch.owner.toLowerCase() !== expected.owner.toLowerCase() && `owner ${batch.owner} ≠ ${expected.owner}`,
    batch.depth !== expected.depth && `depth ${batch.depth} ≠ ${expected.depth}`,
    batch.bucketDepth !== BUCKET_DEPTH && `bucket depth ${batch.bucketDepth} ≠ ${BUCKET_DEPTH}`,
    !batch.immutable && "batch is mutable",
    batch.totalAmount < expected.minTotal && `paid ${batch.totalAmount} < ${expected.minTotal}`,
  ].filter((p): p is string => typeof p === "string")
}

/**
 * Finds the first batch created at or after `fromBlock` that can hold the
 * release. `_owner` is a plain `createBatch` parameter, so anyone who sees the
 * operator's pending purchase can create a batch for our owner first, e.g.
 * underfunded (the release would expire early) or with the wrong depth (the
 * release would abort). Every candidate is therefore checked in full; batches
 * for our owner that fail are skipped and reported via `onSkip`. A batch that
 * passes is as good as the operator's, whoever paid for it.
 *
 * The owner is not an indexed event field, so events are filtered
 * client-side; matching by owner (not transaction sender) also works for
 * relayed (ERC-4337) purchases.
 */
export async function findBatch(
  client: GnosisClient,
  expected: ExpectedBatch,
  fromBlock: bigint,
  onSkip: (batch: BatchInfo, problems: string[]) => void = () => {},
): Promise<BatchInfo | undefined> {
  const latest = await client.getBlockNumber()
  for (let start = fromBlock; start <= latest; start += 10_000n) {
    const end = start + 9_999n < latest ? start + 9_999n : latest
    const logs = await client.getLogs({
      address: POSTAGE_STAMP,
      event: postageStampAbi.find((x) => x.type === "event" && x.name === "BatchCreated")!,
      fromBlock: start,
      toBlock: end,
    })
    for (const log of logs) {
      const a = log.args
      if (a.owner?.toLowerCase() !== expected.owner.toLowerCase()) continue
      const batch: BatchInfo = {
        batchId: a.batchId!,
        owner: a.owner!,
        depth: a.depth!,
        bucketDepth: a.bucketDepth!,
        immutable: a.immutableFlag!,
        totalAmount: a.totalAmount!,
        transactionHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
      }
      const problems = batchProblems(batch, expected)
      if (problems.length === 0) return batch
      onSkip(batch, problems)
    }
  }
  return undefined
}

/**
 * Remaining lifetime of a batch at the current price; 0 once its balance is
 * used up. Throws if the batch is gone (see `isBatchGone`) or the lookup fails.
 */
export async function remainingTtl(client: GnosisClient, batchId: Hex): Promise<{ secondsLeft: number; expiresAt: Date }> {
  const [remaining, price] = await Promise.all([
    client.readContract({ address: POSTAGE_STAMP, abi: postageStampAbi, functionName: "remainingBalance", args: [batchId] }),
    client.readContract({ address: POSTAGE_STAMP, abi: postageStampAbi, functionName: "lastPrice" }),
  ])
  const secondsLeft = ttlSeconds(remaining, price)
  return { secondsLeft, expiresAt: new Date(Date.now() + secondsLeft * 1000) }
}
