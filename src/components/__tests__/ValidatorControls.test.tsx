import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ValidatorControls } from "../validators/ValidatorControls"

describe("ValidatorControls", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    statusFilter: "all" as const,
    onStatusFilterChange: vi.fn(),
  }

  it("renders search input and filter buttons", () => {
    render(<ValidatorControls {...defaultProps} />)

    expect(screen.getByPlaceholderText("Search by name or address…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Inactive" })).toBeInTheDocument()
  })

  it("calls onSearchChange when typing", async () => {
    const onSearchChange = vi.fn()
    const user = userEvent.setup()

    render(<ValidatorControls {...defaultProps} onSearchChange={onSearchChange} />)

    await user.type(screen.getByPlaceholderText("Search by name or address…"), "gnosis")

    expect(onSearchChange).toHaveBeenCalled()
  })

  it("calls onStatusFilterChange when clicking filter", async () => {
    const onStatusFilterChange = vi.fn()
    const user = userEvent.setup()

    render(<ValidatorControls {...defaultProps} onStatusFilterChange={onStatusFilterChange} />)

    await user.click(screen.getByRole("button", { name: "Active" }))
    expect(onStatusFilterChange).toHaveBeenCalledWith("active")
  })
})
