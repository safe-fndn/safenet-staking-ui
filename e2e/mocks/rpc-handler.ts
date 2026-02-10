/**
 * JSON-RPC route handler for intercepting viem HTTP transport requests.
 * Handles both single and batched requests (viem uses batch: true).
 */

import type { Route } from "@playwright/test"
import { CHAIN_ID_HEX, BLOCK_NUMBER, GAS, MOCK_TX_HASH, STAKING_CONTRACT, TOKEN_CONTRACT } from "../fixtures/test-data"
import { buildCallResponses } from "./rpc-responses"
import { matchGetLogs } from "./event-logs"

/** Multicall3 contract address (same on all chains) */
const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11"
/** aggregate3 selector */
const AGGREGATE3_SELECTOR = "0x82ad56cb"

interface JsonRpcRequest {
  jsonrpc: string
  id: number | string
  method: string
  params?: unknown[]
}

interface JsonRpcResponse {
  jsonrpc: string
  id: number | string
  result?: unknown
  error?: { code: number; message: string }
}

/**
 * Decode and handle Multicall3 aggregate3 calls.
 * aggregate3 takes: Call3[] where Call3 = (address target, bool allowFailure, bytes callData)
 * Returns: Result[] where Result = (bool success, bytes returnData)
 *
 * ABI encoding:
 * - 0x82ad56cb (selector)
 * - offset to array (32 bytes)
 * - array length
 * - for each call: offset to tuple data
 * - for each tuple: target (32b), allowFailure (32b), offset to callData, callData length, callData bytes
 */
function handleMulticall3(data: string, callResponses: Map<string, (data: string) => string>): string {
  // Strip 0x prefix and selector
  const hex = data.slice(10)

  // Read offset to the array (first 32 bytes)
  const arrayOffset = parseInt(hex.slice(0, 64), 16) * 2 // convert byte offset to hex char offset
  // Read array length
  const arrayLength = parseInt(hex.slice(arrayOffset, arrayOffset + 64), 16)

  // Read offsets for each tuple (relative to array start)
  const tupleOffsets: number[] = []
  for (let i = 0; i < arrayLength; i++) {
    const offsetHex = hex.slice(arrayOffset + 64 + i * 64, arrayOffset + 128 + i * 64)
    tupleOffsets.push(parseInt(offsetHex, 16) * 2)
  }

  // Process each subcall
  const results: string[] = []
  for (let i = 0; i < arrayLength; i++) {
    const tupleStart = arrayOffset + 64 + tupleOffsets[i]

    // Read target address (first 32 bytes of tuple)
    const target = "0x" + hex.slice(tupleStart + 24, tupleStart + 64).toLowerCase()
    // Skip allowFailure (next 32 bytes)
    // Read offset to callData (next 32 bytes, relative to tuple start)
    const callDataOffset = parseInt(hex.slice(tupleStart + 128, tupleStart + 192), 16) * 2
    // Read callData length
    const callDataLength = parseInt(hex.slice(tupleStart + callDataOffset, tupleStart + callDataOffset + 64), 16) * 2
    // Read callData bytes
    const callData = "0x" + hex.slice(tupleStart + callDataOffset + 64, tupleStart + callDataOffset + 64 + callDataLength)

    // Look up the response handler
    const subSelector = callData.slice(0, 10).toLowerCase()
    const responseKey = `${target}:${subSelector}`
    const handler = callResponses.get(responseKey)

    let returnData: string
    if (handler) {
      returnData = handler(callData)
    } else {
      returnData = "0x" + "0".repeat(64)
    }

    results.push(returnData)
  }

  // Encode the aggregate3 return value: (bool success, bytes returnData)[]
  // ABI: offset to array, array length, then for each result: offset, (success bool, offset to bytes, bytes length, bytes data)
  let encoded = ""

  // Offset to the array data (32 bytes)
  encoded += "0".repeat(62) + "20" // offset = 32

  // Array length
  encoded += arrayLength.toString(16).padStart(64, "0")

  // Calculate offsets for each result tuple (relative to array data start)
  // Each result takes variable space, so compute offsets
  const resultEncodings: string[] = []
  for (const returnData of results) {
    const dataBytes = returnData.startsWith("0x") ? returnData.slice(2) : returnData
    // Tuple: success (32b) + offset to bytes (32b) + bytes length (32b) + bytes data (padded to 32b)
    const paddedData = dataBytes.padEnd(Math.ceil(dataBytes.length / 64) * 64, "0")
    let tupleEncoded = ""
    tupleEncoded += "0".repeat(63) + "1" // success = true
    tupleEncoded += "0".repeat(62) + "40" // offset to bytes = 64
    tupleEncoded += (dataBytes.length / 2).toString(16).padStart(64, "0") // bytes length
    tupleEncoded += paddedData // bytes data
    resultEncodings.push(tupleEncoded)
  }

  // Write offsets to each result tuple
  let currentOffset = arrayLength * 32 // past the offset array itself
  for (const resultEncoding of resultEncodings) {
    encoded += currentOffset.toString(16).padStart(64, "0")
    currentOffset += resultEncoding.length / 2
  }

  // Write each result tuple
  for (const resultEncoding of resultEncodings) {
    encoded += resultEncoding
  }

  return "0x" + encoded
}

