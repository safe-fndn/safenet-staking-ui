import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConnectButton } from "../wallet/ConnectButton"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSwitchChain = vi.fn()
const mockUseAccount = vi.fn()
const mockUseConnect = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useConnect: () => mockUseConnect(),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useSwitchChain: () => ({ switchChain: mockSwitchChain }),
}))

vi.mock("@/hooks/useTokenBalance", () => ({
  useTokenBalance: vi.fn(() => ({ data: 1000n * 10n ** 18n })),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

vi.mock("@/config/chains", () => ({
  activeChain: { id: 11155111, name: "Sepolia" },
}))

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [
        { id: "browserWallet", uid: "bw-1", name: "Browser Wallet" },
      ],
      error: null,
    })
  })

  it("shows Connect Wallet button when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false, address: undefined, chain: undefined })

    render(<ConnectButton />)

    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument()
  })

  it("connects directly with single connector on click", async () => {
    mockUseAccount.mockReturnValue({ isConnected: false, address: undefined, chain: undefined })
    const user = userEvent.setup()

    render(<ConnectButton />)

    await user.click(screen.getByRole("button", { name: "Connect Wallet" }))

    expect(mockConnect).toHaveBeenCalledWith({
      connector: { id: "browserWallet", uid: "bw-1", name: "Browser Wallet" },
    })
  })

  it("shows switch chain button when on wrong chain", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: TEST_ACCOUNTS.user,
      chain: { id: 1 }, // mainnet instead of sepolia
    })

    render(<ConnectButton />)

    expect(screen.getByRole("button", { name: "Switch to Sepolia" })).toBeInTheDocument()
  })

  it("shows address and balance when connected on correct chain", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: TEST_ACCOUNTS.user,
      chain: { id: 11155111 },
    })

    render(<ConnectButton />)

    expect(screen.getByText(/1000/)).toBeInTheDocument() // balance
    expect(screen.getByText(/0x1111...1111/)).toBeInTheDocument() // truncated address
  })

  it("shows Disconnect button when connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: TEST_ACCOUNTS.user,
      chain: { id: 11155111 },
    })

    render(<ConnectButton />)

    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument()
  })

  it("calls disconnect on button click", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: TEST_ACCOUNTS.user,
      chain: { id: 11155111 },
    })
    const user = userEvent.setup()

    render(<ConnectButton />)

    await user.click(screen.getByRole("button", { name: "Disconnect" }))
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
