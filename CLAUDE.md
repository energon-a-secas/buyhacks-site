# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make setup        # npm install + convex deploy (first-time setup)
make dev          # npx convex dev (deploy functions + watch for changes)
make serve        # python3 -m http.server 8812 (frontend)
make deploy       # npx convex deploy (production deploy only)
make login        # npx convex login (authenticate with Convex dashboard)
```

Run `make dev` and `make serve` in separate terminals for local development. The Convex URL is in `js/client.js`; the Worker URL is in `js/state.js`. No `.env` file needed.

### Cloudflare Worker (optional: for background removal)

```bash
cd worker
npm install
npx wrangler secret put REMOVEBG_API_KEY
npx wrangler dev     # local dev
npx wrangler deploy  # deploy to Cloudflare
```

Allowed origins are configured in `worker/wrangler.toml` via `[vars] ALLOWED_ORIGINS`.

## Architecture

### Catalog and public startup

Products load from Convex `products:list`: curated rows appear first in catalog
order, followed by community submissions. `js/data.js` contains category and
verdict definitions, not a second product catalog. `filters.js` maps backend rows.

`app.js` restores URL state and binds browsing before starting account services.
`js/client.js` imports the optional SDK on first use, retains the latest account
token, and bounds public reads to 12 seconds. SDK loading cannot block controls.
Mutations retain the existing API and are not timed out once dispatched.

`loadRemoteData()` settles products, reactions, tips and recent updates
independently. Initial catalog failure, successful empty data and no filter
matches have different states. Refresh keeps the last successful result; older
responses cannot replace a newer refresh. Share view preserves theme/attribution
parameters and the fragment. Search replaces history; category, sort and layout
push entries; Back/Forward restores the controls.

### Convex API surface (no TypeScript client: string references)

Because there is no build step, the frontend calls Convex via `ConvexHttpClient` from `esm.sh`, and all function names are string references defined in `js/state.js`:

```js
export const api = {
  auth:     { isAdmin: "auth:isAdmin" },
  votes:    { getVotes: "votes:getVotes", toggleVote: "votes:toggleVote" },
  hacks:    { getHacks: "hacks:getHacks", submitHack: "hacks:submitHack", deleteHack: "hacks:deleteHack" },
  products: { list: "products:list", getUploadUrl: "products:getUploadUrl", saveProduct: "products:saveProduct", deleteProduct: "products:deleteProduct" },
  freshness: { getFeed: "freshness:getFeed" },
};
```

If you add or rename a Convex function, update both the `convex/` file and this `api` object.

### Voting: anonymous, visitor-ID deduped

Votes are anonymous. `visitorId` is a UUID generated once and persisted in `localStorage` under `"buyhacks-visitor"`. A visitor can cast all three vote types (love/own/want) on the same product simultaneously, `toggleVote` adds or removes a single vote row per (visitorId, productSlug, voteType). Vote counts are loaded from Convex into `state.voteCounts` and applied optimistically on click before the round-trip.

### Auth: Neorgon Auth Kit (Clerk)

Clerk, through the Neorgon Auth Kit: `js/neorgon-auth.js`, `js/neorgon-auth-sites.js` and `css/neorgon-auth.css` are vendored from `packages/neorgon-ui/auth/` by `sync-auth.sh`, so never edit them here. One Neorgon account works on every Neorgon site. The kit owns the header slot (`data-neo-auth`), the sign-in dialog and the Convex token. `events.js` only listens with `NeoAuth.onChange` (inside `initBuyhacksAuth`, started after public browsing is bound) and asks for a sign-in with `NeoAuth.requireSignIn` wherever an action needs one: the Add Product prompt's "Sign in" button, submitting a product, posting a tip, and the admin deletes. Admin is decided server-side: `auth:isAdmin` checks the Clerk subject against the `ADMIN_SUBJECTS` Convex env var (which `hacks:deleteHack` and `products:deleteProduct` also enforce), and `refreshAdminFlag` repaints the browse UI when the answer changes, so admins see delete buttons on tips and user-submitted products without waiting for an unrelated render. `convex/migration.ts` (legacy password linking) is still deployed but has had no UI since 2026-09-10. The password-era `register`, `login`, `setRole` and `getRole` were **deleted from `convex/auth.ts` on 2026-09-18** (queue `#63`c): they had lost their last caller when the Auth Kit landed, and `register` inserted a `users` row for any unauthenticated caller while `login` confirmed a legacy password with no rate limit, which is an oracle for the credentials `linkLegacyAccount` accepts. **They still answer in production until the next `npx convex deploy`**, since deleting the source does not withdraw a deployed function. Linking is unaffected: `linkLegacyAccount` verifies legacy passwords itself, and the `users` table with its `by_username` index stays for it. Sign-in cannot be exercised on localhost: the production key refuses it, and the dialog says so.

