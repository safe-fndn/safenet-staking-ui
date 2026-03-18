# Safe{Staking}

A web application for delegating SAFE tokens to validators on Ethereum. Built as a [Safe App](https://docs.safe.global/apps/overview) that runs natively inside Safe Wallet, with full support for EOA wallets via injected providers and WalletConnect.

## Features

- **Stake & Unstake** SAFE tokens to validators with a multi-step approval flow
- **Batch transactions** for Safe wallets — approve + stake in a single multisig proposal via [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792)
- **Withdrawal queue** with FIFO ordering, cooldown progress bars, and claim actions
- **Dashboard** with staking stats, portfolio breakdown, rewards calculator, and transaction history
- **Validator discovery** with search, filter (active/inactive), and sort controls
- **Deep-linking** — open the stake dialog for a specific validator via `?delegate=0x...`
- **Dark mode** with system preference detection and manual toggle
- **Geo-blocking** and sanctions compliance checks
- **IPFS deployable** for censorship-resistant hosting

## Quick Start

```bash
cp .env.example .env   # fill in required values
yarn install
yarn dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CHAIN_ID` | Yes | Target chain ID (`1` for mainnet, `11155111` for Sepolia) |
| `VITE_RPC_URL` | Yes | JSON-RPC endpoint |
| `VITE_STAKING_DEPLOY_BLOCK` | Yes | Block number to start scanning validator events from |
| `VITE_WALLETCONNECT_PROJECT_ID` | No | Enables WalletConnect connector |
| `VITE_MERKLE_DROP_ADDRESS` | No | Merkle drop contract address for rewards claiming |
| `VITE_SANCTIONS_API_URL` | No | Sanctions check endpoint (HTTP 403 = blocked) |
| `VITE_GEOBLOCK_CACHE_DAYS` | No | Geo-block cache duration in days (defaults to 7) |
| `VITE_VALIDATOR_INFO_URL` | No | Validator info JSON endpoint (defaults to GitHub raw URL) |
| `VITE_REWARDS_BASE_URL` | No | Base URL for reward proof files (defaults to GitHub raw URL) |
| `VITE_DOCS_URL` | No | Documentation link in footer (defaults to Safe docs) |
| `VITE_TERMS_URL` | No | Footer terms link (hidden if unset) |
| `VITE_PRIVACY_URL` | No | Footer privacy link (hidden if unset) |
| `VITE_IMPRINT_URL` | No | Footer imprint link (hidden if unset) |
| `PINATA_JWT` | No | Pinata API JWT for IPFS deployment |
| `PINATA_GATEWAY` | No | Pinata gateway domain for IPFS deployment |

See [`.env.example`](.env.example) for a template.

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Type-check and production build |
| `yarn lint` | Run ESLint |
| `yarn preview` | Preview production build locally |
| `yarn test` | Run unit/integration tests (vitest) |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests with coverage report |
| `yarn test:e2e` | Run Playwright end-to-end tests |
| `yarn deploy:ipfs` | Deploy build to IPFS via Pinata |
| `yarn generate:proofs` | Generate Merkle proofs for reward distribution |

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** with Tailwind CSS 4
- **wagmi 3** / **viem** for wallet and contract interactions
- **React Router 7** with hash-based routing (for IPFS compatibility)
- **Radix UI** primitives (dialog, tabs, tooltip) styled with [shadcn/ui](https://ui.shadcn.com/) conventions
- **Recharts** for data visualization
- **Vitest** for unit/integration tests
- **Playwright** for end-to-end testing

## Architecture

```
src/
├── abi/            # Contract ABIs (parseAbi with human-readable signatures)
├── components/
│   ├── dashboard/  # Stats, rewards, portfolio, staking section
│   ├── layout/     # Header, footer, shared layout
│   ├── onboarding/ # First-time visitor banner
│   ├── staking/    # DelegateDialog, UndelegateDialog, AmountInput
│   ├── ui/         # Radix + CVA primitives (button, card, dialog, etc.)
│   ├── validators/ # ValidatorCard, ValidatorList, ValidatorControls
│   ├── wallet/     # ConnectButton
│   └── withdrawals/# WithdrawalQueue, WithdrawalCard, CountdownTimer
├── config/         # Chain, contract addresses, wagmi config
├── data/           # Static validator metadata (JSON)
├── hooks/          # Contract reads, writes, gas estimation, rewards
├── lib/            # Utilities (formatting, error handling, clipboard)
└── pages/          # Route components
e2e/                # Playwright end-to-end tests
scripts/            # Off-chain tooling (Merkle proof generation)
admin/              # Admin panel (validator proposals, contract management)
```

### Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | `DashboardPage` | Stats, portfolio, rewards, transaction history |
| `/validators` | `ValidatorsPage` | Validator discovery with search/filter/sort |
| `/validators/:address` | `ValidatorDetailPage` | Individual validator info and actions |
| `/withdrawals` | `WithdrawalsPage` | Pending withdrawals queue and claims |
| `/terms` | `TermsOfUsePage` | Terms of Use |
| `/faq` | `FaqPage` | Frequently Asked Questions |

### Wallet Support

The app connects via three wagmi connectors, resolved in order:

1. **Safe** — auto-detected when running inside the Safe Wallet iframe
2. **Injected** — MetaMask, Rabby, and other browser extension wallets
3. **WalletConnect** — enabled when `VITE_WALLETCONNECT_PROJECT_ID` is set

When connected through Safe, the app detects [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) `atomicBatch` capability and batches approve + stake into a single transaction proposal, reducing multisig signing rounds from 2 to 1.

### Contract Integration

The UI uses "delegation" terminology (Delegate/Undelegate) but the smart contract uses "stake" terminology internally. Write hooks wrap `stake()`, `initiateWithdrawal()`, and `claimWithdrawal()` contract functions.

- **Read hooks** (`useStakingReads.ts`) poll every 15 seconds via `refetchInterval`
- **Write hooks** (`useStakingWrites.ts`) return a unified `{ action, isSigningTx, isConfirmingTx, isSuccess, error, reset, txHash }` interface
- **Validator discovery** fetches `ValidatorUpdated` events from the deploy block with automatic chunked fallback for RPC block-range limits
- **Rewards** — Merkle-proof-based reward claiming via a MerkleDrop contract. Proofs are generated off-chain (see below) and served as static JSON files

### Merkle Proof Generation

The `scripts/` directory contains tooling for generating Merkle proofs compatible with the MerkleDrop contract:

1. Edit `scripts/merkle-config.json` with wallet addresses and cumulative reward amounts (in wei):
   ```json
   {
     "epoch": 1,
     "entries": {
       "0xWalletAddress": "1000000000000000000000"
     }
   }
   ```
2. Run `yarn generate:proofs`
3. Output:
   - `public/rewards/proofs/{address}.json` — per-address proof files
   - `public/rewards/latest.json` — current Merkle root, total, and epoch
4. Set the root on-chain via the admin panel

The tree uses sorted-pair hashing (OpenZeppelin convention) and viem for encoding.

### Adding a New Chain

1. Add the chain object to `chainMap` in `src/config/chains.ts`
2. Add contract addresses for the chain ID in `src/config/contracts.ts`
3. Set `VITE_CHAIN_ID` and `VITE_RPC_URL` in your environment

## Admin Panel

The `admin/` directory is a separate Vite app for contract administration. Run it independently with `cd admin && yarn dev`.

**Sections:**
- **Withdraw Delay** — Propose and execute delay changes (timelocked)
- **Validator Management** — Propose and execute validator registration/deregistration (timelocked)
- **Token Operations** — Mint test tokens, recover tokens from the staking contract
- **Merkle Drop** — Set the Merkle root on the MerkleDrop contract (shown when `VITE_MERKLE_DROP_ADDRESS` is set)
- **Event Log** — View contract events

## Deployment

### IPFS

```bash
yarn build
yarn deploy:ipfs
```

Requires `PINATA_JWT` and `PINATA_GATEWAY` environment variables. The build uses hash-based routing (`HashRouter`) for compatibility with IPFS gateways.

### Safe App

The app includes a `/manifest.json` for Safe App discovery. To run inside Safe Wallet:

1. Deploy to any static host (Vercel, IPFS, etc.)
2. In Safe Wallet, go to Apps > Add Custom App
3. Enter the deployment URL

## License

MIT — see [LICENSE](LICENSE) for details.
