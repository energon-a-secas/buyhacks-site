// ── DOM rendering ────────────────────────────────────────────────────
import { PRODUCTS, CATEGORIES, VERDICT_LABELS } from "./data.js";
import { state } from "./state.js";
import { escHtml, timeAgo } from "./utils.js";

/** Render category filter chips. */
export function renderChips() {
  const container = document.getElementById("category-chips");
  if (!container) return;
  container.innerHTML = CATEGORIES.map(
    (c) =>
      `<button class="chip${state.activeCategory === c.id ? " active" : ""}" data-category="${c.id}">${escHtml(c.label)}</button>`
  ).join("");
}

/** Get filtered and sorted products. */
function getFilteredProducts() {
  let list = PRODUCTS;

  if (state.activeCategory !== "all") {
    list = list.filter((p) => p.category === state.activeCategory);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
    );
  }

  if (state.sortBy !== "default") {
    list = [...list].sort((a, b) => {
      const ca = (state.voteCounts[a.slug] || {})[state.sortBy] || 0;
      const cb = (state.voteCounts[b.slug] || {})[state.sortBy] || 0;
      return cb - ca;
    });
  }

  return list;
}

/** Build a single product card HTML. */
function makeProductCard(product) {
  const counts = state.voteCounts[product.slug] || { love: 0, own: 0, want: 0 };
  const mine = state.myVotes[product.slug] || [];
  const hacks = state.hacks[product.slug] || [];
  const isExpanded = state.expandedHacks.has(product.slug);
  const verdictClass = product.verdict === "recommended" ? "verdict-rec" : product.verdict === "mixed" ? "verdict-mix" : "verdict-skip";

  const tipsHtml = product.tips.length
    ? `<ul class="card-tips">${product.tips.map((t) => `<li>${escHtml(t)}</li>`).join("")}</ul>`
    : "";

  const noteHtml = product.note
    ? `<div class="card-note">${escHtml(product.note)}</div>`
    : "";

  const imageHtml = product.image
    ? `<div class="card-image"><img src="${escHtml(product.image)}" alt="${escHtml(product.name)}" loading="lazy"></div>`
    : `<div class="card-image card-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;

  const hacksHtml = hacks.length
    ? hacks.map((h) => `<div class="hack-item"><span class="hack-text">${escHtml(h.text)}</span><span class="hack-meta">${escHtml(h.submittedBy)} &middot; ${timeAgo(h.createdAt)}</span></div>`).join("")
    : '<div class="hack-empty">No tips yet. Be the first!</div>';

  return `<article class="product-card" data-slug="${product.slug}">
    ${imageHtml}
    <div class="card-body">
      <div class="card-header">
        <span class="verdict-badge ${verdictClass}">${VERDICT_LABELS[product.verdict]}</span>
        <span class="card-category">${escHtml(CATEGORIES.find((c) => c.id === product.category)?.label || product.category)}</span>
      </div>
      <h3 class="card-name">${escHtml(product.name)}</h3>
      <div class="card-brand">${escHtml(product.brand)}</div>
      <p class="card-desc">${escHtml(product.description)}</p>
      ${tipsHtml}
      ${noteHtml}
      <div class="card-tags">${product.tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("")}</div>
      <div class="vote-row">
        <button class="vote-btn${mine.includes("love") ? " active" : ""}" data-slug="${product.slug}" data-type="love" title="Love it">
          <svg viewBox="0 0 24 24" fill="${mine.includes("love") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>${counts.love}</span>
        </button>
        <button class="vote-btn${mine.includes("own") ? " active" : ""}" data-slug="${product.slug}" data-type="own" title="I own this">
          <svg viewBox="0 0 24 24" fill="${mine.includes("own") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>${counts.own}</span>
        </button>
        <button class="vote-btn${mine.includes("want") ? " active" : ""}" data-slug="${product.slug}" data-type="want" title="I want this">
          <svg viewBox="0 0 24 24" fill="${mine.includes("want") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          <span>${counts.want}</span>
        </button>
      </div>
      <button class="hacks-toggle" data-slug="${product.slug}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        Tips &amp; Hacks (${hacks.length})
        <svg class="hacks-chevron${isExpanded ? " open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="hacks-panel${isExpanded ? " open" : ""}">
        ${hacksHtml}
        <form class="hack-form" data-slug="${product.slug}">
          <input type="text" class="hack-input" placeholder="Share a life hack or tip..." maxlength="280" autocomplete="off">
          <button type="submit" class="hack-submit">Post</button>
        </form>
      </div>
    </div>
  </article>`;
}

/** Render the product grid. */
export function renderGrid() {
  const container = document.getElementById("product-grid");
  if (!container) return;
  const products = getFilteredProducts();

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state">No products match your filters.</div>';
    return;
  }

  container.innerHTML = products.map(makeProductCard).join("");

  // Update result count
  const countEl = document.getElementById("result-count");
  if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? "s" : ""}`;
}

/** Update auth UI. */
export function renderAuth(username) {
  const loginPanel = document.getElementById("auth-login");
  const userPanel = document.getElementById("auth-user");
  const userLabel = document.getElementById("auth-username");
  if (!loginPanel || !userPanel) return;
  if (username) {
    loginPanel.hidden = true;
    userPanel.hidden = false;
    if (userLabel) userLabel.textContent = username;
  } else {
    loginPanel.hidden = false;
    userPanel.hidden = true;
  }
}
