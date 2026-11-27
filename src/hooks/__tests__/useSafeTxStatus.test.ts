import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { getSafeAppsSdk, resetSafeAppsSdk, useSafeTxStatus } from "../useSafeTxStatus"

const getTransactionReceipt = vi.fn()
vi.mock("wagmi", () => ({
  usePublicClient: () => ({ getTransactionReceipt }),
}))

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
}
const newClient = () => new QueryClient()

type Tx = Awaited<ReturnType<Parameters<typeof useSafeTxStatus>[1] & {}>>
const tx = (fields: Partial<Tx>) => async () => fields as Tx

beforeEach(() => {
  vi.clearAllMocks()
  resetSafeAppsSdk()
})

describe("useSafeTxStatus", () => {
  it("reports pending while the Safe transaction awaits signatures or execution", async () => {
    const fetchTx = vi.fn(tx({ txStatus: "AWAITING_EXECUTION" as Tx["txStatus"] }))
    const { result } = renderHook(() => useSafeTxStatus("0x5afe", fetchTx), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(fetchTx).toHaveBeenCalledWith("0x5afe"))
    expect(result.current).toEqual({ status: "pending" })
  })

  it("reports the execution block once the Safe transaction succeeded", async () => {
    getTransactionReceipt.mockResolvedValue({ blockNumber: 105n })
    const fetchTx = tx({ txStatus: "SUCCESS" as Tx["txStatus"], txHash: "0xabc" })
    const { result } = renderHook(() => useSafeTxStatus("0x5afe", fetchTx), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current).toEqual({ status: "executed", blockNumber: 105n }))
    expect(getTransactionReceipt).toHaveBeenCalledWith({ hash: "0xabc" })
  })

  it.each(["FAILED", "CANCELLED"])("reports dropped for %s", async (txStatus) => {
    const fetchTx = tx({ txStatus: txStatus as Tx["txStatus"] })
    const { result } = renderHook(() => useSafeTxStatus("0x5afe", fetchTx), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current).toEqual({ status: "dropped" }))
  })

  it("fails closed (pending) when the lookup errors", async () => {
    const fetchTx = vi.fn(async () => {
      throw new Error("not in Safe")
    })
    const { result } = renderHook(() => useSafeTxStatus("0x5afe", fetchTx), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(fetchTx).toHaveBeenCalled())
    expect(result.current).toEqual({ status: "pending" })
  })

  it("does nothing without a hash", () => {
    const fetchTx = vi.fn()
    const { result } = renderHook(() => useSafeTxStatus(undefined, fetchTx), { wrapper: wrapperFor(newClient()) })
    expect(fetchTx).not.toHaveBeenCalled()
    expect(result.current).toEqual({ status: "pending" })
  })
})

describe("getSafeAppsSdk", () => {
  it("creates one SDK instance (one message listener) for every lookup", async () => {
    const constructed = vi.fn()
    class FakeSDK {
      constructor() {
        constructed()
        window.addEventListener("message", () => {})
      }
    }
    const load = vi.fn(async () => ({ default: FakeSDK }) as never)
    const add = vi.spyOn(window, "addEventListener")

    const instances = await Promise.all([getSafeAppsSdk(load), getSafeAppsSdk(load), getSafeAppsSdk(load)])
    await getSafeAppsSdk(load)

    expect(new Set(instances).size).toBe(1)
    expect(constructed).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
    expect(add.mock.calls.filter(([type]) => type === "message")).toHaveLength(1)
    add.mockRestore()
  })

  it("retries loading after a failed load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("chunk failed")).mockResolvedValue({ default: class {} })
    await expect(getSafeAppsSdk(load)).rejects.toThrow(/chunk failed/)
    await expect(getSafeAppsSdk(load)).resolves.toBeDefined()
    expect(load).toHaveBeenCalledTimes(2)
  })
})
