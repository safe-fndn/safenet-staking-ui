import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { WithdrawalsPage } from "../WithdrawalsPage"

vi.mock("@/components/withdrawals/WithdrawalQueue", () => ({
  WithdrawalQueue: () => <div data-testid="withdrawal-queue">WithdrawalQueue</div>,
}))

describe("WithdrawalsPage", () => {
  it("renders heading and description", () => {
    render(<WithdrawalsPage />)

    expect(screen.getByText("Withdrawals")).toBeInTheDocument()
    expect(screen.getByText(/Manage your pending withdrawals/)).toBeInTheDocument()
  })

  it("renders WithdrawalQueue", () => {
    render(<WithdrawalsPage />)

    expect(screen.getByTestId("withdrawal-queue")).toBeInTheDocument()
  })
})
