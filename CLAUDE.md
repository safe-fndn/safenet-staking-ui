# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Dev server:** `npm run dev`
- **Lint:** `npm run lint`
- **Type check only:** `npx tsc --noEmit`
- **Preview production build:** `npm run preview`
- **Run unit/integration tests:** `npm test` (vitest run)
- **Watch mode:** `npm run test:watch`
- **Coverage:** `npm run test:coverage`

## Pre-push Checklist

Before pushing code to the remote, always run these checks in order and fix any failures:

1. `npm run lint` — ESLint must pass with zero errors
2. `npm test` — All unit/integration tests must pass
3. `npm run build` — Production build must succeed (includes `tsc -b`)

## Architecture

Safenet Staking UI is a React 19 + TypeScript dApp for delegating SAFE tokens to validators on Ethereum. It uses Vite 7, Tailwind CSS 4 (via `@tailwindcss/vite`), wagmi 3 / viem for wallet and contract interactions, and recharts for data visualization.

### Provider Stack (src/main.tsx)

`StrictMode` → `WagmiProvider` → `QueryClientProvider` → `TooltipProvider` → `ToastProvider` → `App`

All wagmi hooks, React Query, Radix tooltip context, and toast context are available throughout the app.

### Routing (src/App.tsx)

Five routes under a shared `Layout` (header + footer + `<Outlet />`):
- `/` → `DashboardPage` (stats, onboarding, claimable banner, quick actions, rewards, calculator, stake distribution chart, portfolio breakdown, positions, transaction history)
- `/validators` → `ValidatorsPage` (search/filter/sort controls, validator cards with delegate/undelegate; supports `?delegate=0x...` deep-link to auto-open delegate dialog)
- `/validators/:address` → `ValidatorDetailPage` (full validator info, delegate/undelegate buttons, filtered transaction history)
- `/withdrawals` → `WithdrawalsPage` (pending withdrawal queue with FIFO tooltip, cooldown progress bars, claim)
- `*` → `NotFoundPage` (404 catch-all)

App-level guards: `useSanctionsCheck` blocks the entire app if `VITE_SANCTIONS_API_URL` returns 403. `DisconnectWatcher` shows a toast on wallet disconnect.

### Contract Integration

- **Config layer:** `src/config/chains.ts` resolves chain from `VITE_CHAIN_ID`, `src/config/contracts.ts` maps chain IDs to staking/token contract addresses.
- **ABIs:** `src/abi/stakingAbi.ts` (staking contract) and `src/abi/erc20Abi.ts` (SAFE token). ABIs use viem's `parseAbi` with human-readable signatures.
- **Read hooks** (`src/hooks/useStakingReads.ts`): Thin wrappers around wagmi's `useReadContract`/`useReadContracts`. Per-user hooks guard with `query: { enabled: !!address }`. All hooks poll every 15 seconds via `refetchInterval: 15_000`.
- **Write hooks** (`src/hooks/useStakingWrites.ts`): Each write hook (`useStake`, `useInitiateWithdrawal`, `useClaimWithdrawal`) combines `useWriteContract` + `useWaitForTransactionReceipt` and returns a unified `{ action, isPending, isSuccess, error, reset, txHash }` interface.
- **Validator discovery** (`src/hooks/useValidators.ts`): Fetches `ValidatorUpdated` events from deploy block to latest via `getLogs`, with automatic chunked fallback for RPC block-range limits. Returns `ValidatorInfo[]` with `{ address, isActive }` sorted active-first.
- **Transaction history** (`src/hooks/useTransactionHistory.ts`): Fetches `StakeIncreased`, `WithdrawalInitiated`, and `WithdrawalClaimed` events for the connected user. Supports optional validator filter. Uses same chunked log fetching pattern. Returns last 50 transactions sorted by block number descending.
- **Gas estimation** (`src/hooks/useGasEstimate.ts`): Uses `estimateGas` + `getGasPrice` from viem to show estimated gas cost in delegate/undelegate dialogs. Debounced 500ms on amount change.
- **Rewards estimate** (`src/hooks/useRewardsEstimate.ts`): Pure client-side APR calculator (no contract calls). Returns daily/weekly/monthly/yearly estimates.

### Terminology

The UI uses "delegation" terminology externally (Delegate/Undelegate) but the smart contract uses "stake" terminology. Hook and contract function names reflect the contract (`useStake`, `stake()`), while component labels say "Delegate"/"Undelegate".

### Validator Metadata

`src/data/validators.json` is a static address→metadata map (label, commission, uptime). `useValidatorMetadata(address)` does a case-insensitive lookup. Unknown validators fall back to truncated address display.

### Placeholder Systems

- **Rewards** (`src/hooks/useRewards.ts`): Returns mock data. TODO: integrate with Merkle drop contract.
- **Sanctions** (`src/hooks/useSanctionsCheck.ts`): Fetches `VITE_SANCTIONS_API_URL` on mount; no-op if env var is unset.

### UI Components

Radix UI primitives (`dialog`, `tabs`, `tooltip`, `slot`) wrapped in `src/components/ui/` using CVA + tailwind-merge (`cn()` from `src/lib/utils.ts`). These follow shadcn/ui conventions.

