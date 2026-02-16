import { describe, it, expect } from "vitest"
import { formatContractError } from "../errorFormat"

describe("formatContractError", () => {
  it("returns 'Transaction rejected' for user rejection", () => {
    expect(formatContractError(new Error("User rejected the request"))).toBe("Transaction rejected")
  })

  it("returns 'Transaction rejected' for lowercase user rejected", () => {
    expect(formatContractError(new Error("user rejected transaction"))).toBe("Transaction rejected")
  })

  it("returns user-friendly message for known custom error (reverted with custom error)", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'InvalidAmount()'"))
    ).toBe("Amount must be greater than zero")
  })

  it("returns user-friendly message for NotValidator", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'NotValidator()'"))
    ).toBe("This validator is not registered")
  })

  it("returns user-friendly message for InsufficientStake", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'InsufficientStake()'"))
    ).toBe("Insufficient delegation balance")
  })

  it("returns error name for unknown custom error", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'UnknownError()'"))
    ).toBe("UnknownError")
  })

  it("handles signature-based custom error name", () => {
    expect(
      formatContractError(new Error("error InvalidAmount()"))
    ).toBe("Amount must be greater than zero")
  })

  it("returns revert reason for reason string", () => {
    expect(
      formatContractError(new Error("reverted with the following reason:\n  Something went wrong"))
    ).toBe("Something went wrong")
  })

  it("returns gas error for insufficient funds", () => {
    expect(
      formatContractError(new Error("insufficient funds for gas * price + value"))
    ).toBe("Insufficient ETH for gas fees")
  })

  it("returns gas error for exceeds balance", () => {
    expect(
      formatContractError(new Error("exceeds the balance of the account"))
    ).toBe("Insufficient ETH for gas fees")
  })

  it("returns network error for timeout", () => {
    expect(
      formatContractError(new Error("request timed out: ETIMEDOUT"))
    ).toBe("Network error — please try again")
  })

  it("returns network error for connection refused", () => {
    expect(
      formatContractError(new Error("ECONNREFUSED"))
    ).toBe("Network error — please try again")
  })

  it("returns network error for disconnected", () => {
    expect(
      formatContractError(new Error("disconnected from chain"))
    ).toBe("Network error — please try again")
  })

  it("returns generic fallback for unknown errors", () => {
    expect(
      formatContractError(new Error("some random internal error"))
    ).toBe("An unexpected error occurred. Please try again.")
  })

  it("returns generic fallback for empty message", () => {
    expect(formatContractError(new Error(""))).toBe("An unexpected error occurred. Please try again.")
  })

  it("handles WithdrawalQueueEmpty custom error", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'WithdrawalQueueEmpty()'"))
    ).toBe("No pending withdrawals to claim")
  })

  it("handles NoClaimableWithdrawal custom error", () => {
    expect(
      formatContractError(new Error("reverted with custom error 'NoClaimableWithdrawal()'"))
    ).toBe("No withdrawal is ready to claim yet")
  })
})