### CSP: the inline theme guard is pinned by hash

`script-src` in `index.html` has no `'unsafe-inline'`, so the Header Kit's one-line
theme guard, which must run before first paint, is allowed by its `sha256` instead.
That snippet is byte-identical on 81 pages in the fleet and is quoted verbatim in
`packages/neorgon-ui/header/README.md`, so the hash is a constant rather than a
per-site value. Edit the snippet and the hash stops matching, which brings back both
symptoms it was pinned to remove: a theme flash and a console error. Smoke check 29
recomputes it. Any new inline script on this page needs its own hash, or a file.

### Image upload flow

1. Optional: POST image to Cloudflare Worker (`REMOVEBG_WORKER_URL`) → returns transparent PNG.
2. `products:getUploadUrl` → Convex returns a signed storage URL.
3. Browser POSTs image bytes directly to that URL → gets back `storageId`.
4. `products:saveProduct` stores metadata + `storageId` in the `products` table.
5. On next `products:list` query, Convex resolves `storageId` → signed `imageUrl` appended to each product.

### State and rendering

All mutable UI state lives in `js/state.js:state` (activeCategory, searchQuery, sortBy, voteCounts, myVotes, hacks, products, catalogLoading, catalogError, pendingTips). Every filter/sort/vote change calls `renderGrid()` directly. No reactive framework. Event delegation is used on `#product-grid` for votes, hack toggles, hack form submits, and admin deletes.

### Hacks (community tips)

Tips require a sign-in: posting one while signed out opens the kit's sign-in dialog, and the tip posts once it succeeds. Each user is limited to 3 tips per product (enforced in `convex/hacks.ts`). Max 280 chars. Admins can delete any tip. Tips appear in the native product-detail dialog. Drafts survive account callbacks and background refreshes; one pending submission per product stays disabled across renders. A successful post clears the current field. The dialog restores focus to the opener or its replacement after a grid refresh.

## Key files

- `js/state.js`: deferred client export, Worker URL, `api` string map, `visitorId`, auth helpers, mutable `state`
- `js/data.js`: categories and verdict labels
- `js/render.js`: cards, native detail dialog, catalog/error/empty states, category controls
- `js/events.js`: `initBuyhacksAuth()` (the Auth Kit listener), `loadRemoteData()`, all handlers, `bindEvents()`
- `convex/schema.ts`: Database schema (users, votes, hacks, products tables)
- `convex/auth.ts`: `isAdmin` (Clerk subject in `ADMIN_SUBJECTS`), and nothing else since 2026-09-18
- `convex/votes.ts`: `getVotes` (all counts + visitor's), `toggleVote`
- `convex/hacks.ts`: `getHacks`, `submitHack` (3-per-visitor cap), `deleteHack` (admin only)
- `convex/products.ts`: `list` (with image URL resolution), `getUploadUrl`, `saveProduct`, `deleteProduct`
- `worker/src/index.js`: Cloudflare Worker remove.bg proxy (POST /remove-bg)

### Navigation and verification

`js/url-sync.js` owns the site schema (`q`, `cat`, `sort`, `view`).
`js/neorgon-navigation.js` is vendored from `packages/neorgon-ui/navigation/`;
change its source and run `bash packages/neorgon-ui/sync-navigation.sh`.
Never write URLs from rendering or remote-response callbacks.

Run `npm test` for filter/URL rules and fixture-backed Playwright checks, including
uploads, reactions, tip retries and sign-in dismissal. The workspace also runs
`node scripts/check-collection-pilots.cjs` for slow services, failures, history,
dialog focus and the shared header/footer contract. These do not verify live
Clerk sign-in or deploy backend changes.
