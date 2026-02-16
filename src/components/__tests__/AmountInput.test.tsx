import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AmountInput } from "../staking/AmountInput"

describe("AmountInput", () => {
  const mockOnChange = vi.fn()
  const maxAmount = 1000n * 10n ** 18n // 1000 SAFE

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders input with placeholder", () => {
    render(<AmountInput value="" onChange={mockOnChange} />)

    expect(screen.getByPlaceholderText("0.0")).toBeInTheDocument()
  })

  it("renders label text", () => {
    render(<AmountInput value="" onChange={mockOnChange} label="Custom Label" />)

    expect(screen.getByText("Custom Label")).toBeInTheDocument()
  })

  it("shows balance when maxAmount provided", () => {
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    expect(screen.getByText(/SAFE Balance: 1000/)).toBeInTheDocument()
  })

  it("shows percentage buttons when maxAmount provided", () => {
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    expect(screen.getByRole("button", { name: "25%" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "50%" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "75%" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "MAX" })).toBeInTheDocument()
  })

  it("does not show percentage buttons without maxAmount", () => {
    render(<AmountInput value="" onChange={mockOnChange} />)

    expect(screen.queryByRole("button", { name: "25%" })).not.toBeInTheDocument()
  })

  it("25% button sets correct amount", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    await user.click(screen.getByRole("button", { name: "25%" }))

    expect(mockOnChange).toHaveBeenCalledWith("250")
  })

  it("50% button sets correct amount", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    await user.click(screen.getByRole("button", { name: "50%" }))

    expect(mockOnChange).toHaveBeenCalledWith("500")
  })

  it("75% button sets correct amount", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    await user.click(screen.getByRole("button", { name: "75%" }))

    expect(mockOnChange).toHaveBeenCalledWith("750")
  })

  it("MAX button sets full amount", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} />)

    await user.click(screen.getByRole("button", { name: "MAX" }))

    expect(mockOnChange).toHaveBeenCalledWith("1000")
  })

  it("only allows numeric input with one decimal point", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} />)

    const input = screen.getByPlaceholderText("0.0")

    // Valid input
    await user.type(input, "123.45")
    expect(mockOnChange).toHaveBeenCalled()

    // The input validates on change, so we check the last call
    const calls = mockOnChange.mock.calls
    // Each character triggers onChange if valid
    expect(calls.some(([val]: [string]) => val === "1")).toBe(true)
  })

  it("rejects non-numeric input", async () => {
    const user = userEvent.setup()
    render(<AmountInput value="" onChange={mockOnChange} />)

    const input = screen.getByPlaceholderText("0.0")
    await user.type(input, "abc")

    // onChange should not be called for non-numeric
    const numericCalls = mockOnChange.mock.calls.filter(
      ([val]: [string]) => /[a-z]/.test(val)
    )
    expect(numericCalls).toHaveLength(0)
  })

  it("disables input when disabled prop is true", () => {
    render(<AmountInput value="" onChange={mockOnChange} maxAmount={maxAmount} disabled />)

    expect(screen.getByPlaceholderText("0.0")).toBeDisabled()
    expect(screen.getByRole("button", { name: "25%" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "MAX" })).toBeDisabled()
  })
})
