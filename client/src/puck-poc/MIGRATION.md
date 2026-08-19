# Puck PoC migration

Proof only. Does not replace the synthetic canvas, PaidFunnelGraph, publisher, or `paid_funnels` persistence.

## Run

Dashboard-style editor (feature flag required):

```bash
VITE_PUCK_POC=1 pnpm puck-poc
```

Open http://localhost:5174/?puck=1 (blank canvas) or http://localhost:5174/?puck=1&sample=1

Astro render of the same React blocks:

```bash
pnpm puck-poc:astro
```

Open http://localhost:4321/

`pnpm test:puck-poc` covers JSON roundtrip + HTML fixture.

## Options

### 1. Adapt Puck data → PaidFunnelGraph (recommended)

Keep `PaidFunnelGraph` as the stored/compiler/publisher contract. Add a one-way mapper from Puck `Data` (root `content` + slot arrays on Section/Columns) into Page → Section → Row → Column → Element.

Why this is the smallest backward-compatible path:

- Graph is already wired through templates, readiness, offline conversion, compiler, and publisher.
- Existing funnels stay valid; Puck is an editor frontend.
- PoC blocks already match graph element types: heading, text, image, button, form. Section/Columns map to section/row/column nodes.
- No DB migration, no publisher rewrite, no need to dual-run two page models.

Cost: lose some Puck-only features (arbitrary slot graphs, Puck component ids) unless stored as `props` metadata on graph nodes.

### 2. Make Puck JSON the page-content model

Persist Puck `Data` as page content. Compiler/publisher/readiness learn Puck instead of (or alongside) PaidFunnelGraph.

Why not now:

- Touches persistence, compiler, publisher, templates, and every existing funnel.
- Breaks the current graph contract unless a long dual-write period is added — larger than an adapter.

## Recommendation

Ship option 1 if this proof is accepted. Keep Puck JSON in localStorage (or a sidecar) during editor sessions; commit to PaidFunnelGraph on save. Option 2 only if a later phase deliberately replaces the graph.
