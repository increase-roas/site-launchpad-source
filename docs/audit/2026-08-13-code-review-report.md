## Code Review Results

**Scope:** full-tree zip audit of `site-launchpad-source.zip` vs empty git base `71537b306cf17335649e55e7c8e309580c3e338a` (172 tracked files). Vendor `client/src/components/ui/` deprioritized.
**Intent:** Multi-client launchpad: persist client/Astro/funnel config, encrypt secrets, S3 uploads, server-gated launch/deploy, generate `client.config.ts` and `funnel.config.ts`. Secrets must not leak after save. One operator action must not corrupt another client's data.
**Mode:** markdown, report-only

**Reviewers:** correctness, testing, maintainability, security, performance, api-contract, data-migration, reliability
- testing -- behavioral APIs plus existing Vitest files
- maintainability -- new app, well over 200 executable lines
- security -- OAuth, secrets, uploads, public storage proxy
- performance -- list N+1, 30MB dataUrls, sharp on the request path
- api-contract -- tRPC AppRouter error/response shapes
- data-migration -- Drizzle SQL 0000-0004
- reliability -- DB-unavailable login, hung Forge/S3, partial writes
- Independent Codex adversarial review (requested gpt-5.6-luna at xhigh; serving model/effort unverified; `independence_verified: true`)

### Triage Groups

| Group | Findings | Context | Preferred Resolution | Why |
|-------|----------|---------|----------------------|-----|
| Cross-client overwrite (apply-queue) | #1, #37 | Settings and Paid Ads keep stale editor state after a sidebar client switch | Remount/reset on `clientId` first (#1), then clear `selectedFunnelId` (#37) | Same React instance reuse; #1 is the P0 data-loss path |
| Secrets on the wire (apply-queue) | #4, #28, #12 | Funnel/Astro get decrypt ciphertext into JSON; the "no raw secrets" test is mocked | Redact #4 then #28; make #12 call real redaction | Contradicts the product rule that saved secrets are never returned |
| Session and storage auth (mixed) | #2, #7, #5 | Public asset proxy, empty JWT signing, shared-tenant tRPC | Fail-closed JWT (#7) and auth the proxy (#2); decide tenant model (#5) | #5 is a product decision; #2 and #7 are mechanical |
| Lost updates (apply-queue) | #8, #15, #16, #24, #38 | Autosave, full-row PUT, funnel save resetting deployed, drag-reorder | Trailing autosave + optimistic `updatedAt`; do not reset deployed on content save | Last-write-wins across editors and tabs |
| Partial persistence (apply-queue) | #3, #18, #32 | Login, create-client, and upload are multi-step without rollback | Throw when DB is missing; wrap create in a transaction; compensate failed DB after S3 | Failures look like success or leave orphans |
| Readiness integrity (apply-queue) | #13, #36 | Astro save can empty `productCategories` or accept duplicate weekdays | Seed categories from the client row; reuse the unique-day hours schema | Launch checklist then disagrees with a successful Settings save |
| Migrations and errors | #11, #26, #22, #30 | No Drizzle journal; `deploymentStatus` defaults to draft; NOT_FOUND becomes BAD_REQUEST | Commit journal; backfill status; rethrow TRPCError / map not-found correctly | Deploy and client error handling will mislead operators |

### P0 -- Critical

| # | File | Issue | Reviewer | Confidence |
|---|------|-------|----------|------------|
| 1 | `client/src/pages/AstroClientEditor.tsx:52` | Client switch saves Client A onto Client B | correctness | 100 |
| 2 | `server/_core/storageProxy.ts:5` | Unauthenticated storage proxy signs any key | security, adversarial-codex | 100 |
| 3 | `server/db.ts:39` | Missing DB still issues a successful login cookie | reliability, adversarial-codex | 100 |
| 4 | `server/funnelConfigDb.ts:83` | Funnel get returns decrypted pixel ID and GHL webhook | security, api-contract, adversarial-codex | 100 |
| 5 | `server/routers/clients.ts:98` | Any logged-in user can mutate every client (design) | security, adversarial-codex | 100 |
| 7 | `server/_core/env.ts:3` | Empty `JWT_SECRET` still signs sessions | security | 50 |

