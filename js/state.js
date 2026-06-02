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
  auth: {
    register: "auth:register",
    login: "auth:login",
    getRole: "auth:getRole",
    setRole: "auth:setRole",
    isAdmin: "auth:isAdmin",
  },
  votes:    { getVotes: "votes:getVotes", toggleVote: "votes:toggleVote" },
  hacks:    { getHacks: "hacks:getHacks", submitHack: "hacks:submitHack", deleteHack: "hacks:deleteHack" },
  products: { list: "products:list", getUploadUrl: "products:getUploadUrl", saveProduct: "products:saveProduct", deleteProduct: "products:deleteProduct" },
  freshness: { getFeed: "freshness:getFeed" },
  migration: {
    myAccountLink: "migration:myAccountLink",
    linkLegacyAccount: "migration:linkLegacyAccount",
    getUserSetting: "migration:getUserSetting",
    setUserSetting: "migration:setUserSetting",
    listUserSettings: "migration:listUserSettings",
  },
};

// ── Visitor ID (persistent, used for vote dedup) ─────────────────────
function getVisitorId() {
  let id = localStorage.getItem("buyhacks-visitor");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("buyhacks-visitor", id);
  }
  return id;
}
export const visitorId = getVisitorId();

// ── Clerk session (set by events.js via initBuyhacksAuth) ─────────────
export function isSignedIn() {
  return !!state.authLabel;
}

export function setAuthSession(label, isAdmin) {
  state.authLabel = label || null;
  state.isConvexAdmin = !!isAdmin;
}

/** @deprecated legacy localStorage; unused with Clerk — kept so imports do not break during transition */
export function getLoggedInUser() {
  return state.authLabel;
}
export function setLoggedInUser() {}
export function getUserRole() {
  return state.isConvexAdmin ? "admin" : "user";
}
export function setUserRole() {}

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