export function createRpcHandler(userAddress?: string) {
  const callResponses = buildCallResponses(userAddress)

  function handleSingleRequest(req: JsonRpcRequest): JsonRpcResponse {
    const base = { jsonrpc: "2.0", id: req.id }

    switch (req.method) {
      case "eth_chainId":
        return { ...base, result: CHAIN_ID_HEX }

      case "net_version":
        return { ...base, result: "11155111" }

      case "eth_blockNumber":
        return { ...base, result: BLOCK_NUMBER }

      case "eth_getBlockByNumber":
        return {
          ...base,
          result: {
            number: BLOCK_NUMBER,
            timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
            hash: "0x" + "b".repeat(64),
            parentHash: "0x" + "c".repeat(64),
            gasLimit: "0x1c9c380",
            gasUsed: "0x0",
            baseFeePerGas: "0x3b9aca00",
            transactions: [],
          },
        }

      case "eth_call": {
        const params = req.params as [{ to: string; data: string }, string]
        if (!params || !params[0]) {
          return { ...base, error: { code: -32602, message: "Invalid params" } }
        }
        const { to, data } = params[0]
        const contractAddr = to.toLowerCase()
        const selector = data.slice(0, 10).toLowerCase()

        // Handle Multicall3 aggregate3 calls
        if (contractAddr === MULTICALL3 && selector === AGGREGATE3_SELECTOR) {
          return { ...base, result: handleMulticall3(data, callResponses) }
        }

        const responseKey = `${contractAddr}:${selector}`
        const handler = callResponses.get(responseKey)

        if (handler) {
          const result = handler(data)
          return { ...base, result }
        }

        // Log unmatched calls for debugging
        console.log(`[RPC] Unmatched eth_call: to=${contractAddr} selector=${selector} data=${data.slice(0, 20)}...`)

        // Fallback: return zeros for unknown calls
        return { ...base, result: "0x" + "0".repeat(64) }
      }

      case "eth_getLogs": {
        const params = req.params as [{ address?: string; topics?: (string | string[] | null)[]; fromBlock?: string; toBlock?: string }]
        if (!params || !params[0]) {
          return { ...base, result: [] }
        }
        const logs = matchGetLogs(params[0])
        return { ...base, result: logs }
      }

      case "eth_estimateGas":
        return { ...base, result: GAS.estimateGas }

      case "eth_gasPrice":
        return { ...base, result: GAS.gasPrice }

      case "eth_maxPriorityFeePerGas":
        return { ...base, result: "0x3b9aca00" }

      case "eth_feeHistory":
        return {
          ...base,
          result: {
            baseFeePerGas: ["0x3b9aca00", "0x3b9aca00"],
            gasUsedRatio: [0.5],
            oldestBlock: BLOCK_NUMBER,
            reward: [["0x3b9aca00"]],
          },
        }

      case "eth_sendRawTransaction":
        return { ...base, result: MOCK_TX_HASH }

      case "eth_getTransactionReceipt":
        return {
          ...base,
          result: {
            transactionHash: MOCK_TX_HASH,
            blockHash: "0x" + "bb".repeat(32),
            blockNumber: BLOCK_NUMBER,
            contractAddress: null,
            cumulativeGasUsed: "0x30d40",
            effectiveGasPrice: "0x3b9aca00",
            from: "0x" + "11".repeat(20),
            gasUsed: "0x30d40",
            logs: [],
            logsBloom: "0x" + "00".repeat(256),
            status: "0x1", // success
            to: "0x" + STAKING_CONTRACT.replace("0x", ""),
            transactionIndex: "0x0",
            type: "0x2",
          },
        }

      case "eth_getTransactionByHash":
        return {
          ...base,
          result: {
            hash: MOCK_TX_HASH,
            blockHash: "0x" + "bb".repeat(32),
            blockNumber: BLOCK_NUMBER,
            from: "0x" + "11".repeat(20),
            to: "0x" + STAKING_CONTRACT.replace("0x", ""),
            value: "0x0",
            gas: GAS.estimateGas,
            gasPrice: GAS.gasPrice,
            input: "0x",
            nonce: "0x1",
            transactionIndex: "0x0",
            type: "0x2",
            v: "0x0",
            r: "0x0",
            s: "0x0",
          },
        }

      case "eth_getBalance":
        return { ...base, result: "0x56BC75E2D63100000" } // 100 ETH

      case "eth_getCode":
        // Return non-empty code for contract addresses
        if (req.params) {
          const addr = (req.params[0] as string).toLowerCase()
          if (addr === STAKING_CONTRACT || addr === TOKEN_CONTRACT) {
            return { ...base, result: "0x6080" }
          }
          // Return empty code for Multicall3 so viem falls back to individual eth_call
          if (addr === MULTICALL3) {
            return { ...base, result: "0x" }
          }
        }
        return { ...base, result: "0x" }

      case "eth_getTransactionCount":
        return { ...base, result: "0x1" }

      default:
        return { ...base, result: "0x" }
    }
  }

  return async function handler(route: Route) {
    const request = route.request()
    const postData = request.postData()

    if (!postData) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }),
      })
      return
    }

    let body: JsonRpcRequest | JsonRpcRequest[]
    try {
      body = JSON.parse(postData)
    } catch {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }),
      })
      return
    }

    // Handle batch requests (viem sends arrays with batch: true)
    if (Array.isArray(body)) {
      const responses = body.map(handleSingleRequest)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responses),
      })
    } else {
      const response = handleSingleRequest(body)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      })
    }
  }
}