- **#1** -- Switching clients on Settings keeps `hydratedRef` true and the previous form. The next autosave writes that form to the new `clientId`. Key the route by `clientId` and reset hydration. Corroborated by validator.
- **#2** -- `GET /manus-storage/*` has no session check and presigns deterministic keys such as `clients/{id}-{folder}/hero.webp`. Require a session and constrain keys. Independent Codex agreement.
- **#3** -- `upsertUser` warns and returns when `getDb()` is null, then OAuth still sets a one-year cookie. Throw instead of returning. Independent Codex agreement.
- **#4** -- `decryptOptional` puts live `metaPixelId` and `ghlWebhookUrl` on `funnelBuilder.get/save/deploy`. Return presence flags only. Independent Codex agreement. Violates "never return raw secret values after save."
- **#5** -- **Design call.** `protectedProcedure` plus unscoped `listClients()` means every OAuth user (default role `user`) can read and write every tenant, including secrets. `adminProcedure` exists but is unused here. Decide: shared-tenant ops tool vs ownership/admin gate. Do not treat this as accidental IDOR until that product choice is explicit.
- **#7** -- `cookieSecret: process.env.JWT_SECRET ?? ""` signs HS256 with an empty key. Fail closed like `getEncryptionKey()`. Confidence 50, validator confirmed the empty-key path.

### P1 -- High

| # | File | Issue | Reviewer | Confidence |
|---|------|-------|----------|------------|
| 8 | `client/src/pages/AstroClientEditor.tsx:124` | Autosave drops edits typed during an in-flight save | correctness, adversarial-codex | 100 |
| 9 | `client/src/pages/ClientEditor.tsx:222` | ClientEditor is 1041 lines | maintainability | 100 |
| 10 | `client/src/pages/ComponentShowcase.tsx:1` | Unrouted 1437-line showcase | maintainability | 100 |
| 11 | `drizzle.config.ts:10` | Missing `drizzle/meta/_journal.json` | data-migration | 100 |
| 12 | `server/astroConfig.router.test.ts:133` | Vacuous secret non-leakage test | testing | 100 |
| 13 | `server/astroConfigDb.ts:211` | Astro save can persist `productCategories: []` | correctness | 100 |
| 14 | `server/clientSecurity.ts:6` | `JWT_SECRET` is also the AES key (design) | security, adversarial-codex | 100 |
| 15 | `server/db.ts:129` | Full-row client writes last-write-wins | correctness, adversarial-codex | 100 |
| 16 | `server/funnelConfigDb.ts:302` | Funnel save resets deployed to draft | adversarial-codex | 100 |
| 17 | `server/routers/clients.ts:100` | N+1 `getClientView` on `clients.list` | performance | 100 |
| 18 | `server/routers/clients.ts:111` | Create client is not transactional | correctness, reliability, adversarial-codex | 100 |
| 22 | `server/routers/workspace.ts:17` | Not-found remapped to BAD_REQUEST | api-contract | 100 |
| 23 | `server/storage.ts:42` | Forge/S3 `fetch` has no timeout | reliability | 100 |
| 24 | `client/src/components/funnels/FunnelConfigEditor.tsx:429` | Deploy Funnel uses stale saved config | correctness | 75 |
| 25 | `client/src/lib/workspaceNavigation.ts:6` | Dual settings editors (design) | maintainability | 75 |
| 26 | `drizzle/0003_slow_speedball.sql:30` | `deploymentStatus` default skips backfill | data-migration | 75 |
| 28 | `server/astroConfigDb.ts:159` | Astro get returns decrypted generated config | security | 75 |
| 29 | `server/imageProcessing.ts:79` | Up to 18 sharp passes on the request path | performance | 75 |
| 30 | `server/routers/astroConfig.ts:23` | All errors mapped to BAD_REQUEST | reliability | 75 |
| 31 | `server/routers/clients.ts:159` | 30MB dataUrl held in request memory | performance | 75 |
| 32 | `server/routers/clients.ts:171` | S3 PUT then DB upsert can orphan objects | reliability | 75 |

