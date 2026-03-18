import { describe, it, expect } from "vitest"
import { formatTokenAmount, truncateAddress, formatCountdown } from "../format"

describe("formatTokenAmount", () => {
  it("formats zero", () => {
    expect(formatTokenAmount(0n)).toBe("0")
  })

  it("formats a whole number (no decimals)", () => {
    expect(formatTokenAmount(1000n * 10n ** 18n)).toBe("1,000")
  })

  it("formats with decimals truncated to maxDecimals", () => {
    // 1.123456789... SAFE
    const amount = 1_123456789012345678n
    expect(formatTokenAmount(amount)).toBe("1.1234")
  })

  it("respects custom maxDecimals", () => {
    const amount = 1_123456789012345678n
    expect(formatTokenAmount(amount, 18, 2)).toBe("1.12")
  })

  it("formats with maxDecimals=0 returns whole number only", () => {
    const amount = 1_500000000000000000n
    expect(formatTokenAmount(amount, 18, 0)).toBe("1")
  })

  it("formats large numbers (>1M)", () => {
    const amount = 1_000_000n * 10n ** 18n
    expect(formatTokenAmount(amount)).toBe("1,000,000")
  })

  it("formats small decimals", () => {
    // 0.0001 SAFE
    const amount = 100000000000000n
    expect(formatTokenAmount(amount)).toBe("0.0001")
  })

  it("formats with custom decimals (e.g. 6)", () => {
    // 1.5 USDC (6 decimals)
    const amount = 1_500000n
    expect(formatTokenAmount(amount, 6, 2)).toBe("1.5")
  })
})

describe("truncateAddress", () => {
  it("truncates a standard 42-char address", () => {
    expect(truncateAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678")
  })

  it("lowercases checksummed addresses", () => {
    expect(truncateAddress("0xABcdEF1234567890abcdef1234567890AbCdEf12")).toBe("0xabcd...ef12")
  })

  it("handles a short string", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234...1234")
  })
})

describe("formatCountdown", () => {
  it("returns 'Ready' for 0 seconds", () => {
    expect(formatCountdown(0)).toBe("Ready")
  })

  it("returns 'Ready' for negative seconds", () => {
    expect(formatCountdown(-10)).toBe("Ready")
  })

  it("formats seconds only", () => {
    expect(formatCountdown(45)).toBe("45s")
  })

  it("formats minutes and seconds", () => {
    expect(formatCountdown(125)).toBe("2m 5s")
  })

  it("formats hours, minutes, and seconds", () => {
    expect(formatCountdown(3661)).toBe("1h 1m 1s")
  })

  it("formats days, hours, and minutes", () => {
    expect(formatCountdown(90061)).toBe("1d 1h 1m")
  })

  it("formats exactly 7 days (withdrawal delay)", () => {
    expect(formatCountdown(604800)).toBe("7d 0h 0m")
  })
})
