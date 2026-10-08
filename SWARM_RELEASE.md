# Swarm release runbook

How to publish the staking UI to [Swarm](https://www.ethswarm.org/) and keep it online.

Every release is explicit:
- A person buys the storage from their own wallet.
- `yarn deploy:swarm` stamps and uploads the build with a throwaway key.

No Bee node, no long-lived key and no feed are involved. Pointing ENS at a release (its `contenthash`, `bzz://<reference>`) is done separately by the ENS owner and is not part of this runbook.

**Role:** the release operator runs the script and has a wallet on **Gnosis Chain** holding xDAI and xBZZ.

---

## 0. Prerequisites

- **Node 22 and dependencies:** `yarn install`.
- **A wallet on Gnosis Chain (chain id 100)** holding:
  - **xDAI** for gas (a few cents)
  - **xBZZ**, at least the cost printed by the dry run (step 2)
- **Getting xBZZ:** swap xDAI → xBZZ on Gnosis Chain, for example with [CoW Swap](https://swap.cow.fi) (network: Gnosis).
  - **Always select the token by address,** because lookalike tokens exist: `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da`. xBZZ uses **16 decimals**.
  - Do **not** use Beeport's "buy stamps" flow. It creates a mutable batch owned by Beeport's node, which is not what we want.

## 1. Build

```bash
yarn build          # with the production environment variables
```

Local builds are fine. The release record stores the git commit and the sha256 of every file in `dist/`.

## 2. Preview cost and reference

```bash
yarn deploy:swarm ./dist --ttl-days 365 --dry-run
```

It prints:
- the Swarm reference
- the chunk count
- the batch depth: the smallest immutable batch that fits, usually 17
- the TTL and the xBZZ cost at today's price

It sends nothing and generates no key. `--ttl-days` is required, so every release states how long its storage is paid for. A 5% margin is added to cover price changes before the purchase is mined.

## 3. Start the release

```bash
yarn deploy:swarm ./dist --ttl-days 365
```

The script generates an **ephemeral stamping key in memory**, prints the two transactions below, and then **waits** for the batch. **Keep the terminal open.** The key never touches disk. If the script dies after step 4b is mined, that batch can no longer be used, and you have to start over with a new one.

## 4. Buy the batch (manual)

Send both transactions from your wallet, using **exactly the values printed by the script**. On [gnosisscan.io](https://gnosisscan.io): open the contract, then **Contract → Write Contract → Connect to Web3**.

### 4a. Approve xBZZ

- **Contract:** xBZZ `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da`
- **Function:** `approve(spender, amount)`
  - `spender` = PostageStamp `0x45a1502382541Cd610CC9068e88727426b696293`
  - `amount` = the printed total
- **Wait until it is mined.**

### 4b. Create the batch

- **Contract:** PostageStamp `0x45a1502382541Cd610CC9068e88727426b696293`
- **Function:** `createBatch` with the printed values:

| Field | Check |
|---|---|
| `_owner` | **equals the ephemeral address printed by the script.** That key signs the stamps; it is not your wallet. |
| `_initialBalancePerChunk` | printed value |
| `_depth` | printed value (usually 17) |
| `_bucketDepth` | `16` |
| `_nonce` | printed value |
| `_immutable` | **`true`** |

**Entering values:**
- Enter amounts as **raw integers**. Never apply the `×10¹⁸` multiplier the form offers.
- Wallets that take hex data can use the printed `calldata` directly.
- Smart-account wallets (EIP-7702 / ERC-4337 bundlers) work fine: the script finds the batch by its owner, not by the sender of the transaction.

## 5. Let the script finish

Once `createBatch` is mined, the script continues automatically:
1. **Validates the batch:** owner, depth, bucket depth 16, immutable.
2. **Stamps every chunk exactly once,** then drops the key.
3. **Saves the stamped chunks and the release metadata** to `swarm-release/<reference>/` (`bundle.bin`, `release.json`), *before* pushing. This is local only and gitignored, and is what lets a failed release be resumed.
4. **Pushes them** to `https://beeport.xyz`, falling back to `https://api.gateway.ethswarm.org`. A freshly bought batch can take a few minutes to become usable; the script retries meanwhile.
5. **Verifies** every file by sha256 via `/bzz/<reference>/` through `https://download.gateway.ethswarm.org` and `https://bzz.limo` (which fetches every manifest and data chunk), and loads the page like a browser (warning about any asset that doesn't load).
6. **Writes the release record** `releases/swarm/<date>-<ref>.json` and prints the reference and its URLs. The record is the release receipt: git commit, sha256 of every file, Swarm reference, tooling versions, upload settings, batch (id, depth, purchase tx, estimated expiry), gateways, retrieval URLs and the ENS contenthash value `bzz://<reference>`. If the final expiry lookup fails, the record is still written, with `estimatedExpiry: null`; `yarn swarm:status` reads the live value.

If pushing or verifying fails, nothing is lost: resume with `--push-bundle` (see [Resuming a release](#resuming-a-release)).

**Open a PR with the release record.** It's how anyone finds a release's batch to top it up.

## 6. Check the release

Open the subdomain URL the script prints, `https://<cid>.bzz.limo/`. The site runs at the root of its own subdomain, the way an ENS gateway serves it.

The path form `https://bzz.limo/bzz/<reference>/` also works, but **only with the trailing slash**. Without it, `bzz.limo` serves the page without redirecting, and every asset fails to load. `download.gateway.ethswarm.org` and `beeport.xyz` add the slash themselves.

`api.gateway.ethswarm.org` refuses to *serve* this app's content: it redirects to `bzz.link/forbidden`. The content is still on Swarm; use another gateway to view it.

---

## Keeping a release online

```bash
yarn swarm:status            # remaining days per recorded release; warns if any has < 7 days left (--strict: exit 1)
```

- **`EXPIRED`** is only reported when Gnosis Chain confirms it: the balance is used up, or PostageStamp says the batch no longer exists.
- **`UNKNOWN`** means the lookup itself failed (for example, an RPC timeout). The command then always exits 1. The storage may still be paid for, so **don't re-upload**: retry, or set `SWARM_GNOSIS_RPC_URL` to another RPC.

**Top-up, from any account (the batch owner isn't needed):**
1. `approve` the printed xBZZ total on the xBZZ token for PostageStamp.
2. Call `topUp(batchId, amountPerChunk)` on PostageStamp. `yarn swarm:status` prints both calls for releases about to expire. The total charged is `amountPerChunk × 2^depth`.

**Rules:**
- **Top up only before expiry.** An expired batch can't be revived; re-run `yarn deploy:swarm` with a new batch. The same `dist/` with the same settings gives the **same reference**, so anything pointing at it (e.g. ENS) stays valid.
- **After a top-up, at least 24 hours of balance must remain** (`remainingBalance + amount ≥ minimumInitialBalancePerChunk`). Small top-ups on an almost-empty batch revert.
- **Topping up adds time, never capacity.** That's fine: a release batch is never filled further.

## Resuming a release

If pushing or verifying failed, or chunks went missing later, resume from the saved release. It needs no key and no new batch, as long as the batch is still alive:

```bash
yarn deploy:swarm --push-bundle swarm-release/<reference>
```

It repeats every step after stamping:
- pushes the stamped chunks (re-pushing chunks that are already stored is harmless)
- verifies every file and the page
- writes the release record

So a resumed release ends up recorded exactly like one that succeeded the first time. `swarm-release/<reference>/` exists only on the machine that made the release. Without it, resuming needs a new batch.

## Keeping the evidence

For each release, keep together:
- the committed release record (`releases/swarm/…json`)
- the exact `dist/` that was uploaded, e.g. as a tarball next to the IPFS artifact; its files must match `fileChecksums` in the record
- `swarm-release/<reference>/` (`bundle.bin`, `release.json`), which is needed to re-push without a new batch

## Checking a release independently

Anyone can rebuild and compare against the release record. No network is needed:

```bash
yarn swarm:hash ./dist       # must print the record's "reference" (same settings and core-sdk version as in the record)
```

What is and isn't independent:
- `deploy:swarm` uploads exactly the chunks it computed, so the uploaded reference *is* the locally computed one. Comparing it with an upload response would prove nothing, so the script doesn't present it as a check.
- The checks that don't rely on the upload are: (1) every file is fetched back and its sha256 compared through gateways other than the one pushed to; (2) anyone can recompute the reference from the archived `dist/` with `swarm:hash`.
- **Limitation:** `swarm:hash` and `deploy:swarm` share the same code (core-sdk's chunker and manifest builder), so (2) is reproducible but not a second implementation. A Bee node's own `/bzz` upload builds manifests differently and gets a different reference for the same files. What a second party can verify independently is the content: fetch every file through any gateway and compare it with the archived `dist/` (the record's `fileChecksums`).

## What the reference does and does not guarantee

Three separate properties, each checked differently:

| Property | Means | How to check |
|---|---|---|
| **Content identity** | The reference fixes every byte of every file in `dist/` (HTML, JS, CSS, `manifest.json`, icons, images), their paths, content types and the index/error documents. Nothing in `dist/` is skipped. | `yarn swarm:hash ./dist` |
| **Gateway trust** | A gateway can serve whatever it likes under a URL. Browsers don't verify Swarm content. | Compare files fetched from a second gateway, or run your own Bee node |
| **Availability** | Content stays retrievable only while its batch is paid for. Releases have no erasure coding, so a chunk lost from the network breaks its file until it is re-pushed (`--push-bundle`). | `yarn swarm:status`; `--push-bundle` |

**Not covered by the reference.** The page's Content-Security-Policy allows scripts only from the release itself (`script-src 'self'`), so no executable code is loaded from elsewhere. But the app fetches data at runtime that can change its behaviour without changing the reference:
- validator list and metadata: `VITE_VALIDATOR_INFO_URL` (default: GitHub raw, `safe-fndn/safenet-beta-data`)
- reward proofs and `latest.json`: `VITE_REWARDS_BASE_URL` (default: GitHub raw)
- sanctions check: `VITE_SANCTIONS_API_URL`, if set
- geo-blocking: `https://api.country.is`, falling back to `https://ipapi.co`
- chain state: `VITE_RPC_URL`, plus the connected wallet's own RPC
- WalletConnect relay and fonts (`fonts.reown.com`), if `VITE_WALLETCONNECT_PROJECT_ID` is set

The URLs themselves are baked into the build at `yarn build` time, so they are covered by the reference.

**ENS is separate.** A release is identified by its reference only. An ENS name pointing at it (`contenthash` = `bzz://<reference>`) is a mutable pointer, and changing it is a separate, manual action by the ENS owner.

## Local pinning

Pinning a release on your own Bee node (`POST /pins/<reference>` on that node) keeps a local copy that the node won't garbage-collect, and your node can serve it to you. It **does not replace a funded batch**: other users fetch chunks from the nodes responsible for their addresses, not from yours, and those nodes only keep chunks whose batch is paid for. To restore missing chunks while the batch is alive, re-push with `--push-bundle`; after expiry, re-upload with a new batch.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `createBatch` "reverted with reason unknown" | The xBZZ transfer failed: not enough xBZZ, `approve` not mined yet, approved from a different account, or the amount was scaled wrongly. Check `balanceOf` and `allowance(you, PostageStamp)` on the xBZZ token. |
| `createBatch` reverts with `InsufficientBalance` | The price rose since the parameters were printed. Abort and rerun the script (new key, new parameters). |
| `BatchExists` | The same nonce was used twice from one account. Rerun for a new nonce. |
| Script waits but never sees the batch | `_owner` doesn't match the printed address, a value differs from the printed ones (depth, amount, `_immutable`), or the transaction isn't mined yet. Abort and rerun if it was sent with wrong values. |
| `Ignoring batch 0x… for our key: …` | Someone else created a batch for the printed owner that can't hold the release (e.g. underfunded, wrong depth, mutable), possibly front-running your purchase. It is skipped; the script keeps waiting for a batch that matches. |
| `invalid batch id` while pushing | The gateway hasn't seen the new batch yet. The script retries for up to 20 minutes. |
| `stamp signature is invalid` | The batch's `_owner` isn't the key that signed the stamps. Rerun with a new batch. |
| Some files not retrievable yet | Wait and resume with `--push-bundle swarm-release/<reference>`. Verification retries for about a minute per gateway. |
| Page loads, but scripts/styles 400 on `bzz.limo/bzz/<ref>` | The URL is missing its trailing slash. Use `…/bzz/<ref>/` or the subdomain URL. |
| `swarm:status` shows `UNKNOWN` | The RPC lookup failed; nothing is known about the batch. Retry, or set `SWARM_GNOSIS_RPC_URL`. Don't re-upload. |

## What the ephemeral key can and cannot do

| Action | Ephemeral owner key | Anyone else |
|---|---|---|
| Stamp chunks into the batch | ✅ until the batch is full | ❌ |
| Change the content behind a reference | ❌ impossible (content addressing) | ❌ |
| Delete content | ❌ Swarm has no delete | ❌ |
| Overwrite stamp slots | ❌ batch is immutable | ❌ |
| Shorten the TTL (`increaseDepth`) | ⚠️ needs gas; the key is never funded and is dropped right after stamping | ❌ |
| Extend the TTL (`topUp`) | ✅ | ✅ |

**Never send funds to the ephemeral address.** Treat everything uploaded as public and permanent: when a batch expires, nodes may drop its chunks, but copies can remain.