Key UI components:
- `button.tsx` — CVA button with variants (default, destructive, outline, secondary, ghost, link) and sizes
- `card.tsx` — Compound card components (Card, CardHeader, CardTitle, CardContent, etc.)
- `dialog.tsx` — Radix Dialog with overlay animations
- `tabs.tsx` — Radix Tabs (used in transaction history)
- `tooltip.tsx` — Radix Tooltip (used for FIFO queue info, etc.)
- `progress.tsx` — Progress bar with size (default, sm, lg) and variant (default, success, warning) props
- `stepper.tsx` — Horizontal step indicator with circles + connecting lines (used in DelegateDialog for Approve → Delegate → Done flow)
- `badge.tsx`, `input.tsx`, `skeleton.tsx` — Standard primitives

### Utility Libraries

- `src/lib/utils.ts` — `cn()` for class merging (clsx + tailwind-merge)
- `src/lib/format.ts` — `formatTokenAmount`, `truncateAddress`, `formatCountdown`, `formatTimestamp`
- `src/lib/errorFormat.ts` — `formatContractError` for user-friendly contract error messages
- `src/lib/clipboard.ts` — `copyToClipboard()` with navigator.clipboard API + textarea fallback

### Dashboard Components

- `StatsOverview` — Grid of stat cards (total delegated, user delegation, active validators, unstaking count, pending withdrawal total)
- `ClaimableBanner` — Dismissible banner when a withdrawal is ready to claim (uses `useNextClaimable`)
- `QuickActions` — Delegate/Undelegate/Claim navigation buttons (visible when connected)
- `OnboardingBanner` — First-time visitor card (3 steps), dismissible via localStorage key `onboarding_dismissed`
- `EligibilityNotice` — Rewards cap info box
- `RewardsSection` — Claimable SAFE, weekly cap progress, claim button (coming soon)
- `RewardsCalculator` — Configurable amount/APR inputs with estimated daily/weekly/monthly/yearly rewards
- `StakeDistribution` — Recharts donut chart showing delegation distribution (only renders with 2+ validators)
- `PortfolioBreakdown` — Per-validator delegation table with amounts and percentages
- `UserPositions` — List of active delegations per validator
- `TransactionHistory` — Tabbed (All/Delegations/Withdrawals) log of past contract events with explorer links

### Validator Components

- `ValidatorControls` — Search input, Active/Inactive/All filter buttons, sort dropdown (Total Stake/Commission/Uptime)
- `ValidatorList` — Grid of ValidatorCards with controls integration. Accepts optional `autoOpenDelegate` prop for deep-linking.
- `ValidatorCard` — Per-validator card with metadata, stakes, delegate/undelegate buttons, copy address, and link to detail page

### Staking Components

- `AmountInput` — Input with 25%/50%/75%/MAX percentage shortcut buttons
- `DelegateDialog` — Multi-step dialog with stepper (Approve → Delegate → Done), gas estimation, approval flow
- `UndelegateDialog` — Withdrawal initiation dialog with gas estimation

### Withdrawal Components

- `WithdrawalQueue` — List of pending withdrawals with FIFO tooltip explanation
- `WithdrawalCard` — Per-withdrawal card with countdown timer, cooldown progress bar, and claim button
- `CountdownTimer` — Badge displaying formatted countdown

### Wallet Connection

Wagmi config (`src/config/wagmi.ts`) uses `safe()` (auto-detects Safe Wallet iframe), `injected()`, and optionally `walletConnect()` (if `VITE_WALLETCONNECT_PROJECT_ID` is set). Token approval flow is handled by `useTokenAllowance` hook. ConnectButton supports copy-to-clipboard for the connected address.

### Path Alias

`@/*` maps to `./src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CHAIN_ID` | Yes | Target chain (1 = mainnet, 11155111 = sepolia) |
| `VITE_RPC_URL` | Yes | JSON-RPC endpoint |
| `VITE_STAKING_DEPLOY_BLOCK` | Yes | Block number to start scanning validator events from |
| `VITE_WALLETCONNECT_PROJECT_ID` | No | Enables WalletConnect connector |
| `VITE_SANCTIONS_API_URL` | No | Sanctions check endpoint (403 = blocked) |
| `VITE_TOU_URL` / `VITE_DOCS_URL` / `VITE_FAQ_URL` | No | Footer links (default: `#`) |

## Adding a New Chain

1. Add chain object to `chainMap` in `src/config/chains.ts`
2. Add contract addresses for the chain ID in `src/config/contracts.ts`
3. Update `.env` with the new `VITE_CHAIN_ID` and `VITE_RPC_URL`

## Known Pre-existing Lint Errors

The following lint errors exist in the codebase and are not from recent changes:
- `admin/src/components/ProposeValidators.tsx` and `admin/src/components/RecoverTokens.tsx` — `react-hooks/set-state-in-effect` (setState in useEffect)
- `admin/src/components/ui/badge.tsx`, `admin/src/components/ui/button.tsx`, `admin/src/hooks/useToast.tsx` — `react-refresh/only-export-components`
- `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/hooks/useToast.tsx` — `react-refresh/only-export-components`
