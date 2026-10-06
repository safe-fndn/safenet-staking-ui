# Plan: Swarm deployment

Component: root package (`scripts/`, release documentation). No changes to the dApp (`src/`).

---

## Overview

Publish the production build (`dist/`) to Swarm without operating a Bee node and without any long-lived signing key, and make every release an explicit, auditable action:

1. A human buys a fresh **immutable** postage batch from their own wallet on Gnosis Chain, setting a freshly generated **ephemeral key** as batch owner.
2. `deploy:swarm` builds all chunks offline (same code path as `swarm:hash`), stamps each chunk once with the ephemeral key, pushes the pre-stamped chunks to a public gateway, verifies retrieval, discards the key and writes a release record.
3. There is no feed / mutable pointer. Pointing ENS at a release (`contenthash`) is done manually by the ENS owner and is out of scope for the tooling.
4. Anyone can extend a release's lifetime with `topUp(batchId)`; `swarm:status` warns before expiry.

Steps (separate PRs, details in [Implementation Phases](#implementation-phases)):

1. Offline Swarm website hash (`swarm:hash`), stacked PRs 1/5–5/5, incl. chunk emission (folded in, no separate refactor PR).
2. Root chunk replicas (Bee's dispersed replicas for erasure-coded uploads).
3. Stamping, batch depth planning and stamped-chunk bundle (offline).
4. Gnosis Chain batch module (pricing, purchase parameters, batch discovery and validation).
5. Gateway push and retrieval verification.
6. Release records.
7. `deploy:swarm` CLI.
8. `swarm:status` expiry check.
9. Release runbook (`SWARM_RELEASE.md`) with the manual funding / batch creation instructions.
10. Remove this specification.

---

## Architecture Decision

### Context: validated end to end (2026-10-02 – 2026-10-05)

- `swarm:hash` reproduces a real Beeport upload byte for byte, including Medium erasure coding, Go mime types, Bee's mantaray serialisation and the upload's file order (validated with the then-supported `--order apfs`, since removed).
- Public gateways `https://beeport.xyz` (Bee 2.8.1) and `https://api.gateway.ethswarm.org` accept chunks with a client-signed `Swarm-Postage-Stamp` header (`POST /chunks` → 201). They reject a stamp for the right batch signed by the wrong key (400 `stamp signature is invalid`), so they validate rather than re-stamp. Chunks pushed via one gateway were retrievable via the other.
- A test batch was bought from a 7702/ERC-4337 smart-account wallet via a bundler with an ephemeral `_owner`; `topUp` from a non-owner account succeeded on the deployed PostageStamp contract (`0x45a1502382541Cd610CC9068e88727426b696293`).

### Decisions

- **No Bee node, no node wallet.** Chunks are built and stamped locally and pushed to public gateways. Gateways only relay; they cannot alter content (content addressing) or forge stamps.
- **One immutable batch per release.** Immutable batches cannot overwrite stamp slots, so stored chunks cannot be evicted by the owner. A fresh batch per release avoids persisting bucket state and makes each release's storage independently top-up-able.
- **Ephemeral, never-funded owner key.** Generated per release, kept in memory only, used solely to sign stamps, then discarded. Without xDAI it cannot send transactions (e.g. `increaseDepth`, which would shorten the TTL), and after discarding it nobody can. A persistent owner key adds no capability we need: top-ups are permissionless, and re-pushing uses the archived stamped chunks.
- **The human wallet buys the batch; the ephemeral key does not.** The buyer has no rights after purchase (only `_owner` is stored), so this keeps the key unfunded, keeps the tooling free of transaction handling, and keeps spending an explicit human approval.
- **Single source of truth for chunks.** `deploy:swarm` uses the exact chunk stream produced by the `swarm:hash` code, so the uploaded reference always equals the offline hash anyone can recompute.
- **No feeds, no ENS tooling.** Every release gets a new reference; the ENS owner sets the `contenthash` manually (e.g. `bzz://<reference>` in the ENS app). The tooling only prints the reference.
- **Erasure coding Medium (1).** Uploading ourselves makes a true level 0 possible, but Medium costs only ~7.5 % extra chunks (9 parity per 119 data chunks; files ≤ 4 KB unaffected), adds root-chunk replicas, and lets lost chunks of large files be reconstructed. It also keeps one default across `swarm:hash`, Beeport and `deploy:swarm`. `--redundancy` stays configurable.
- **Byte-sorted file order, always.** The insertion order is ours to choose; byte-sorted paths give the same reference on every OS. `--order apfs` (reproducing manual Beeport uploads from macOS) was removed: `deploy:swarm` uploads its own chunks, so it is not needed.
- **Explicit TTL per release.** `--ttl-days` is required (no default), so every release states its spending; the tool converts it to a per-chunk balance at the current price plus a safety margin and prints the cost before any purchase.
- **Local builds and local bundles.** Releases may be cut from a local build. The stamped-chunk bundle is kept locally only (gitignored); losing it means a re-push needs a new batch.

### Alternatives Considered

- **Own Bee light node** (node-owned batch, upload via `/bzz` tar): simplest upload, but requires operating a node and a long-lived funded node key.
- **Manual Beeport uploads**: batches are created via Beeport's registry with Beeport's node as stamp signer and are mutable by default; not scriptable; uploader's OS/browser affects the reference.
- **Persistent stamping key**: allows later re-stamping, but is a long-lived secret able to fill batches and shorten TTLs of every live release.
- **Ephemeral key as batch creator**: fully automated, but the key must be funded (hot key, stranded dust, transaction handling) and spending loses the explicit human approval.
- **Admin-panel purchase page**: the `admin/` app was removed from the repo; a runbook plus CLI-generated parameters is sufficient for an occasional manual step. Can be revisited.
- **Swarm feeds** for a stable address: rejected; updates must be explicit ENS changes.

---

## User Flow

Release operator (has a Gnosis Chain wallet with xBZZ + xDAI):

1. Build the production bundle (CI artifact or `yarn build` with production env).
2. `yarn deploy:swarm ./dist --ttl-days <n>`:
   - computes chunks, the reference and the required batch depth (bucket fill);
   - generates the ephemeral key (memory only);
   - prints the exact `approve` and `createBatch` parameters (and calldata) for the human wallet, plus the expected cost and TTL;
   - waits until a matching `BatchCreated` event appears on-chain (or the operator pastes the tx hash).
   - Release builds may be local (`yarn build` with production env); the record stores the git commit and a `dist/` checksum.
3. Operator sends `approve` (xBZZ) and `createBatch` (PostageStamp) from their wallet, following `SWARM_RELEASE.md`.
4. `deploy:swarm` continues automatically: validates the batch, stamps, pushes, verifies retrieval, discards the key, writes the stamped-chunk bundle (local) and the release record, and prints the reference.
5. Operator opens a PR with the release record. Updating ENS happens separately and manually.
6. Later: `yarn swarm:status` shows remaining TTL per release; anyone tops up batches before expiry.

### CLI output (sketch, illustrative numbers)

```
Swarm release  <reference>   (43 files, 1263 chunks, Medium erasure coding)
Batch          depth 18 (max bucket fill 3/4), TTL 365 days
Cost           23.47 xBZZ  (+ gas)          price 142236 / chunk / block

Step 1 — xBZZ 0xdBF3…68da → approve
  spender  0x45a1502382541Cd610CC9068e88727426b696293
  amount   234700000000000000
Step 2 — PostageStamp 0x45a1…6293 → createBatch
  _owner                   0x…(ephemeral)      _depth        18
  _initialBalancePerChunk  895…                 _bucketDepth  16
  _nonce                   0x…                  _immutable    true
  calldata 0x5239af71…
Waiting for BatchCreated with owner 0x…  (Ctrl-C aborts; nothing has been spent yet)
```

---

## Tech Specs

### New npm scripts

| Script | Purpose |
|---|---|
| `deploy:swarm` | Prepare → wait for batch → stamp → push → verify → record (`scripts/deploy-swarm.ts`) |
| `swarm:status` | Remaining TTL / expiry for every recorded release (`scripts/swarm-status.ts`) |

### Modules (`scripts/swarm/`)

- `file-hash.ts`, `mantaray.ts` (refactor): accept an `onChunk(chunk)` sink; data, intermediate, parity and manifest-node chunks are emitted in a deterministic order. `hashWebsite` returns `{ reference, entries, chunks }` when asked.
- `replicas.ts`: dispersed replicas of root chunks as Bee 2.8.1 `replicas.NewPutter` does for redundancy levels > 0 (via core-sdk `makeReplicas`); validated by fetching the replica addresses of an existing Beeport upload from a gateway.
- `stamping.ts`:
  - `planDepth(addresses)`: bucket = top 16 bits of the address, slots per bucket = `2^(depth-16)`, returns the minimal depth ≥ 18 with all buckets fitting (immutable: a single full bucket fills the batch).
  - `stampAll(chunks, key, batchId, depth)`: core-sdk `Stamper`, **each unique address stamped exactly once**.
  - Bundle format: `swarm-release/<reference>/bundle.bin` (gitignored, local only), records `address(32) | stamp(113) | length(u16) | data`, plus `manifest.json` (reference, batch id, chunk count, sha256 of bundle). Re-pushing needs no key.
- `batch.ts` (viem, Gnosis):
  - constants: PostageStamp `0x45a1502382541Cd610CC9068e88727426b696293`, xBZZ `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da` (16 decimals), chain 100;
  - `quote(depth, ttlDays)`: `perChunk = max(minimumInitialBalancePerChunk, lastPrice × blocks) × safety margin`, total = `perChunk << depth`;
  - `purchaseParams(owner, perChunk, depth, nonce)` → named params + calldata for `approve` and `createBatch(owner, perChunk, depth, 16, nonce, true)`;
  - `waitForBatch(owner)`: polls `BatchCreated` logs from the block at prepare time and matches `owner` (not indexed → filter client-side); accepts relayed (ERC-4337) transactions, so the buyer is not taken from `tx.from`;
  - `validateBatch`: owner, depth, bucket depth 16, `immutableFlag == true`;
  - `remainingBalance`, expiry estimate (`remaining / lastPrice × 5 s`).
- `gateway.ts`: `POST /chunks` with `Swarm-Postage-Stamp`; limited concurrency; retry on `invalid batch id` until the batch is usable (bounded, ~20 min) and on 429/5xx; never re-stamps. Verification: `GET /chunks/<address>` for every chunk and `GET /bzz/<reference>/<path>` for every file via a **different** gateway than the one pushed to; byte comparison.

### Release record

`releases/swarm/<yyyy-mm-dd>-<shortref>.json` (committed): reference, git commit, dist sha256 checksum list hash, file order, erasure level, batch id, depth, per-chunk balance, purchase tx hash, buyer, pushed-via gateway(s), estimated expiry at upload time, bundle sha256. `swarm:status` reads these.

### Environment variables (scripts only, all optional)

| Variable | Default | Purpose |
|---|---|---|
| `SWARM_GNOSIS_RPC_URL` | `https://rpc.gnosischain.com` | Gnosis Chain reads (pricing, events, balances) |
| `SWARM_GATEWAYS` | `https://beeport.xyz,https://api.gateway.ethswarm.org` | Push / verify gateways (first = push) |

No private keys or credentials in env; the ephemeral key never leaves process memory.

### `SWARM_RELEASE.md` runbook (manual funding / batch creation)

Must contain the concrete, tested instructions:

- **Prerequisites:** Gnosis Chain wallet; xDAI for gas; xBZZ ≥ the printed total. How to obtain xBZZ: swap xDAI → xBZZ on Gnosis (e.g. CoW Swap), always by token address `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da` (lookalike tokens exist). Do **not** use Beeport's "buy stamps" flow (creates a mutable, Beeport-node-owned batch).
- **Step 1, approve:** gnosisscan.io → xBZZ token → Contract → Write Contract → Connect to Web3 → `approve(spender = PostageStamp, amount = printed total)`. Wait until mined.
- **Step 2, createBatch:** PostageStamp → Write Contract → `createBatch` with the printed values. Check `_owner` equals the printed ephemeral address and `_immutable = true`. Enter amounts as raw integers. **Never apply the `×10¹⁸` multiplier** offered by the form.
- **Troubleshooting** (all observed during validation):
  - "reverted with reason unknown" → the xBZZ `transferFrom` failed: balance too low, `approve` not mined, approved from a different account, or wrong amount scaling. Named errors (`InsufficientBalance`, `BatchExists`, `InvalidDepth`) come from PostageStamp itself.
  - Price moved since the parameters were printed → `InsufficientBalance`; rerun prepare.
  - Smart-account wallets (EIP-7702 / ERC-4337) are fine; the batch is found by owner, not by transaction sender.
- **Top-up (anyone, any account):** `approve`, then `topUp(batchId, amountPerChunk)`; total = `amountPerChunk × 2^depth`. A top-up must leave the batch with at least the 24 h minimum balance (`remainingBalance + amount ≥ minimumInitialBalancePerChunk`) and only works **before** expiry; expired releases must be re-uploaded with a new batch.
- **What the ephemeral key can and cannot do** (table from the design discussion) and why it must never be funded.

### Tests

- Refactor: emitted chunks reproduce the same references; golden `dist` reference unchanged; chunk count / uniqueness.
- Replicas: addresses match Bee for a known root (vector taken from the existing upload).
- Stamping: `planDepth` on crafted address sets; each address stamped once; stamps verify (signature recovers the owner); bundle round-trip.
- Batch: quote math, calldata vectors (including the validated test-batch calldata), `BatchCreated` matching with a relayed sender, rejection of mutable / wrong-owner batches (mocked viem client).
- Gateway: retry on `invalid batch id`, no re-stamping on retry, verification via a different gateway (mocked `fetch`).

---

## Implementation Phases

One linear stack; each PR is based on the previous branch. Phases 4–6 are independent modules and can be reviewed in parallel.

| # | Branch | Contents | Status |
|---|---|---|---|
| 1 | `swarm-hash/1-file-hash` … `swarm-hash/5-cli` | `swarm:hash` in 5 PRs (file hashing, mantaray, website manifest, file collection, CLI). Chunk emission folded into PRs 1–3 instead of a separate refactor PR. | PRs open |
| 2 | `swarm-deploy/1-replicas` | Root replicas as single-owner chunks (`SwarmChunk.type`) | implemented |
| 3 | `swarm-deploy/2-stamping` | `planDepth`, `stampChunks`, bundle encode/decode | implemented |
| 4 | `swarm-deploy/3-batch` | Pricing/quote, `approve`/`createBatch` calls, `findBatch` by owner, `validateBatch`, `remainingTtl` | implemented |
| 5 | `swarm-deploy/4-gateway` | `pushChunks`, `verifyChunks`, `verifyWebsite` | implemented |
| 6 | `swarm-deploy/5-release-record` | Release records (`releases/swarm/*.json`) | implemented |
| 7 | `swarm-deploy/6-deploy-cli` | `deploy:swarm` (incl. `--dry-run`, `--push-bundle`), `.gitignore` for `swarm-release/` | implemented; acceptance release pending |
| 8 | `swarm-deploy/7-status` | `swarm:status`, top-up calls | implemented |
| 9 | `swarm-deploy/8-docs` | `SWARM_RELEASE.md`, README, CLAUDE.md | implemented |
| — | separate tiny docs PR from `main` | remove stale `admin/` sections from CLAUDE.md | pending |
| 10 | — | Remove this specification | after the acceptance release |

**Acceptance:** one real release of a production build with `yarn deploy:swarm` (operator buys the batch), reference equal to `swarm:hash`, all chunks and files retrievable through both verify gateways, release record committed.

---

## Findings During Implementation

- **Every chunk validated against a real Beeport upload.** For the uploaded build, all 1041 content chunks (data, intermediate, Reed-Solomon parity, manifest nodes) and all 222 root replicas emitted by our code exist on Swarm byte for byte. core-sdk's `makeReplicas` matches Bee, and Bee replicates the root of every file and every manifest node.
- **Batch depth 17 is often enough.** Exact bucket planning shows the current build (1263 chunks) fits depth 17 (fullest bucket 2/2), half the cost of depth 18. `planDepth` picks the minimum per release. A 365-day release costs about 12.4 xBZZ at today's price.
- **Gateways.** `api.gateway.ethswarm.org` refuses to serve this app's reference (302 → `bzz.link/forbidden`) but accepted pre-stamped uploads. Verification uses `download.gateway.ethswarm.org` and `bzz.limo`, which both serve the full release. Push goes to `beeport.xyz` first.
- **Top-up rule.** A top-up must leave at least the 24 h minimum balance; tiny top-ups on an almost-empty batch revert.

---

## Open Questions and Assumptions

Resolved (2026-10-05): erasure coding Medium; default order `sorted`; TTL via required `--ttl-days`; no ENS tooling (ENS is updated manually); local builds allowed; bundles kept locally; `swarm:status` warns when a release has < 7 days left.

- **Assumption:** public gateways accept a full release (~800 chunks) in one session; pushing to both gateways with fallback is sufficient. Confirmed or refuted by the Phase 7 acceptance release.
- **Assumption:** the release operator performs top-ups when `swarm:status` warns.
- **Assumption:** Bee 2.8.1 behaviour (mantaray format, Go 1.26 mime table, erasure coding) holds for the gateways in use; `swarm:hash` tests pin it.
- **Assumption:** depth 17 is unusable (2 slots per bucket); depth 18 (~6 MB effective at Medium) fits the current ~3 MB bundle, and `planDepth` enforces the minimum.
