import { CATEGORIES, VERDICT_LABELS, normalizeCategoryId } from "./data.js";
import { filterAndSortProducts } from "./filters.js";
import { state } from "./state.js";
import { escHtml, timeAgo, sanitizeExternalUrl } from "./utils.js";

function domIdSlug(slug) {
  return String(slug).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function verdictLabel(verdict) {
  return VERDICT_LABELS[verdict] || verdict;
}

function getMergedProducts() {
  return state.products;
}

function resolveProductName(slug) {
  const u = state.products.find((p) => p.slug === slug);
  if (u) return u.name;
  const f = (state.freshnessFeed.newestProducts || []).find((p) => p.slug === slug);
  return f?.name || slug;
}

export function renderChips() {
  const sel = document.getElementById("category-select");
  if (!sel) return;
  state.activeCategory = normalizeCategoryId(state.activeCategory);
  const allProducts = getMergedProducts();
  const options = CATEGORIES.map((c) => {
    const count = c.id === "all" ? allProducts.length : allProducts.filter((p) => p.category === c.id).length;
    const label = count > 0 ? `${c.label} (${count})` : c.label;
    return `<option value="${String(c.id).replace(/"/g, "&quot;")}">${escHtml(label)}</option>`;
  }).join("");
  sel.innerHTML = options;
  sel.value = state.activeCategory;
}

export function renderFreshnessSection() {
  const host = document.getElementById("freshness-section");
  if (!host) return;
  const feed = state.freshnessFeed || { recentTips: [], newestProducts: [] };
  const tips = feed.recentTips || [];
  const newest = feed.newestProducts || [];
  if (!tips.length && !newest.length) {
    host.innerHTML = "";
    host.setAttribute("hidden", "");
    return;
  }
  host.removeAttribute("hidden");

  const tipsHtml = tips.length
    ? `<div class="freshness-col">
        <h2 class="freshness-heading">Recent community tips</h2>
        <ul class="freshness-list">
          ${tips
            .map((t) => {
              const name = resolveProductName(t.productSlug);
              const snippet = escHtml(t.text.length > 110 ? `${t.text.slice(0, 110)}…` : t.text);
              return `<li class="freshness-item">
                <a class="freshness-jump" href="#product-${domIdSlug(t.productSlug)}">${escHtml(name)}</a>
                <span class="freshness-tip">${snippet}</span>
                <span class="freshness-meta">${escHtml(t.submittedBy)} · ${timeAgo(t.createdAt)}</span>
              </li>`;
            })
            .join("")}
        </ul>
      </div>`
    : "";

  const newestHtml = newest.length
    ? `<div class="freshness-col">
        <h2 class="freshness-heading">Newest community products</h2>
        <ul class="freshness-new-list">
          ${newest
            .map((p) => {
              const thumbSrc = p.imageUrl || p.imagePath;
              const thumb = thumbSrc
                ? `<img src="${escHtml(thumbSrc)}" alt="" width="40" height="40" loading="lazy">`
                : `<span class="freshness-thumb-ph" aria-hidden="true"></span>`;
              return `<li class="freshness-new-item">
                ${thumb}
                <div class="freshness-new-body">
                  <a class="freshness-jump" href="#product-${domIdSlug(p.slug)}">${escHtml(p.name)}</a>
                  <span class="freshness-meta">${escHtml(p.brand)} · ${timeAgo(p.createdAt)}</span>
                </div>
              </li>`;
            })
            .join("")}
        </ul>
      </div>`
    : "";

  host.innerHTML = `<section class="freshness-card" aria-label="What is new">
    <div class="freshness-grid">${tipsHtml}${newestHtml}</div>
  </section>`;
}

function getFilteredProducts() {
  return filterAndSortProducts({
    products: getMergedProducts(),
    activeCategory: state.activeCategory,
    searchQuery: state.searchQuery,
    activeTags: state.activeTags,
    verdictFilter: state.verdictFilter,
    sortBy: state.sortBy,
    voteCounts: state.voteCounts,
  });
}

function voteButtonsHtml(product, counts, mine) {
  return `<div class="vote-row">
        <button type="button" class="vote-btn${mine.includes("love") ? " active" : ""}" data-slug="${product.slug}" data-type="love" title="Love it">
          <svg viewBox="0 0 24 24" fill="${mine.includes("love") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>${counts.love}</span>
        </button>
        <button type="button" class="vote-btn${mine.includes("own") ? " active" : ""}" data-slug="${product.slug}" data-type="own" title="I own this">
          <svg viewBox="0 0 24 24" fill="${mine.includes("own") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>${counts.own}</span>
        </button>
        <button type="button" class="vote-btn${mine.includes("want") ? " active" : ""}" data-slug="${product.slug}" data-type="want" title="I want this">
          <svg viewBox="0 0 24 24" fill="${mine.includes("want") ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          <span>${counts.want}</span>
        </button>
      </div>`;
}

function hacksPanelHtml(product, hacks) {
  const isAdmin = state.isConvexAdmin;
  const hacksHtml = hacks.length
    ? hacks.map((h) => {
        const delBtn = isAdmin && h._id ? ` <button type="button" class="hack-delete" data-hack-id="${h._id}" title="Delete tip">&times;</button>` : "";
        return `<div class="hack-item"><span class="hack-text">${escHtml(h.text)}</span><span class="hack-meta">${escHtml(h.submittedBy)} &middot; ${timeAgo(h.createdAt)}${delBtn}</span></div>`;
      }).join("")
    : '<div class="hack-empty">No tips yet. Be the first!</div>';

  return `<div class="detail-hacks-block">
      <h3 class="detail-section-label">Community tips</h3>
      <div class="hacks-panel hacks-panel--always">${hacksHtml}</div>
      <form class="hack-form" data-slug="${product.slug}">
        <input type="text" class="hack-input" placeholder="Share a life hack or tip..." maxlength="280" autocomplete="off">
        <button type="submit" class="hack-submit">Post</button>
      </form>
    </div>`;
}

function cardImageBlock(product, { interactive } = { interactive: false }) {
  const inner = product.image
    ? `<img src="${escHtml(product.image)}" alt="${escHtml(product.name)}" loading="lazy">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
  const wrapClass = product.image ? "card-image" : "card-image card-image-placeholder";
  if (!interactive) {
    return `<div class="${wrapClass}">${inner}</div>`;
  }
  const label = `View full details: ${product.name}`;
  return `<button type="button" class="card-image-btn ${wrapClass}" data-open-product="${escHtml(product.slug)}" aria-label="${escHtml(label)}">${inner}</button>`;
}

function tagRowHtml(tags, max = 4) {
  const arr = tags || [];
  const shown = arr.slice(0, max);
  const rest = arr.length - shown.length;
  const more = rest > 0 ? `<span class="tag tag-more">+${rest}</span>` : "";
  return `<div class="card-tags">${shown.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("")}${more}</div>`;
}

function openDetailButton(slug, label = "Full details & tips", extraClass = "") {
  const cls = ["card-detail-btn", extraClass].filter(Boolean).join(" ");
  return `<button type="button" class="${cls}" data-open-product="${escHtml(slug)}">${escHtml(label)}</button>`;
}

function productLinkLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Open link";
  }
}

function productLinkSection(product) {
  if (!state.detailIncludeProductLinks) return "";
  const url = sanitizeExternalUrl(product.productUrl || "");
  if (!url) {
    return `<p class="detail-links-hint">No shop link is on file for this item.</p>`;
  }
  const safe = escHtml(url);
  const host = escHtml(productLinkLabel(url));
  return `<div class="detail-block detail-product-link-block">
      <h3 class="detail-section-label">Product link</h3>
      <a class="detail-product-link" href="${safe}" target="_blank" rel="noopener noreferrer">${host}</a>
    </div>`;
}

function detailLinkPreferenceBar() {
  const checked = state.detailIncludeProductLinks ? " checked" : "";
  return `<div class="detail-preferences">
    <label class="detail-include-links-label">
      <input type="checkbox" id="detail-include-product-links"${checked}>
      <span>Include product / shop links when available</span>
    </label>
  </div>`;
}

function makeProductCard(product) {
  const counts = state.voteCounts[product.slug] || { love: 0, own: 0, want: 0 };
  const mine = state.myVotes[product.slug] || [];
  const verdictClass = product.verdict === "recommended" ? "verdict-rec" : product.verdict === "mixed" ? "verdict-mix" : "verdict-skip";

  const imageBlock = cardImageBlock(product, { interactive: true });

  const deleteBtn = state.isConvexAdmin && product.isUserSubmitted && product._id
    ? `<button type="button" class="product-delete" data-product-id="${product._id}" title="Delete product">&times;</button>`
    : "";
  const submittedHtml = product.isUserSubmitted
    ? `<div class="card-submitted">Site submission · ${escHtml(product.uploadedBy)}</div>`
    : "";

  const tags = product.tags || [];
  const tips = product.tips || [];
  const hacks = state.hacks[product.slug] || [];
  const metaBits = [];
  if (tips.length) metaBits.push(`${tips.length} curated tip${tips.length !== 1 ? "s" : ""}`);
  if (hacks.length) metaBits.push(`${hacks.length} community tip${hacks.length !== 1 ? "s" : ""}`);
  const metaLine = metaBits.length ? `<p class="card-preview-meta">${escHtml(metaBits.join(" · "))}</p>` : "";

  return `<article class="product-card" id="product-${domIdSlug(product.slug)}" data-slug="${product.slug}">
    ${imageBlock}
    <div class="card-body">
      <div class="card-header">
        <span class="verdict-badge ${verdictClass}">${escHtml(verdictLabel(product.verdict))}</span>
        <span class="card-category">${escHtml(CATEGORIES.find((c) => c.id === product.category)?.label || product.category)}</span>
        ${deleteBtn}
      </div>
      ${submittedHtml}
      <h3 class="card-name">${escHtml(product.name)}</h3>
      <div class="card-brand">${escHtml(product.brand)}</div>
      <p class="card-desc card-desc--clamp">${escHtml(product.description)}</p>
      ${metaLine}
      ${tagRowHtml(tags, 4)}
      <div class="card-foot">
        ${voteButtonsHtml(product, counts, mine)}
        ${openDetailButton(product.slug)}
      </div>
    </div>
  </article>`;
}

function makeProductCompact(product) {
  const counts = state.voteCounts[product.slug] || { love: 0, own: 0, want: 0 };
  const mine = state.myVotes[product.slug] || [];
  const verdictClass = product.verdict === "recommended" ? "verdict-rec" : product.verdict === "mixed" ? "verdict-mix" : "verdict-skip";
  const tips = product.tips || [];
  const hacks = state.hacks[product.slug] || [];
  const tease =
    product.description.length > 96 ? `${product.description.slice(0, 96).trim()}…` : product.description;

  const thumbInner = product.image
    ? `<img src="${escHtml(product.image)}" alt="" loading="lazy">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
  const thumbClass = product.image ? "row-thumb" : "row-thumb row-thumb--ph";

  const metaBits = [];
  if (tips.length) metaBits.push(`${tips.length} curated`);
  metaBits.push(`${hacks.length} community`);
  const metaStr = metaBits.join(" · ");

  return `<article class="product-card product-card--row" id="product-${domIdSlug(product.slug)}" data-slug="${product.slug}">
    <button type="button" class="${thumbClass}" data-open-product="${escHtml(product.slug)}" aria-label="Open details: ${escHtml(product.name)}">${thumbInner}</button>
    <div class="row-main">
      <div class="row-topline">
        <span class="verdict-badge ${verdictClass}">${escHtml(verdictLabel(product.verdict))}</span>
        ${product.isUserSubmitted ? `<span class="source-pill">Submission</span>` : ""}
        <span class="card-category row-cat">${escHtml(CATEGORIES.find((c) => c.id === product.category)?.label || product.category)}</span>
      </div>
      <h3 class="row-title">${escHtml(product.name)}</h3>
      <div class="row-brand">${escHtml(product.brand)}</div>
      <p class="row-tease">${escHtml(tease)}</p>
      <p class="row-counts">${escHtml(metaStr)}</p>
    </div>
    <div class="row-rail" role="group" aria-label="Votes and details">
      ${voteButtonsHtml(product, counts, mine)}
      ${openDetailButton(product.slug, "Details", "card-detail-btn--row")}
    </div>
  </article>`;
}

export function buildProductDetailInner(product) {
  const counts = state.voteCounts[product.slug] || { love: 0, own: 0, want: 0 };
  const mine = state.myVotes[product.slug] || [];
  const hacks = state.hacks[product.slug] || [];
  const tips = product.tips || [];
  const verdictClass = product.verdict === "recommended" ? "verdict-rec" : product.verdict === "mixed" ? "verdict-mix" : "verdict-skip";

  const tipsHtml = tips.length
    ? `<div class="detail-block"><h3 class="detail-section-label">Curated highlights</h3><ul class="card-tips">${tips.map((t) => `<li>${escHtml(t)}</li>`).join("")}</ul></div>`
    : "";

  const noteHtml = product.note
    ? `<div class="detail-block"><h3 class="detail-section-label">Note</h3><div class="card-note">${escHtml(product.note)}</div></div>`
    : "";

  const imageHtml = product.image
    ? `<div class="detail-hero-img"><img src="${escHtml(product.image)}" alt="${escHtml(product.name)}" loading="lazy"></div>`
    : `<div class="detail-hero-img detail-hero-img--ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`;

  const deleteBtn = state.isConvexAdmin && product.isUserSubmitted && product._id
    ? `<button type="button" class="product-delete" data-product-id="${product._id}" title="Delete product">&times;</button>`
    : "";
  const submittedHtml = product.isUserSubmitted
    ? `<div class="card-submitted">Site submission · ${escHtml(product.uploadedBy)}</div>`
    : "";

  const tags = product.tags || [];
  const tagsHtml = tags.length
    ? `<div class="detail-block"><h3 class="detail-section-label">Tags</h3><div class="card-tags">${tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("")}</div></div>`
    : "";

  return `<div class="product-detail-layout">
    ${imageHtml}
    <div class="product-detail-copy">
      <div class="card-header detail-head">
        <span class="verdict-badge ${verdictClass}">${escHtml(verdictLabel(product.verdict))}</span>
        <span class="card-category">${escHtml(CATEGORIES.find((c) => c.id === product.category)?.label || product.category)}</span>
        ${deleteBtn}
      </div>
      ${submittedHtml}
      <div class="detail-brand-line">${escHtml(product.brand)}</div>
      <p class="detail-desc">${escHtml(product.description)}</p>
      ${tipsHtml}
      ${noteHtml}
      ${tagsHtml}
      ${voteButtonsHtml(product, counts, mine)}
      ${hacksPanelHtml(product, hacks)}
      ${productLinkSection(product)}
      ${detailLinkPreferenceBar()}
    </div>
  </div>`;
}

export function renderProductDetailModal() {
  const modal = document.getElementById("product-detail-modal");
  const body = document.getElementById("product-detail-body");
  const title = document.getElementById("product-detail-title");
  if (!modal || !body) return;

  if (!state.detailSlug) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("product-detail-open");
    body.innerHTML = "";
    return;
  }

  const product = getMergedProducts().find((p) => p.slug === state.detailSlug);
  if (!product) {
    state.detailSlug = null;
    renderProductDetailModal();
    return;
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("product-detail-open");
  if (title) title.textContent = product.name;
  body.innerHTML = buildProductDetailInner(product);
  requestAnimationFrame(() => {
    document.getElementById("product-detail-close")?.focus();
  });
}

export function renderGrid() {
  const container = document.getElementById("product-grid");
  if (!container) return;
  const products = getFilteredProducts();

  if (state.detailSlug && !products.some((p) => p.slug === state.detailSlug)) {
    state.detailSlug = null;
  }

  const live = document.getElementById("results-live");
  if (live) {
    live.textContent = products.length ? `${products.length} product${products.length !== 1 ? "s" : ""} match your filters.` : "No products match your filters.";
  }

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state">No products match your filters.</div>';
    container.classList.remove("compact");
  } else {
    container.classList.toggle("compact", state.viewMode === "compact");
    const maker = state.viewMode === "compact" ? makeProductCompact : makeProductCard;
    container.innerHTML = products.map(maker).join("");
  }

  const countEl = document.getElementById("result-count");
  if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? "s" : ""}`;

  renderProductDetailModal();
}

export function renderViewToggle() {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    const v = btn.dataset.view;
    btn.classList.toggle("active", v === state.viewMode);
    btn.setAttribute("aria-pressed", v === state.viewMode ? "true" : "false");
  });
}