- **#8** -- `saveNow` returns while `isPending`; `onSuccess` clears `dirtyRef`. Queue a trailing save. Independent Codex agreement.
- **#13** -- Default Astro categories are all `enabled: false`. First Settings autosave writes empty `productCategories`, which breaks launch readiness.
- **#14** -- **Design call.** SHA-256(`JWT_SECRET`) is the AES-256-GCM key. A session-secret rotation bricks ciphertext. Use a dedicated versioned data key.
- **#16** -- `saveFunnelBuilder` always sets `deploymentStatus: "draft"` and nulls deploy timestamps. A stale editor undoes "Mark deployed".
- **#24** -- Deploy sends only ids; hydrate `setForm`s from every refetch, so unsaved copy is neither deployed nor kept.
- **#25** -- **Design call.** `/clients/:id` and `/workspace/:id/settings` both count as settings but mount different editors that both write `businessName` / phone / theme.

### P2 -- Moderate

| # | File | Issue | Reviewer | Confidence |
|---|------|-------|----------|------------|
| 33 | `server/db.ts:175` | First secret save is check-then-insert | correctness, adversarial-codex | 100 |
| 34 | `server/routers/clients.ts:171` | Concurrent same-slot uploads mix bytes and metadata | adversarial-codex | 100 |
| 35 | `server/workspaceDb.ts:45` | Concurrent first opens race unique inserts | adversarial-codex | 100 |
| 36 | `shared/astroConfig.ts:238` | Duplicate weekday hours pass Astro save, fail launch | adversarial-codex | 100 |
| 37 | `client/src/pages/PaidAdsWorkspace.tsx:171` | Funnel editor keeps prior `funnelId` after client switch | correctness | 75 |
| 38 | `client/src/pages/WebsiteWorkspace.tsx:196` | Homepage order saves race and refetch clobbers drafts | correctness | 75 |

### Actionable Findings

| # | File | Issue | Route | Notes |
|---|------|-------|-------|-------|
| 1 | `AstroClientEditor.tsx:52` | Client switch overwrites the other client | `manual -> downstream-resolver` | suggested_fix present |
| 2 | `storageProxy.ts:5` | Public storage presign | `manual -> downstream-resolver` | suggested_fix present |
| 3 | `db.ts:39` | Login succeeds without DB | `manual -> downstream-resolver` | suggested_fix present |
| 4 | `funnelConfigDb.ts:83` | Decrypted secrets on funnel get | `manual -> downstream-resolver` | suggested_fix present |
| 7 | `env.ts:3` | Empty JWT still signs | `gated_auto -> downstream-resolver` | suggested_fix present |
| 8 | `AstroClientEditor.tsx:124` | Autosave drops newer edits | `manual -> downstream-resolver` | suggested_fix present |
| 9 | `ClientEditor.tsx:222` | File over 1k lines | `manual -> downstream-resolver` | split modules |
| 10 | `ComponentShowcase.tsx:1` | Delete unrouted showcase | `gated_auto -> downstream-resolver` | suggested_fix present |
| 11 | `drizzle.config.ts:10` | Commit Drizzle journal | `manual -> downstream-resolver` | suggested_fix present |
| 12 | `astroConfig.router.test.ts:133` | Un-mock secret redaction test | `gated_auto -> downstream-resolver` | suggested_fix present |
| 13 | `astroConfigDb.ts:211` | Do not persist empty categories | `gated_auto -> downstream-resolver` | suggested_fix present |
| 15 | `db.ts:129` | Optimistic concurrency on client row | `manual -> downstream-resolver` | suggested_fix present |
| 16 | `funnelConfigDb.ts:302` | Stop resetting deployed on save | `manual -> downstream-resolver` | suggested_fix present |
| 17 | `clients.ts:100` | Batch `clients.list` | `manual -> downstream-resolver` | suggested_fix present |
| 18 | `clients.ts:111` | Transaction around create | `manual -> downstream-resolver` | suggested_fix present |
| 22 | `workspace.ts:17` | Preserve NOT_FOUND | `gated_auto -> downstream-resolver` | suggested_fix present |
| 23 | `storage.ts:42` | AbortSignal.timeout on Forge/S3 | `gated_auto -> downstream-resolver` | suggested_fix present |
| 24 | `FunnelConfigEditor.tsx:429` | Save before deploy; skip dirty hydrate | `manual -> downstream-resolver` | suggested_fix present |
| 26 | `0003_slow_speedball.sql:30` | Backfill deploymentStatus | `gated_auto -> downstream-resolver` | suggested_fix present |
| 28 | `astroConfigDb.ts:159` | Stop returning decrypted generated config on get | `manual -> downstream-resolver` | suggested_fix present |
| 29 | `imageProcessing.ts:79` | Bound sharp work / offload | `manual -> downstream-resolver` | suggested_fix present |
| 30 | `astroConfig.ts:23` | Stop mapping all errors to BAD_REQUEST | `gated_auto -> downstream-resolver` | suggested_fix present |
| 31 | `clients.ts:159` | Stop 30MB dataUrl uploads | `manual -> downstream-resolver` | suggested_fix present |
| 32 | `clients.ts:171` | Compensate S3 if DB upsert fails | `manual -> downstream-resolver` | suggested_fix present |
| 37 | `PaidAdsWorkspace.tsx:171` | Reset funnel selection on client switch | `gated_auto -> downstream-resolver` | suggested_fix present |
| 38 | `WebsiteWorkspace.tsx:196` | Serialize section saves; keep dirty drafts | `gated_auto -> downstream-resolver` | suggested_fix present |

