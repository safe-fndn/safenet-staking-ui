# Manual QA Plan

A pre-release checklist for the Safenet Staking UI, covering scenarios that are either not
automated or only smoke-tested by the Playwright e2e suite (`e2e/`). See "Automation status"
at the bottom for what's already covered by `yarn test:e2e`.

## Setup

You'll need, on Sepolia (or whichever chain `VITE_CHAIN_ID` targets):

- A test wallet funded with Sepolia ETH for gas (any public faucet) and the Sepolia test SAFE
  token (`0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4`, configured in `src/config/contracts.ts`).
  Mint test tokens to your address via the admin panel's Token Operations section
  (see "Admin Panel" in `CLAUDE.md`).
- A validator address registered on the staking contract to delegate to — once connected,
  any address shown on the Validators page for the environment under test works.
- For rewards testing:
  - **TODO — no testnet MerkleDrop contract exists yet.** One needs to be manually deployed
    to Sepolia and its address set as `VITE_MERKLE_DROP_ADDRESS` before this can be tested.
  - Generate a proof for your test address via `scripts/merkle-config.json` +
    `yarn generate:proofs` (see "Merkle Proof Generation" in `CLAUDE.md`), then upload the
    output files to a testing branch of the rewards data repo and point
    `VITE_REWARDS_BASE_URL` at that branch.
  - Set the Merkle root on-chain via the admin panel to match the root you just generated —
    if it doesn't match, `useRewards` treats the proof as stale and silently disables the
    Claim button (see `src/hooks/useRewards.ts`).

How to reach each connection mode:

- **Browser wallet**: open the app directly with MetaMask (or similar) installed.
- **WalletConnect**: requires `VITE_WALLETCONNECT_PROJECT_ID` set (get one from
  [WalletConnect Cloud](https://cloud.walletconnect.com) if you don't have one); open the app,
  click Connect Wallet → WalletConnect, and pair with a mobile wallet (or a second desktop
  wallet) by scanning the QR code / following the URI.
- **Safe App**: open [Safe{Wallet}](https://app.safe.global), go to Apps → "My custom apps",
  add the app URL — this works fine pointed at a local dev server (`yarn dev`) too — and open
  it from inside the Safe.

## No wallet connected

Without connecting anything, confirm:

- [ ] Total SAFE staked is visible on the dashboard
- [ ] The active validators list is visible on the Validators page
- [ ] Per-validator stats (name, participation rate, total stake) are visible
- [ ] No delegate/undelegate/claim buttons or other transaction-triggering UI is present anywhere

## Per-connection-mode checklist

Repeat this checklist once per connection mode. Note the tx hash for anything that submits a
transaction, for easier debugging if something looks off later.

| # | Scenario | Browser Wallet | WalletConnect | Safe App |
|---|---|---|---|---|
| 1 | SAFE token balance is displayed | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 2 | Staking (delegate) works | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 3 | Initiating unstaking (undelegate) works | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 4 | Withdrawing stake after the cooldown delay works | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 5 | Overview of own stake per validator is displayed | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 6 | Rewards: Claim button enabled and claiming works (address has rewards) | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |
| 7 | Rewards: Claim button disabled (address has no rewards) | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail | ☐ Pass ☐ Fail |

Notes / tx hashes:

```
(free-form notes per release go here)
```

## Edge cases

Check every release, alongside the table above:

- [ ] **Wrong network** (Browser Wallet / WalletConnect only — a Safe is pinned to one chain):
  connect while on an unsupported chain, or switch networks mid-session. The header should
  show a "Switch to {chain}" button and hide balance/actions until you switch back.
  *(automated for Browser Wallet)*
- [ ] **Both approval types**: with an allowance below the amount you're staking, try both
  "Approve exact amount" and "Approve unlimited" (on separate occasions) and confirm each
  correctly unlocks the Stake button afterwards. *(automated for Browser Wallet)*
- [ ] **Atomic batching** (only if your wallet/Safe advertises EIP-5792 `atomicBatch` support):
  delegating with insufficient allowance should collapse into a single "Stake" click (approve +
  stake in one signature) instead of two separate steps; with 2+ withdrawals ready to claim, a
  "Claim All (N)" button should appear on the Withdrawals page. *(automated — simulated wallet
  capability, still worth a real check against an actual batching-capable wallet/Safe)*
- [ ] **Rejected signature**: reject a signing request in the wallet (or close the Safe
  confirmation popup) and confirm an error toast appears and the dialog is left in a usable
  state (not stuck spinning). *(automated for Browser Wallet)*
- [ ] **Safe multisig queueing** (Safe App only, needs a Safe with threshold ≥ 2): submitting a
  transaction should show "sent to Safe Wallet for signing" rather than an immediate success
  toast; after a second owner confirms and it executes, reloading the app should reflect the
  updated state. *(manual-only, see Automation status)*
- [ ] **FIFO withdrawal order**: with 2+ pending withdrawals, only the oldest should show a
  Claim button; claiming it should reveal the next one. *(automated for Browser Wallet)*
- [ ] **Partial-KYC rewards note**: for a test address whose reward proof has a `kycAmount`
  greater than zero and `kyc` not `true`, confirm the "pending compliance checks" banner shows
  on the dashboard (this is independent of whether the Claim button itself is enabled).
  *(automated for Browser Wallet)*
- [ ] **Compliance gates**, only if configured in the environment under test: a sanctioned
  wallet address is denied access after connecting, and (if `VITE_SANCTIONS_API_URL` /
  geoblocking are set) the app is blocked entirely from a restricted IP/country. *(the
  underlying hooks are unit-tested — `useSanctionsCheck`, `useGeoblockCheck`,
  `useWalletSanctionsCheck` — this row is manual-only at the e2e level)*

## Automation status

- **Browser wallet**: rows 1–7 and all edge cases except Safe multisig queueing and compliance
  gates are automated (`e2e/tests/wallet-connection.spec.ts`, `delegation.spec.ts`,
  `undelegation.spec.ts`, `withdrawals.spec.ts`, `rewards.spec.ts`). Withdrawal cooldown and
  EIP-5792 wallet capabilities are simulated (mocked timestamps / mocked
  `wallet_getCapabilities`), not exercised against a real batching-capable wallet.
- **Safe App**: only smoke-tested (`e2e/tests/safe-app.spec.ts` — Connect/Disconnect UI is
  correctly hidden inside an iframe, public data still renders). Rows 1–7 and the Safe multisig
  queueing edge case are manual-only: a full postMessage-protocol simulation of the Safe Apps
  SDK was scoped out as not worth the effort relative to just running this checklist by hand.
- **WalletConnect**: only smoke-tested (`e2e/tests/wallet-connection.spec.ts` — the connector
  option appears in the menu). Real pairing requires a live relay/wallet and can't be
  automated; rows 1–7 are manual-only.
