// ── Shared mutable state + Convex client ─────────────────────────────
import { ConvexHttpClient } from "https://esm.sh/convex@1.21.0/browser";

// ── Convex client ────────────────────────────────────────────────────
// Replace with your own Convex deployment URL after `npx convex dev`
const CONVEX_URL = "https://formal-lemur-640.convex.cloud";
export const convex = new ConvexHttpClient(CONVEX_URL);

// ── remove.bg Worker URL ─────────────────────────────────────────────
// Cloudflare Worker that proxies remove.bg for background removal
export const REMOVEBG_WORKER_URL = "https://buyhacks-removebg.neorgon.workers.dev/remove-bg";

// Function references (strings at runtime — no build step needed)
export const api = {
  auth:     { register: "auth:register", login: "auth:login", getRole: "auth:getRole", setRole: "auth:setRole" },
  votes:    { getVotes: "votes:getVotes", toggleVote: "votes:toggleVote" },
  hacks:    { getHacks: "hacks:getHacks", submitHack: "hacks:submitHack", deleteHack: "hacks:deleteHack" },
  products: { list: "products:list", getUploadUrl: "products:getUploadUrl", saveProduct: "products:saveProduct", deleteProduct: "products:deleteProduct" },
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

// ── Auth state (persisted in localStorage) ───────────────────────────
export function getLoggedInUser() {
  return localStorage.getItem("buyhacks-user") || null;
}
export function setLoggedInUser(username) {
  if (username) localStorage.setItem("buyhacks-user", username);
  else localStorage.removeItem("buyhacks-user");
}
export function getUserRole() {
  return localStorage.getItem("buyhacks-role") || "user";
}
export function setUserRole(role) {
  if (role && role !== "user") localStorage.setItem("buyhacks-role", role);
  else localStorage.removeItem("buyhacks-role");
}

// ── Mutable application state ────────────────────────────────────────
export const state = {
  activeCategory: "all",
  searchQuery: "",
  sortBy: "default",       // "default" | "love" | "own" | "want"
  voteCounts: {},           // { slug: { love: N, own: N, want: N } }
  myVotes: {},              // { slug: ["love", "want", ...] }
  hacks: {},                // { slug: [{ text, submittedBy, createdAt }] }
  expandedHacks: new Set(), // slugs with hack panel open
  userProducts: [],          // products from Convex (user-submitted)
};
