import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TokenAmount } from "../ui/TokenAmount"
import { formatDisplayAmount } from "@/lib/format"

const SAFE = 10n ** 18n

describe("formatDisplayAmount", () => {
  it("uses maxDecimals for amounts of 1 or more", () => {
    expect(formatDisplayAmount(1234n * SAFE + SAFE / 2n, 18, 0)).toBe("1,234")
  })

  it("never shows a nonzero amount below 1 as 0", () => {
    expect(formatDisplayAmount((9n * SAFE) / 10n, 18, 0)).toBe("0.9")
    expect(formatDisplayAmount(SAFE / 100n, 18, 0)).toBe("0.01")
  })

  it("shows dust as <0.0001", () => {
    expect(formatDisplayAmount(1n, 18, 0)).toBe("<0.0001")
  })

  it("shows zero as 0", () => {
    expect(formatDisplayAmount(0n, 18, 0)).toBe("0")
  })
})

describe("TokenAmount", () => {
  it("renders plain text without a tooltip when nothing is cut off", () => {
    const { container } = render(<TokenAmount amount={5n * SAFE} suffix="SAFE" />)
    expect(screen.getByText("5 SAFE")).toBeInTheDocument()
    expect(container.querySelector(".sr-only")).toBeNull()
  })

  it("shows the exact amount in a tooltip on hover", async () => {
    const amount = 1234n * SAFE + 123456789n
    render(<TokenAmount amount={amount} maxDecimals={0} suffix="SAFE" />)

    const trigger = screen.getByText("1,234 SAFE")
    expect(trigger).toHaveAttribute("aria-hidden", "true")
    // Screen readers read the exact amount; no extra tab stop.
    expect(screen.getByText("1,234.000000000123456789 SAFE")).toHaveClass("sr-only")
    expect(trigger.closest("[tabindex]")).toBeNull()

    await userEvent.hover(trigger)
    expect(
      (await screen.findAllByText("1,234.000000000123456789 SAFE")).length,
    ).toBeGreaterThan(0)
  })
})
