# Plan: Swarm deployment

Component: root package (`scripts/`, release docs). No changes to the dApp (`src/`).

## Overview

Publish the production build (`dist/`) to Swarm without a Bee node or any long-lived key, with every release an explicit, auditable action:

1. A person buys a fresh **immutable** postage batch on Gnosis Chain from their own wallet, with a freshly generated **ephemeral key** as batch owner.
2. `deploy:swarm` chunks the build offline (same code as `swarm:hash`), stamps each chunk once with the ephemeral key, drops the key, pushes the stamped chunks to a public gateway, verifies every file through other gateways and writes a release record.
3. No feeds. Pointing ENS at a release (`contenthash` = `bzz://<reference>`) is a separate, manual step.
4. Anyone can extend a release with `topUp(batchId)`; `swarm:status` warns before expiry.

## Decisions

- **No Bee node.** Chunks are built and stamped locally and pushed via public gateways, which validate stamps and cannot alter content-addressed chunks.
- **One immutable batch per release.** Stamp slots can't be overwritten, so nothing can evict a release's chunks; each release is topped up independently.
- **Ephemeral, never-funded owner key.** Generated per release, memory only, used only to sign stamps, then dropped. Without gas it can't shorten the TTL (`increaseDepth`). Top-ups are permissionless and re-pushing uses the saved stamped chunks, so a persistent key adds nothing.
- **A person buys the batch.** Keeps spending an explicit human approval and the tooling free of transaction handling. The buyer has no rights afterwards. Since anyone can create a batch naming our owner key, the script only accepts one that matches depth, immutability and the quoted amount, so a front-run purchase can neither shorten nor abort the release.
- **Hashing with `@ethersphere/core-sdk`** (pinned): `ChunkSplitter` for files, `MantarayNode` for the manifest with zeroed obfuscation keys (core-sdk's default is random). No erasure coding, no encryption.
  - Trade-offs: a lost chunk needs a re-push (no parity chunks), and references differ from Bee's own `/bzz` upload of the same files, so `swarm:hash` is reproducible but not a second implementation.
- **Deterministic reference.** Every regular file (dotfiles included, nothing filtered, symlinks refused) in byte-sorted path order; fixed content-type table; `index.html` as index document, no error document unless `--error` is given.
- **Verification by file.** Every file is fetched through `/bzz/<reference>/` from gateways other than the push gateway and compared by sha256, which also retrieves every manifest and data chunk.
- **Release record = receipt.** git commit, sha256 of every file, settings, tooling versions, batch, gateways, retrieval URLs, ENS contenthash value. Written even if the final expiry lookup fails.
- **Explicit TTL.** `--ttl-days` is required; the cost is printed before any purchase (current price + 5% margin).
- **Local builds and bundles.** The stamped-chunk bundle stays local (gitignored); without it a re-push needs a new batch.
- **Out of scope:** CI workflow (a person buys each batch), Safe App changes (root-relative icon paths, path-hosted deployments), ENS tooling.

### Alternatives considered

- **Own Bee light node** (`/bzz` tar upload): simplest upload, but a node to operate and a long-lived funded key.
- **Manual Beeport uploads:** mutable batches stamped by Beeport's node, not scriptable, reference depends on uploader OS/browser.
- **Persistent stamping key:** a long-lived secret that can fill batches and shorten every live release's TTL.
- **Ephemeral key buys the batch:** fully automated, but a funded hot key and no human approval of spending.
- **Bee-byte-compatible hashing** (own port of Bee's hashtrie/mantaray with erasure coding and root replicas; implemented first and validated against a real Beeport upload): ~550 more lines; dropped for core-sdk.
- **Feeds** for a stable address: updates must be explicit ENS changes.

## User flow

1. Build `dist/` (`yarn build` with production env).
2. `yarn deploy:swarm ./dist --ttl-days <n>` prints the reference, chunk count, batch depth, cost, and the `approve` + `createBatch` calls for the operator's wallet, then waits for the batch.
3. The operator sends both transactions on Gnosisscan (`SWARM_RELEASE.md`).
4. The script validates the batch, stamps, drops the key, saves `swarm-release/<ref>/`, pushes, verifies, writes `releases/swarm/<date>-<ref>.json` and prints the URLs. Failures resume with `--push-bundle swarm-release/<ref>`.
5. The operator commits the record; ENS is updated separately.
6. `yarn swarm:status` shows remaining days; anyone tops up before expiry.

## Tech specs

| Module (`scripts/swarm/`) | Responsibility |
|---|---|
| `website.ts`, `content-type.ts` | `hashWebsite(files, options, onChunk)`: core-sdk chunking and manifest, every chunk emitted for stamping |
| `collect.ts` | Deterministic file collection |
| `stamping.ts` | `planDepth` (smallest immutable depth ≥ 17 whose 16-bit buckets fit all chunks), `stampChunks` (core-sdk `Stamper`, each chunk once), bundle `address(32) \| stamp(113) \| length(u16) \| data` |
| `batch.ts` | PostageStamp `0x45a1502382541Cd610CC9068e88727426b696293`, xBZZ `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da` (16 decimals): quote, `approve`/`createBatch` calldata, `findBatch` by owner with full checks (depth, immutable, amount paid; skips front-run batches; works for ERC-4337), `remainingTtl`, `isBatchGone` |
| `gateway.ts` | `pushChunks` (pre-stamped `POST /chunks`, waits ≤ 20 min for a new batch, retries, never re-stamps), `verifyWebsite`, `verifyPage` (warnings only), `subdomainUrl` (core-sdk CID) |
| `release.ts`, `expiry.ts` | Records, `completeRelease`, expiry states (EXPIRED only when confirmed on-chain, UNKNOWN on lookup failure), top-up calls |

CLIs: `swarm:hash` (`scripts/swarm-hash.ts`), `deploy:swarm` (`scripts/deploy-swarm.ts`), `swarm:status` (`scripts/swarm-status.ts`).

Env (optional): `SWARM_GNOSIS_RPC_URL` (default `https://rpc.gnosischain.com`), `SWARM_PUSH_GATEWAYS` (default `https://beeport.xyz,https://api.gateway.ethswarm.org`), `SWARM_VERIFY_GATEWAYS` (default `https://download.gateway.ethswarm.org,https://bzz.limo`). No keys or credentials in env.

Tests: pinned reference (catches core-sdk changes), manifest read-back, determinism and change sensitivity; stamp signatures and bundle round-trip; calldata vectors from a real purchase; gateway retries and file verification (mocked fetch); records written on expiry-lookup failure; EXPIRED vs UNKNOWN.

## Implementation phases

One linear stack; each PR is based on the previous branch (~190–350 changed lines each).

| # | Branch | Contents | Status |
|---|---|---|---|
| 1 | `swarm-hash/3-website` | Website hashing on core-sdk, content types | implemented |
| 2 | `swarm-hash/5-cli` | File collection, `swarm:hash` | implemented |
| 3 | `swarm-deploy/2-stamping` | Depth planning, stamping, bundle | implemented |
| 4 | `swarm-deploy/3-batch` | Gnosis pricing, purchase calls, batch discovery | implemented |
| 5 | `swarm-deploy/4-gateway` | Push, file verification, subdomain URL | implemented |
| 6 | `swarm-deploy/5-release-record` | Release records, `swarm:status` | implemented |
| 7 | `swarm-deploy/6-deploy-cli` | `deploy:swarm` (`--dry-run`, `--push-bundle`) | implemented |
| 8 | `swarm-deploy/8-docs` | `SWARM_RELEASE.md`, README, CLAUDE.md | implemented |
| 9 | — | Remove this specification | after merge |

**Acceptance** (done 2026-10-07): real release via `deploy:swarm`, reference equal to `swarm:hash`, every file retrievable through both verify gateways, record written.

## Findings

- **Acceptance release:** reference `63aac9a2…fcb614`, 43 files, 914 chunks, depth 17. Pushed via `beeport.xyz`, verified via `download.gateway.ethswarm.org` and `bzz.limo`, app loads at the subdomain URL; a fresh build reproduced the reference.
- **Gateways:** `beeport.xyz` and `api.gateway.ethswarm.org` accept client-stamped chunks and reject stamps signed by the wrong key. `api.gateway.ethswarm.org` refuses to *serve* this app (302 → `bzz.link/forbidden`).
- **Purchases:** a batch bought from an EIP-7702/ERC-4337 smart account with an ephemeral `_owner` works; `topUp` from a non-owner account works.
- **Depth 17 fits** this build (fullest bucket 2/2); a 365-day release costs about 12 xBZZ at today's price.
- **Top-up rule:** the batch must keep ≥ 24 h of balance after a top-up; tiny top-ups on an almost-empty batch revert.
- **Path URLs need a trailing slash** on `bzz.limo` (`/bzz/<ref>/`); the subdomain URL avoids this.

## Assumptions

- The release operator tops up when `swarm:status` warns.
- core-sdk's chunk and manifest format stays stable at the pinned version; the pinned test reference fails on any change, and each record lists the tooling versions that made it.
