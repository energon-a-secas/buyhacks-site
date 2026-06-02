---
name: BuyHacks
description: Neorgon dark tool shell with an amber/gold accent, a three-color verdict badge system (green/amber/red), a love/own/want vote row, and grid + compact-list product views. All base suite tokens, plus a domain amber accent and Clerk + Convex backends.
colors:
  bg: "#040714"
  surface-1: "rgba(255,255,255,0.03)"
  surface-2: "rgba(255,255,255,0.06)"
  border-subtle: "rgba(255,255,255,0.07)"
  border: "rgba(255,255,255,0.1)"
  border-strong: "rgba(255,255,255,0.22)"
  text-primary: "#f9f9f9"
  text-secondary: "#cacaca"
  text-muted: "rgba(255,255,255,0.55)"
  accent: "#f59e0b"
  accent-bright: "#fbbf24"
  accent-dim: "rgba(245,158,11,0.15)"
  verdict-rec: "#4ade80"
  verdict-mix: "#fbbf24"
  verdict-skip: "#f87171"
  source-pill: "#38bdf8"
typography:
  display:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  card-name:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "15px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s6: "24px"
  s8: "32px"
components:
  product-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
  verdict-badge:
    backgroundColor: "{colors.accent-dim}"
    textColor: "{colors.accent-bright}"
    rounded: "4px"
    padding: "3px 8px"
  vote-btn:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
  detail-btn:
    backgroundColor: "rgba(245,158,11,0.08)"
    textColor: "{colors.accent-bright}"
    rounded: "{rounded.sm}"
---

# Design System: BuyHacks

# Overview

**This is the Neorgon suite shell with an amber accent and a verdict system.** Read the root [DESIGN.md](../DESIGN.md) first; everything there holds unless noted. The deviations: an **amber/gold domain accent** (instead of the suite's blue), a **three-color verdict badge system**, a **love/own/want triple-vote row**, and **two product views** (image grid + compact list) sharing one card vocabulary. Backed by Convex (products/votes/hacks) with Clerk auth and an optional Cloudflare Worker for background removal.

Base tokens match the suite (`#040714` void, glass surfaces, Avenir Next, 68px gradient header). The accent is the one sanctioned swap.

## Deviations from the suite baseline

### 1. Amber accent (replaces suite blue)

BuyHacks runs amber/gold as its single action color: `--accent: #f59e0b`, `--accent-bright: #fbbf24`, `--accent-dim: rgba(245,158,11,0.15)`. It owns primary buttons, the detail CTA, active vote state, focus rings, and section labels. This is the One-Accent allowance: one domain accent replacing blue, not added on top. The header gradient, footer, and type stack stay suite-standard.

### 2. Verdict badge system (three roles)

Each product carries one verdict badge, a deliberate three-color exception to single-accent: `.verdict-rec` green `#4ade80`, `.verdict-mix` amber `#fbbf24`, `.verdict-skip` red `#f87171`, each on a 15%-opacity tint. **Meaning is carried by the label text** (Recommended / Mixed Feelings / Skip), not color alone, so it survives color-blindness. A sky-blue `.source-pill` / `.card-submitted` marks user submissions.

### 3. Triple-vote row (love / own / want)

Votes are three independent intents, not a single score: love (heart), own (check-circle), want (target). A visitor can hold all three at once on one product. Active state = amber border + filled icon + `accent-dim` background + soft glow. Counts render beside each icon. Anonymous, deduped by `visitorId`.

### 4. Two views, one vocabulary

`.product-grid` is `repeat(auto-fill, minmax(300px,1fr))` image cards; compact mode (`.product-grid.compact` + `.product-card--row`) is a 104/120px-thumb list. Both reuse the same verdict badge, vote row, and detail button. A product detail **modal** (bottom-sheet on mobile, centered ≥640px) carries curated highlights, note, tags, community tips, and an optional shop link.

## Backend note

Convex serverless (`convex/`: users, votes, hacks, products). Two-tier product model: 24 static products in `js/data.js` merged with Convex user submissions at render. Image upload optionally routes through a Cloudflare Worker (remove.bg proxy) before Convex storage. Clerk handles auth identity via the shared Neorgon client.

## Do's and Don'ts

### Do

- **Do** keep base suite chrome untouched (header gradient, footer, font); amber is the only palette swap.
- **Do** lead every product with its verdict badge, and keep the verdict legible by text, not color alone.
- **Do** keep browse / search / sort / vote working without auth.
- **Do** give vote, detail, and toggle buttons visible focus rings and 44px tap targets.

### Don't

- **Don't** add a second decorative accent beyond amber + the verdict triad + the sky submission pill.
- **Don't** use `border-left`/`border-right` thicker than 1px as an accent stripe (the `.card-note` left border is a known 2px exception slated to migrate to a full border / tint).
- **Don't** fake urgency, hide the verdict, or gate read-only discovery behind login.
- Everything in the root DESIGN.md "Don't" list still applies.
