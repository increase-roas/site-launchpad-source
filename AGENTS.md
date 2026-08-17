# Site Launchpad

Cursor writes. Codex reviews read-only. Do not merge without live browser QA.

## GitHub connector

Pass **both** fields. Never a URL. Never omit either.

| Field | Value |
|---|---|
| `owner` | `ssaofficial` |
| `repo_name` | `site-launchpad-source` |

Open PR: https://github.com/ssaofficial/site-launchpad-source/pull/1

Related contract repo (read-only unless that review): `owner=increase-roas` `repo_name=paid-funnel-simple-form-funnel`

## Merge gates

- [ ] Live browser QA: Clients → Add Client (name only) → Funnels → Simple Form → Create From Template → settings + readiness
- [ ] Codex review complete (not stopped on connector schema)
- [ ] Do not publish / Cloudflare / customer GitHub in this phase

## Offline conversion contract

- Every paid-funnel template must preserve the canonical `offlineConversionContract`.
- `CONFIGURATION READY` and Publish must remain blocked when the contract is missing, drifts, or lacks required runtime-secret wiring.
- Never log or commit runtime secret values.
