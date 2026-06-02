import { state } from "./state.js";
import { normalizeCategoryId } from "./data.js";

export function readUrlIntoState() {
  const p = new URLSearchParams(window.location.search);
  if (p.has("q")) state.searchQuery = (p.get("q") || "").trim();
  if (p.has("cat")) state.activeCategory = normalizeCategoryId(p.get("cat"));
  if (p.has("sort")) {
    const sort = p.get("sort");
    if (["default", "love", "own", "want", "newest", "name"].includes(sort)) state.sortBy = sort;
  }
  if (p.has("view")) {
    const view = p.get("view");
    if (view === "grid" || view === "compact") state.viewMode = view;
  }
}

export function writeStateToUrl() {
  const p = new URLSearchParams();
  if (state.searchQuery) p.set("q", state.searchQuery);
  if (state.activeCategory && state.activeCategory !== "all") p.set("cat", state.activeCategory);
  if (state.sortBy && state.sortBy !== "default") p.set("sort", state.sortBy);
  if (state.viewMode && state.viewMode !== "grid") p.set("view", state.viewMode);
  const next = `${window.location.pathname}${p.toString() ? `?${p}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}
