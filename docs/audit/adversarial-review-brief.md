# Adversarial review brief — site-launchpad zip snapshot

Intent: Internal multi-client launchpad for Hot Tub Launch. Authenticated operators persist client/Astro/funnel config, encrypt Wrangler/GHL secrets, upload marketing assets to S3, compute launch readiness, and generate `client.config.ts` / `funnel.config.ts`. Launch and deploy-funnel actions are server-gated. Secrets must never return in the clear after save. A user action must not corrupt another client's data.

This is a full-tree audit of an extracted zip (no git history). Treat `client/src/components/ui/` and `pnpm-lock.yaml` as generated/vendor noise; do not spend budget there. Focus on executable app code.

## Material risk divisions

1. **Auth and privilege** — Manus OAuth + JWT cookie sessions; `protectedProcedure` vs unused `adminProcedure`; any logged-in user can list/get/mutate every client and decrypt-backed generated configs. Paths: `server/_core/oauth.ts`, `server/_core/sdk.ts`, `server/_core/trpc.ts`, `server/_core/context.ts`, `server/routers.ts`, `server/db.ts` (`upsertUser` / `ownerOpenId`).

2. **Client isolation and IDOR** — All writes keyed by client-supplied `clientId` / `funnelId` with no ownership row. Funnel APIs take both IDs; check whether a funnel from client A can be saved/deployed under client B. Paths: `server/routers/clients.ts`, `server/routers/astroConfig.ts`, `server/routers/funnelBuilder.ts`, `server/routers/workspace.ts`, `server/funnelConfigDb.ts`, `server/workspaceDb.ts`, `server/astroConfigDb.ts`.

3. **Secrets at rest and in transit** — AES-256-GCM keyed from SHA-256(JWT_SECRET); generated configs decrypt for authenticated callers; secret save is last-write-wins with get-then-insert. Paths: `server/clientSecurity.ts`, `server/astroConfigDb.ts`, `server/funnelConfigDb.ts`, `shared/astroConfig.ts`, `shared/funnelConfig.ts`.

4. **Unauthenticated storage proxy and uploads** — Public `GET /manus-storage/*` presigns arbitrary keys; `storagePutExact` uses `clients/${id}-${sanitizedShortName}/...`; 30MB data-URL uploads. Paths: `server/_core/storageProxy.ts`, `server/storage.ts`, `server/imageProcessing.ts`, `server/routers/clients.ts` `uploadAsset`, `server/routers/astroConfig.ts` `uploadAsset`, `shared/client.ts` `sanitizeClientFolder`.

5. **Concurrent saves / lost updates** — Save-on-change editors, last-write-wins `updateClient` / JSON blobs, secret setup race on first insert, asset unique (clientId, slot) upsert. Paths: `client/src/pages/AstroClientEditor.tsx`, `client/src/pages/ClientEditor.tsx`, `client/src/components/funnels/FunnelConfigEditor.tsx`, `client/src/contexts/WorkspaceContext.tsx`, `server/db.ts`.

6. **Validation bypass and generated-config integrity** — Zod schemas on server vs UI; readiness/launch gating; funnel deploy vs mark-deployed; encrypted generated file contents. Paths: `shared/client.ts`, `shared/astroConfig.ts`, `shared/funnelConfig.ts`, `server/routers/clients.ts` `launch`, `server/funnelConfigDb.ts`.

7. **SQL / schema / persistence** — Drizzle+mysql2 parameterized queries expected; still check raw SQL, JSON columns, enum ALTER, silent no-op when `DATABASE_URL` missing (`getDb` returns null, `upsertUser` returns). Paths: `server/db.ts`, `drizzle/schema.ts`, `drizzle/*.sql`.

8. **Error handling that leaks or false-succeeds** — `plainError` maps any Error.message to BAD_REQUEST; DB-unavailable paths warn and continue; OAuth callback 500. Paths: `server/_core/index.ts`, `server/db.ts`, `server/routers/astroConfig.ts`, `server/_core/oauth.ts`.

## Generated repetition

Treat `client/src/components/ui/*` as vendor. Cover generators via `shared/astroConfig.ts`, `shared/funnelConfig.ts`, and their tests rather than every tab component.

## Cross-division interactions

- Authenticated operator A overwrites client B by guessing `clientId` while B's editor is open (isolation + concurrent save).
- Unauthenticated `/manus-storage/{key}` fetch of another client's uploaded assets after key enumeration or leaked `storageUrl`.
- JWT_SECRET rotation or reuse: session forging vs inability to decrypt stored secrets.
- Upload path + `sanitizeClientFolder` colliding two clients onto one S3 prefix.
- Launch/update races flipping `status` while a stale editor PUT restores `draft` and wipes newer fields.
