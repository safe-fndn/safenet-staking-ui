import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ValidatorControls } from "../validators/ValidatorControls"

describe("ValidatorControls", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
  }

  it("renders search input", () => {
    render(<ValidatorControls {...defaultProps} />)

    expect(screen.getByPlaceholderText("Search by name or address…")).toBeInTheDocument()
  })

  it("calls onSearchChange when typing", async () => {
    const onSearchChange = vi.fn()
    const user = userEvent.setup()

    render(<ValidatorControls {...defaultProps} onSearchChange={onSearchChange} />)

    await user.type(screen.getByPlaceholderText("Search by name or address…"), "gnosis")

    expect(onSearchChange).toHaveBeenCalled()
  })
})
