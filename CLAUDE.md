# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Dev server:** `npm run dev`
- **Lint:** `npm run lint`
- **Type check only:** `npx tsc --noEmit`
- **Preview production build:** `npm run preview`

No test framework is configured.

## Architecture

Safenet Staking UI is a React 19 + TypeScript dApp for delegating SAFE tokens to validators on Ethereum. It uses Vite 7, Tailwind CSS 4 (via `@tailwindcss/vite`), and wagmi 3 / viem for wallet and contract interactions.

### Provider Stack (src/main.tsx)

`StrictMode` → `WagmiProvider` → `QueryClientProvider` → `ToastProvider` → `App`

All wagmi hooks, React Query, and toast context are available throughout the app.

### Routing (src/App.tsx)

Three pages under a shared `Layout` (header + footer + `<Outlet />`):
- `/` → `DashboardPage` (stats, rewards placeholder, positions)
- `/validators` → `ValidatorsPage` (validator cards with delegate/undelegate)
- `/withdrawals` → `WithdrawalsPage` (pending withdrawal queue with claim)

App-level guards: `useSanctionsCheck` blocks the entire app if `VITE_SANCTIONS_API_URL` returns 403. `DisconnectWatcher` shows a toast on wallet disconnect.

### Contract Integration

- **Config layer:** `src/config/chains.ts` resolves chain from `VITE_CHAIN_ID`, `src/config/contracts.ts` maps chain IDs to staking/token contract addresses.
- **ABIs:** `src/abi/stakingAbi.ts` (staking contract) and `src/abi/erc20Abi.ts` (SAFE token). ABIs use viem's `parseAbi` with human-readable signatures.
- **Read hooks** (`src/hooks/useStakingReads.ts`): Thin wrappers around wagmi's `useReadContract`/`useReadContracts`. Per-user hooks guard with `query: { enabled: !!address }`.
- **Write hooks** (`src/hooks/useStakingWrites.ts`): Each write hook (`useStake`, `useInitiateWithdrawal`, `useClaimWithdrawal`) combines `useWriteContract` + `useWaitForTransactionReceipt` and returns a unified `{ action, isPending, isSuccess, error, reset, txHash }` interface.
- **Validator discovery** (`src/hooks/useValidators.ts`): Fetches `ValidatorUpdated` events from deploy block to latest via `getLogs`, with automatic chunked fallback for RPC block-range limits. Returns `ValidatorInfo[]` with `{ address, isActive }` sorted active-first.

### Terminology

The UI uses "delegation" terminology externally (Delegate/Undelegate) but the smart contract uses "stake" terminology. Hook and contract function names reflect the contract (`useStake`, `stake()`), while component labels say "Delegate"/"Undelegate".

### Validator Metadata

`src/data/validators.json` is a static address→metadata map (label, commission, uptime). `useValidatorMetadata(address)` does a case-insensitive lookup. Unknown validators fall back to truncated address display.

### Placeholder Systems

- **Rewards** (`src/hooks/useRewards.ts`): Returns mock data. TODO: integrate with Merkle drop contract.
- **Sanctions** (`src/hooks/useSanctionsCheck.ts`): Fetches `VITE_SANCTIONS_API_URL` on mount; no-op if env var is unset.

### UI Components

Radix UI primitives (`dialog`, `tabs`, `tooltip`, `slot`) wrapped in `src/components/ui/` using CVA + tailwind-merge (`cn()` from `src/lib/utils.ts`). These follow shadcn/ui conventions.

### Wallet Connection

Wagmi config (`src/config/wagmi.ts`) uses `safe()` (auto-detects Safe Wallet iframe), `injected()`, and optionally `walletConnect()` (if `VITE_WALLETCONNECT_PROJECT_ID` is set). Token approval flow is handled by `useTokenAllowance` hook.

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
