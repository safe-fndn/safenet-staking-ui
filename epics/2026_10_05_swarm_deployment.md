# Plan: Swarm deployment

Component: root package (`scripts/`, release documentation). No changes to the dApp (`src/`).

---

## Overview

Publish the production build (`dist/`) to Swarm without operating a Bee node and without any long-lived signing key, and make every release an explicit, auditable action:

1. A human buys a fresh **immutable** postage batch from their own wallet on Gnosis Chain, setting a freshly generated **ephemeral key** as batch owner.
2. `deploy:swarm` builds all chunks offline (same code path as `swarm:hash`), stamps each chunk once with the ephemeral key, pushes the pre-stamped chunks to a public gateway, verifies retrieval, discards the key and writes a release record.
3. There is no feed / mutable pointer. Pointing ENS at a release (`contenthash`) is done manually by the ENS owner and is out of scope for the tooling.
4. Anyone can extend a release's lifetime with `topUp(batchId)`; `swarm:status` warns before expiry.

Steps (8 stacked PRs, details in [Implementation Phases](#implementation-phases)):

1. Offline website hashing on core-sdk's chunker and manifest builder.
2. `swarm:hash` CLI with deterministic file collection.
3. Stamping, batch depth planning and stamped-chunk bundle (offline).
4. Gnosis Chain batch module (pricing, purchase parameters, batch discovery and validation).
5. Gateway push and file verification.
6. Release records and `swarm:status` expiry check.
7. `deploy:swarm` CLI.
8. Release runbook (`SWARM_RELEASE.md`), README and CLAUDE.md.
9. Remove this specification.

---

## Architecture Decision

### Context: validated end to end (2026-10-02 – 2026-10-07)

- The first implementation reproduced a real Beeport upload byte for byte (Medium erasure coding, Go mime types, Bee's mantaray serialisation, macOS file order). It was replaced by core-sdk hashing on 2026-10-06 (see Decisions).
- 2026-10-07 acceptance release of the core-sdk implementation: see [Findings](#findings-during-implementation).
- Public gateways `https://beeport.xyz` (Bee 2.8.1) and `https://api.gateway.ethswarm.org` accept chunks with a client-signed `Swarm-Postage-Stamp` header (`POST /chunks` → 201). They reject a stamp for the right batch signed by the wrong key (400 `stamp signature is invalid`), so they validate rather than re-stamp. Chunks pushed via one gateway were retrievable via the other.
- A test batch was bought from a 7702/ERC-4337 smart-account wallet via a bundler with an ephemeral `_owner`; `topUp` from a non-owner account succeeded on the deployed PostageStamp contract (`0x45a1502382541Cd610CC9068e88727426b696293`).

### Decisions

- **No Bee node, no node wallet.** Chunks are built and stamped locally and pushed to public gateways. Gateways only relay; they cannot alter content (content addressing) or forge stamps.
- **One immutable batch per release.** Immutable batches cannot overwrite stamp slots, so stored chunks cannot be evicted by the owner. A fresh batch per release avoids persisting bucket state and makes each release's storage independently top-up-able.
- **Ephemeral, never-funded owner key.** Generated per release, kept in memory only, used solely to sign stamps, then discarded. Without xDAI it cannot send transactions (e.g. `increaseDepth`, which would shorten the TTL), and after discarding it nobody can. A persistent owner key adds no capability we need: top-ups are permissionless, and re-pushing uses the archived stamped chunks.
- **The human wallet buys the batch; the ephemeral key does not.** The buyer has no rights after purchase (only `_owner` is stored), so this keeps the key unfunded, keeps the tooling free of transaction handling, and keeps spending an explicit human approval.
- **Single source of truth for chunks.** `deploy:swarm` uses the exact chunk stream produced by the `swarm:hash` code, so the uploaded reference always equals the offline hash anyone can recompute.
- **No feeds, no ENS tooling.** Every release gets a new reference; the ENS owner sets the `contenthash` manually (e.g. `bzz://<reference>` in the ENS app). The tooling only prints the reference.
- **No erasure coding; core-sdk hashing (revised 2026-10-06).** Originally Medium erasure coding with a Bee-byte-compatible port of Bee's hashtrie and mantaray (~550 lines). Replaced by core-sdk's `ChunkSplitter` and `MantarayNode` (zeroed obfuscation keys for determinism). Trade-offs accepted: no parity chunks or root replicas (a lost chunk needs a re-push), and references no longer match Bee's own `/bzz` upload of the same files, so `swarm:hash` is reproducible but not a second implementation.
- **Byte-sorted file order, always.** The insertion order is ours to choose; byte-sorted paths give the same reference on every OS. `--order apfs` (reproducing manual Beeport uploads from macOS) was removed: `deploy:swarm` uploads its own chunks, so it is not needed.
- **No error document by default.** Beeport always set `error.html`; the build has none. `--error <file>` sets one.
- **Verification by file, not by chunk (2026-10-06).** Fetching every file through `/bzz/<reference>/` from gateways other than the push gateway and comparing sha256 retrieves every manifest and data chunk; a separate per-chunk pass was dropped.
- **Release record = receipt.** git commit, sha256 of every file, settings, tooling versions, batch, gateways, retrieval URLs and the ENS contenthash value. Written even if the final expiry lookup fails, so `swarm:status` always sees the batch.
- **Out of scope:** CI workflow (batches are bought by a person), Safe App changes (root-relative icon paths, path-hosted deployments).
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
   - waits until a matching `BatchCreated` event appears on-chain.
   - Release builds may be local (`yarn build` with production env); the record stores the git commit and the sha256 of every file.
3. Operator sends `approve` (xBZZ) and `createBatch` (PostageStamp) from their wallet, following `SWARM_RELEASE.md`.
4. `deploy:swarm` continues automatically: validates the batch, stamps, pushes, verifies retrieval, discards the key, writes the stamped-chunk bundle (local) and the release record, and prints the reference.
5. Operator opens a PR with the release record. Updating ENS happens separately and manually.
6. Later: `yarn swarm:status` shows remaining TTL per release; anyone tops up batches before expiry.

### CLI output (sketch, illustrative numbers)

```
Swarm release  <reference>
  43 files, 914 chunks, sorted order
Batch          immutable, depth 17 (fullest bucket 2/2)
TTL            ≈ 383 days at today's price (365 requested + 5% margin for price changes)
Cost           ≈ 12.4 xBZZ + gas  (price 147162 per chunk per block)

Step 1 — xBZZ 0xdBF3…68da → approve
  spender  0x45a1502382541Cd610CC9068e88727426b696293
  amount   234700000000000000
Step 2 — PostageStamp 0x45a1…6293 → createBatch
  _owner                   0x…(ephemeral)      _depth        17
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
| `swarm:hash` | Offline reference of a build folder (`scripts/swarm-hash.ts`) |
| `deploy:swarm` | Prepare → wait for batch → stamp → push → verify → record (`scripts/deploy-swarm.ts`) |
| `swarm:status` | Remaining TTL / expiry for every recorded release (`scripts/swarm-status.ts`) |

### Modules (`scripts/swarm/`)

- `website.ts`: `hashWebsite(files, options, onChunk)` chunks every file (core-sdk `ChunkSplitter`) and builds the manifest (core-sdk `MantarayNode`, zeroed obfuscation keys), emitting every chunk for stamping. `content-type.ts`: fixed table of web content types.
- `collect.ts`: every regular file (dotfiles included, symlinks refused, nothing filtered) in byte-sorted path order.
- `stamping.ts`:
  - `planDepth(chunks)`: bucket = top 16 bits of the address, slots per bucket = `2^(depth-16)`, returns the minimal depth ≥ 17 with all buckets fitting (immutable: a single full bucket fills the batch).
  - `stampChunks(chunks, key, batchId, depth)`: core-sdk `Stamper`, **each unique address stamped exactly once**.
  - Bundle: `swarm-release/<reference>/bundle.bin` (gitignored, local only), records `address(32) | stamp(113) | length(u16) | data`, plus `release.json` (the pending record). Re-pushing needs no key.
- `batch.ts` (viem, Gnosis):
  - constants: PostageStamp `0x45a1502382541Cd610CC9068e88727426b696293`, xBZZ `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da` (16 decimals), chain 100;
  - `quote(pricing, depth, ttlDays)`: `perChunk = max(minimumInitialBalancePerChunk, lastPrice × blocks) × safety margin`, total = `perChunk << depth`;
  - `purchaseCalls(owner, quote, nonce)` → named params + calldata for `approve` and `createBatch(owner, perChunk, depth, 16, nonce, true)`;
  - `findBatch(client, owner, fromBlock)`: scans `BatchCreated` logs and matches `owner` (not indexed → filter client-side); works for relayed (ERC-4337) purchases;
  - `validateBatch`: owner, depth, bucket depth 16, `immutableFlag == true`;
  - `remainingTtl`, `isBatchGone` (PostageStamp `BatchDoesNotExist`).
- `gateway.ts`: `pushChunks` (`POST /chunks` with `Swarm-Postage-Stamp`; limited concurrency; waits up to 20 min for a new batch; retries 429/5xx; never re-stamps); `verifyWebsite` (`GET /bzz/<reference>/<path>` for every file via a **different** gateway, sha256 comparison, retries); `verifyPage` (loads the page and its assets, warnings only); `subdomainUrl` (core-sdk `Reference.toCid("manifest")`).
- `release.ts`, `expiry.ts`: release records, `completeRelease`, top-up calls for `swarm:status`.

### Release record

`releases/swarm/<yyyy-mm-dd>-<shortref>.json` (committed): reference, created-at, git commit (+ dirty flag), sha256 of every file, settings (order, index/error document), chunk count, tooling versions (node, core-sdk, viem), batch (id, depth, per-chunk balance, owner, purchase tx, block, estimated expiry or null), push/verify gateways, retrieval URLs (subdomain + `/bzz/<ref>/` per verify gateway), ENS contenthash value, bundle sha256. `swarm:status` reads these.

### Environment variables (scripts only, all optional)

| Variable | Default | Purpose |
|---|---|---|
| `SWARM_GNOSIS_RPC_URL` | `https://rpc.gnosischain.com` | Gnosis Chain reads (pricing, events, balances) |
| `SWARM_PUSH_GATEWAYS` | `https://beeport.xyz,https://api.gateway.ethswarm.org` | Push gateways, tried in order |
| `SWARM_VERIFY_GATEWAYS` | `https://download.gateway.ethswarm.org,https://bzz.limo` | Retrieval verification |

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

- Website hashing: pinned reference (catches core-sdk changes), determinism, metadata sensitivity, manifest read back from the emitted chunks; file collection determinism and change sensitivity (incl. `app..js`).
- Stamping: `planDepth` on crafted address sets; each address stamped once; stamps verify (signature recovers the owner); bundle round-trip.
- Batch: quote math, calldata vectors (including the validated test-batch calldata), `BatchCreated` matching with a relayed sender, rejection of mutable / wrong-owner batches, gone vs failed lookups (mocked viem client).
- Gateway: retry on `invalid batch id`, no re-stamping on retry, file verification with retries, subdomain CID vector (mocked `fetch`).
- Records/status: receipt round-trip, record written when the expiry lookup fails, EXPIRED only when confirmed, UNKNOWN exits 1.

---

## Implementation Phases

One linear stack of 8 PRs (~190–350 changed lines each, code + tests), each based on the previous branch. Restructured 2026-10-06/07: core-sdk hashing replaced `swarm-hash/1-file-hash`, `2-mantaray` and `swarm-deploy/1-replicas`; `4-collect` merged into `5-cli`, `7-status` into `5-release-record`. All earlier PRs were closed; the stack is reopened from scratch.

| # | Branch | Contents | Status |
|---|---|---|---|
| 1 | `swarm-hash/3-website` | `hashWebsite` on core-sdk, content types | implemented |
| 2 | `swarm-hash/5-cli` | `collectWebsiteFiles`, `swarm:hash` CLI | implemented |
| 3 | `swarm-deploy/2-stamping` | `planDepth`, `stampChunks`, bundle encode/decode | implemented |
| 4 | `swarm-deploy/3-batch` | Pricing/quote, `approve`/`createBatch` calls, `findBatch` by owner, `validateBatch`, `remainingTtl` | implemented |
| 5 | `swarm-deploy/4-gateway` | `pushChunks`, `verifyWebsite`, `verifyPage`, `subdomainUrl` | implemented |
| 6 | `swarm-deploy/5-release-record` | Release records, `swarm:status`, top-up calls | implemented |
| 7 | `swarm-deploy/6-deploy-cli` | `deploy:swarm` (incl. `--dry-run`, `--push-bundle`), `completeRelease`, `.gitignore` for `swarm-release/` | implemented; acceptance release done |
| 8 | `swarm-deploy/8-docs` | `SWARM_RELEASE.md`, README, CLAUDE.md | implemented |
| — | separate docs PR from `main` | remove stale `admin/` sections from CLAUDE.md | merged (#108) |
| 9 | — | Remove this specification | after merge |

**Acceptance:** one real release of a production build with `yarn deploy:swarm` (operator buys the batch), reference equal to `swarm:hash`, all files retrievable through both verify gateways, release record written. Done 2026-10-07 (see Findings).

---

## Findings During Implementation

- **Acceptance release (2026-10-07), core-sdk implementation.** Reference `63aac9a2…fcb614`, 43 files, 914 chunks, immutable batch depth 17 (2-day test TTL). Pushed via `beeport.xyz`; every file verified via `download.gateway.ethswarm.org` and `bzz.limo`; app loads at the subdomain URL. A fresh `yarn build` + `swarm:hash` reproduced the same reference.
- **No erasure coding saves ~28 % of chunks.** 914 instead of 1263 for the same build; still depth 17.
- **(Historical, Bee-compatible implementation) Every chunk validated against a real Beeport upload.** For the uploaded build, all 1041 content chunks (data, intermediate, Reed-Solomon parity, manifest nodes) and all 222 root replicas emitted by our code exist on Swarm byte for byte. core-sdk's `makeReplicas` matches Bee, and Bee replicates the root of every file and every manifest node.
- **Batch depth 17 is often enough.** Exact bucket planning shows the build (1263 chunks with erasure coding, 914 without) fits depth 17 (fullest bucket 2/2), half the cost of depth 18. `planDepth` picks the minimum per release. A 365-day release costs about 12.4 xBZZ at today's price.
- **Gateways.** `api.gateway.ethswarm.org` refuses to serve this app's reference (302 → `bzz.link/forbidden`) but accepted pre-stamped uploads. Verification uses `download.gateway.ethswarm.org` and `bzz.limo`, which both serve the full release. Push goes to `beeport.xyz` first.
- **Top-up rule.** A top-up must leave at least the 24 h minimum balance; tiny top-ups on an almost-empty batch revert.

---

## Open Questions and Assumptions

Resolved (2026-10-05): default order `sorted`; TTL via required `--ttl-days`; no ENS tooling (ENS is updated manually); local builds allowed; bundles kept locally; `swarm:status` warns when a release has < 7 days left.
Resolved (2026-10-06): no erasure coding, core-sdk hashing; no CI workflow; Safe App changes out of scope.
Resolved (2026-10-07): public gateways accept a full release in one session (acceptance release).

- **Assumption:** the release operator performs top-ups when `swarm:status` warns.
- **Assumption:** core-sdk's chunking and manifest format stays stable at the pinned version; the pinned reference in `swarm-website.test.ts` fails on any change, and the record's tooling versions say which version made a release.
- **Limitation:** `swarm:hash` shares its code with `deploy:swarm`, so it is reproducible but not a second implementation. Independent checks are file-level: fetch every file through any gateway and compare with the record's `fileChecksums`.
