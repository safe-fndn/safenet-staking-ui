import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import {
  useTotalStaked,
  useTotalPendingWithdrawals,
  useWithdrawDelay,
  useUserTotalStake,
  useUserStakeOnValidator,
  useValidatorTotalStake,
  useUserStakesOnValidators,
  useValidatorTotalStakes,
} from "../useStakingReads"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockUseReadContract = vi.fn()
const mockUseReadContracts = vi.fn()
const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
  useAccount: () => mockUseAccount(),
}))

describe("useStakingReads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: true })
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: true })
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
  })

  describe("useTotalStaked", () => {
    it("calls useReadContract with totalStakedAmount", () => {
      renderHook(() => useTotalStaked())

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "totalStakedAmount",
          query: expect.objectContaining({ refetchInterval: 30_000 }),
        })
      )
    })
  })

  describe("useTotalPendingWithdrawals", () => {
    it("calls useReadContract with totalPendingWithdrawals", () => {
      renderHook(() => useTotalPendingWithdrawals())

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "totalPendingWithdrawals",
        })
      )
    })
  })

  describe("useWithdrawDelay", () => {
    it("calls useReadContract with withdrawDelay and no polling", () => {
      renderHook(() => useWithdrawDelay())

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "withdrawDelay",
        })
      )
    })
  })

  describe("useUserTotalStake", () => {
    it("passes user address as arg when connected", () => {
      renderHook(() => useUserTotalStake())

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "totalStakerStakes",
          args: [TEST_ACCOUNTS.user],
          query: expect.objectContaining({ enabled: true }),
        })
      )
    })

    it("disables query when no address", () => {
      mockUseAccount.mockReturnValue({ address: undefined })

      renderHook(() => useUserTotalStake())

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "totalStakerStakes",
          args: undefined,
          query: expect.objectContaining({ enabled: false }),
        })
      )
    })
  })

  describe("useUserStakeOnValidator", () => {
    it("passes user address and validator as args", () => {
      renderHook(() => useUserStakeOnValidator(TEST_ACCOUNTS.validator1))

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "stakes",
          args: [TEST_ACCOUNTS.user, TEST_ACCOUNTS.validator1],
          query: expect.objectContaining({ enabled: true }),
        })
      )
    })

    it("disables query when disconnected", () => {
      mockUseAccount.mockReturnValue({ address: undefined })

      renderHook(() => useUserStakeOnValidator(TEST_ACCOUNTS.validator1))

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "stakes",
          args: undefined,
          query: expect.objectContaining({ enabled: false }),
        })
      )
    })
  })

  describe("useValidatorTotalStake", () => {
    it("passes validator address", () => {
      renderHook(() => useValidatorTotalStake(TEST_ACCOUNTS.validator1))

      expect(mockUseReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "totalValidatorStakes",
          args: [TEST_ACCOUNTS.validator1],
        })
      )
    })
  })

  describe("useUserStakesOnValidators", () => {
    it("creates contracts array for multiple validators", () => {
      const validators = [TEST_ACCOUNTS.validator1, TEST_ACCOUNTS.validator2]
      renderHook(() => useUserStakesOnValidators(validators))

      expect(mockUseReadContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: expect.arrayContaining([
            expect.objectContaining({
              functionName: "stakes",
              args: [TEST_ACCOUNTS.user, TEST_ACCOUNTS.validator1],
            }),
          ]),
          query: expect.objectContaining({ enabled: true }),
        })
      )
    })

    it("disables when no address", () => {
      mockUseAccount.mockReturnValue({ address: undefined })

      renderHook(() => useUserStakesOnValidators([TEST_ACCOUNTS.validator1]))

      expect(mockUseReadContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ enabled: false }),
        })
      )
    })

    it("disables when validators array is empty", () => {
      renderHook(() => useUserStakesOnValidators([]))

      expect(mockUseReadContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ enabled: false }),
        })
      )
    })
  })

  describe("useValidatorTotalStakes", () => {
    it("creates contracts array for validators", () => {
      const validators = [TEST_ACCOUNTS.validator1, TEST_ACCOUNTS.validator2]
      renderHook(() => useValidatorTotalStakes(validators))

      expect(mockUseReadContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          contracts: expect.arrayContaining([
            expect.objectContaining({
              functionName: "totalValidatorStakes",
              args: [TEST_ACCOUNTS.validator1],
            }),
          ]),
          query: expect.objectContaining({ enabled: true }),
        })
      )
    })

    it("disables when validators array is empty", () => {
      renderHook(() => useValidatorTotalStakes([]))

      expect(mockUseReadContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ enabled: false }),
        })
      )
    })
  })
})