Human decision gates (not in the apply queue): **#5** tenant/authz model, **#14** dedicated encryption key, **#25** one settings editor.

### Coverage

- Files reviewed: 172 (zip snapshot). Untracked: none. Plan: not discovered; settlement suppression not evaluated.
- project-standards: not run (no applicable AGENTS.md/CLAUDE.md).
- SQL injection: none found; queries use Drizzle `eq`/`insert` (no `$queryRaw`).
- cross_model_route: `codex`; model_requested: `gpt-5.6-luna`; model_actual: `unverified`; effort_requested: `xhigh`; effort_actual: `unverified`; receipt_supported: `false`; independence_verified: `true`.
- Validator skipped 9 findings with ordinary reviewer plus independent Codex (`independence_verified: true`) and `first_evidence` (#2, #3, #4, #5, #8, #14, #15, #18, #33).
- Validator batch: 30 remaining P0/P1/actionable; dropped 6 as false/preference: SameSite CSRF (#6), cloned upload DRY (#19), ClientInput cast (#20), nested deploy shape unused (#21), enum deploy-window (#27), raw Error rethrow (#39).
- Preliminary fast-pass items withdrawn: 0 (storage proxy and shared-tenant access both survived as #2 and #5). SameSite was not a fast-pass item; validator rejected it separately.
- Mode-aware demotion: 13 (testing nits to testing_gaps; maintainability/reliability P2/P3 style to residual_risks).
- Removable surface: ~1437 lines / 1 file across #10 (`ComponentShowcase.tsx`), plus unused AIChatBox/Map/ManusDialog if no remaining imports.
- Residual risks: Manus `_core` LLM/voice/map modules are unmounted but still contain SSRF-shaped `fetch(audioUrl)`; Forge 307 host is not allowlisted; `clients.status` values `live`/`issue` are rendered but launch only writes `ready`; empty secret fields cannot be cleared after save; callsite completeness grep-only.
- Testing gaps: no client-switch overwrite test; router suites mock DB so ownership/deploy gates never run; no unauthenticated `createCaller({user:null})` cases; no concurrent save/upload tests; no JWT rotation tests.

---

### Verdict

**Not ready.**

Fix order: stop the Settings client-switch overwrite (#1), fail-closed JWT (#7), authenticate the storage proxy (#2), redact funnel/Astro secrets (#4, #28), then lost-update and partial-write paths (#8, #16, #18, #24). Decide #5 (shared tenant vs admin/ownership) before treating remaining authz as a bug vs an ops model.
