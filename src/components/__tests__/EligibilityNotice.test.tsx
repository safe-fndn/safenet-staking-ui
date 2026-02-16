import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { EligibilityNotice } from "../dashboard/EligibilityNotice"

describe("EligibilityNotice", () => {
  it("renders notice with info text and link", () => {
    render(<EligibilityNotice />)

    expect(screen.getByText(/Rewards are subject to a minimum payout threshold/)).toBeInTheDocument()
    expect(screen.getByText("Learn more")).toBeInTheDocument()
    expect(screen.getByText(/KYC may be required/)).toBeInTheDocument()
  })
})
