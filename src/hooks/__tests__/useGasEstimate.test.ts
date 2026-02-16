import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { Address } from "viem"

const mockEstimateGas = vi.fn()
const mockGetGasPrice = vi.fn()

vi.mock("wagmi", () => ({
  usePublicClient: vi.fn(() => ({
    estimateGas: mockEstimateGas,
    getGasPrice: mockGetGasPrice,
  })),
  useAccount: vi.fn(() => ({
    address: "0x1111111111111111111111111111111111111111",
  })),
}))

const { useGasEstimate } = await import("../useGasEstimate")

const VALIDATOR = "0x1234567890abcdef1234567890abcdef12345678" as Address
const AMOUNT = 100n * 10n ** 18n

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForMockCall(mock: ReturnType<typeof vi.fn>, timeout = 3000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (mock.mock.calls.length > 0) return
    await act(async () => { await delay(50) })
  }
  throw new Error(`Mock not called within ${timeout}ms`)
}

describe("useGasEstimate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null and not loading for zero amount", () => {
    const { result } = renderHook(() => useGasEstimate("stake", VALIDATOR, 0n))

    expect(result.current.estimatedCost).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockEstimateGas).not.toHaveBeenCalled()
  })

  it("calls estimateGas and getGasPrice in parallel after debounce", async () => {
    mockEstimateGas.mockResolvedValue(200_000n)
    mockGetGasPrice.mockResolvedValue(1_000_000_000n)

    renderHook(() => useGasEstimate("stake", VALIDATOR, AMOUNT))

    // estimateGas not called immediately (debounced)
    expect(mockEstimateGas).not.toHaveBeenCalled()

    // Wait for the 500ms debounce to fire
    await waitForMockCall(mockEstimateGas)

    expect(mockEstimateGas).toHaveBeenCalledTimes(1)
    expect(mockGetGasPrice).toHaveBeenCalledTimes(1)

    // Verify estimateGas was called with correct params
    expect(mockEstimateGas).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "0x1111111111111111111111111111111111111111",
      })
    )
  })

  it("handles estimation failure gracefully", async () => {
    mockEstimateGas.mockRejectedValue(new Error("execution reverted"))
    mockGetGasPrice.mockResolvedValue(1_000_000_000n)

    const { result } = renderHook(() => useGasEstimate("stake", VALIDATOR, AMOUNT))

    await waitForMockCall(mockEstimateGas)

    // Allow async catch/finally to run
    await act(async () => { await delay(50) })

    // Should not throw, estimatedCost stays null
    expect(result.current.estimatedCost).toBeNull()
  })

  it("debounces rapid amount changes — only calls once", async () => {
    mockEstimateGas.mockResolvedValue(200_000n)
    mockGetGasPrice.mockResolvedValue(1_000_000_000n)

    const { rerender } = renderHook(
      ({ amount }: { amount: bigint }) => useGasEstimate("stake", VALIDATOR, amount),
      { initialProps: { amount: 10n * 10n ** 18n } }
    )

    // Rapidly change amounts (all within 500ms debounce window)
    rerender({ amount: 50n * 10n ** 18n })
    rerender({ amount: 100n * 10n ** 18n })

    await waitForMockCall(mockEstimateGas)

    // Only called once despite 3 different amounts
    expect(mockEstimateGas).toHaveBeenCalledTimes(1)
  })

  it("does not estimate when client or address is missing", async () => {
    const wagmi = vi.mocked(await import("wagmi"))

    wagmi.useAccount.mockReturnValue({ address: undefined } as ReturnType<typeof wagmi.useAccount>)

    const { result } = renderHook(() => useGasEstimate("stake", VALIDATOR, AMOUNT))

    expect(result.current.estimatedCost).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockEstimateGas).not.toHaveBeenCalled()
  })
})
