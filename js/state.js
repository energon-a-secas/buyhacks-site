// Raw localStorage throws in private browsing, where the object exists but
// every access raises. These wrappers return a fallback instead. Storage
// keys and formats are unchanged, so existing saved data still loads.
import { safeGet, safeSet } from './neorgon-persist.js';

// ── Shared mutable state + Convex client ─────────────────────────────
import { ConvexHttpClient } from "https://esm.sh/convex@1.21.0/browser";

// ── Convex client ────────────────────────────────────────────────────
// Must match `CONVEX_URL` in `.env.local` (run `npx convex dev` to confirm).
const CONVEX_URL = "https://formal-lemur-640.convex.cloud";
export const convex = new ConvexHttpClient(CONVEX_URL);

// ── remove.bg Worker URL ─────────────────────────────────────────────
// Cloudflare Worker that proxies remove.bg for background removal
export const REMOVEBG_WORKER_URL = "https://buyhacks-removebg.neorgon.workers.dev/remove-bg";

// Function references (strings at runtime — no build step needed)
export const api = {
  auth:     { isAdmin: "auth:isAdmin" },
  votes:    { getVotes: "votes:getVotes", toggleVote: "votes:toggleVote" },
  hacks:    { getHacks: "hacks:getHacks", submitHack: "hacks:submitHack", deleteHack: "hacks:deleteHack" },
  products: { list: "products:list", getUploadUrl: "products:getUploadUrl", saveProduct: "products:saveProduct", deleteProduct: "products:deleteProduct" },
  freshness: { getFeed: "freshness:getFeed" },
};

// ── Visitor ID (persistent, used for vote dedup) ─────────────────────
function getVisitorId() {
  let id = safeGet("buyhacks-visitor");
  if (!id) {
    id = crypto.randomUUID();
    safeSet("buyhacks-visitor", id);
  }
  return id;
}
export const visitorId = getVisitorId();

// ── Session (set by events.js from NeoAuth.onChange) ──────────────────
export function setAuthSession(label, isAdmin) {
  state.authLabel = label || null;
  state.isConvexAdmin = !!isAdmin;
}

/** Display label of the signed-in account, or null when signed out. */
export function getLoggedInUser() {
  return state.authLabel;
}

// ── Mutable application state ────────────────────────────────────────
export const state = {
  activeCategory: "all",
  searchQuery: "",
  sortBy: "default",
  activeTags: [],
  verdictFilter: "all",
  /** Product slug when the full-detail modal is open (grid + list). */
  detailSlug: null,
  /** When true, detail modal shows shop/product URLs when the item has one. */
  detailIncludeProductLinks: false,
  viewMode: "grid",
  voteCounts: {},
  myVotes: {},
  hacks: {},
  /** False until the first Convex catalog load attempt resolves (drives skeleton vs empty state). */
  productsLoaded: false,
  /** Mapped Convex `products:list` rows (curated catalog + community). */
  products: [],
  freshnessFeed: { recentTips: [], newestProducts: [] },
  authLabel: null,
  isConvexAdmin: false,
};

try {
  if (typeof localStorage !== "undefined") {
    state.detailIncludeProductLinks = localStorage.getItem("buyhacks-detail-include-links") === "1";
  }
} catch {
  /* ignore */
}
