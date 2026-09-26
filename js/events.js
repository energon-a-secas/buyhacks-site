// ── Event handlers ───────────────────────────────────────────────────
import { state, convex, api, visitorId, getLoggedInUser, setAuthSession, REMOVEBG_WORKER_URL } from "./state.js";
import { catalogFromConvexRows } from "./filters.js";
import { normalizeCategoryId } from "./data.js";
import { renderChips, renderGrid, renderFreshnessSection, renderViewToggle, renderProductDetailModal } from "./render.js";
import { toast, debounce, sanitizeExternalUrl } from "./utils.js";
import { readUrlIntoState, navigation } from "./url-sync.js";
import { NeoAuth } from "./neorgon-auth.js";

// ── Auth ─────────────────────────────────────────────────────────────
// The Neorgon Auth Kit owns the header slot, the sign-in dialog and the Convex
// token. This file only listens, and asks for a sign-in where an action needs one.
const ADD_PRODUCT_REASON = "Sign in to add products.";

// Admin delete buttons render only for admins, and the grid is drawn before this
// answers, so a change has to repaint or the buttons wait for an unrelated render.
async function refreshAdminFlag() {
  let isAdmin = false;
  try {
    isAdmin = !!(await convex.query(api.auth.isAdmin, {}));
  } catch {
    // A failed check leaves the admin controls hidden.
  }
  if (!getLoggedInUser() || isAdmin === state.isConvexAdmin) return;
  setAuthSession(state.authLabel, isAdmin);
  refreshBrowseUi();
}

/**
 * Called after public browsing is bound. The kit calls the listener with the
 * settled state, then only on real changes (never on token refresh ticks).
 */
export async function initBuyhacksAuth() {
  NeoAuth.onChange(({ signedIn, label }) => {
    setAuthSession(signedIn ? label : null, false);
    updateUploadZoneVisibility();
    refreshBrowseUi();
    if (signedIn) void refreshAdminFlag();
  });
  await NeoAuth.start({ convex });
}

function refreshBrowseUi() {
  renderChips();
  renderFreshnessSection();
  renderViewToggle();
  renderGrid();
}

/** Reset every browse filter to its default and re-render. */
function clearAllFilters() {
  navigation.flush();
  state.activeCategory = "all";
  state.searchQuery = "";
  state.activeTags = [];
  state.verdictFilter = "all";
  state.sortBy = "default";
  state.viewMode = "grid";
  state.detailSlug = null;
  const search = document.getElementById("search-input");
  if (search) search.value = "";
  const sort = document.getElementById("sort-select");
  if (sort) sort.value = "default";
  syncControlsFromState();
  refreshBrowseUi();
  navigation.push();
  search?.focus();
}

export function syncControlsFromState() {
  state.activeCategory = normalizeCategoryId(state.activeCategory);
  const search = document.getElementById("search-input");
  if (search) search.value = state.searchQuery;
  const sort = document.getElementById("sort-select");
  if (sort) sort.value = state.sortBy;
  const category = document.getElementById("category-select");
  if (category && category.options.length) category.value = state.activeCategory;
  renderViewToggle();
}

let loadVersion = 0;
/** Each public resource settles independently. A failed tip/vote request must
 * never discard the catalog or its last successful result. */
export async function loadRemoteData() {
  const version = ++loadVersion;
  state.catalogLoading = true;
  state.catalogError = '';
  state.enrichmentErrors = [];
  refreshBrowseUi();
  async function load(label, name, args, apply) {
    try {
      const result = await convex.query(name, args);
      if (version !== loadVersion) return;
      apply(result);
    } catch {
      if (version !== loadVersion) return;
      if (label === 'Products') {
        state.catalogError = state.productsLoaded
          ? 'Could not refresh products. Showing the last loaded catalog.'
          : 'Could not load products. Please try again.';
      } else state.enrichmentErrors.push(label);
    } finally {
      if (version === loadVersion) {
        if (label === 'Products') state.catalogLoading = false;
        refreshBrowseUi();
      }
    }
  }
  await Promise.all([
    load('Products', api.products.list, {}, rows => {
      if (!Array.isArray(rows)) throw new Error('Invalid catalog');
      state.products = catalogFromConvexRows(rows);
      state.productsLoaded = true;
    }),
    load('Reactions', api.votes.getVotes, { visitorId }, data => {
      if (!data?.counts || !data?.mine) throw new Error('Invalid reactions');
      state.voteCounts = data.counts;
      state.myVotes = data.mine;
    }),
    load('Community tips', api.hacks.getHacks, {}, data => {
      if (!data || typeof data !== 'object') throw new Error('Invalid tips');
      state.hacks = data;
    }),
    load('Recent updates', api.freshness.getFeed, { tipsLimit: 6, productsLimit: 3 }, data => {
      if (!Array.isArray(data?.recentTips) || !Array.isArray(data?.newestProducts)) throw new Error('Invalid updates');
      state.freshnessFeed = data;
    }),
  ]);
}

/** Handle vote button clicks. The optimistic re-render is the primary feedback;
 *  `_btn` is accepted for call-site symmetry and possible future use. */
async function handleVote(slug, voteType, _btn) {
  // Optimistic update
  if (!state.voteCounts[slug]) state.voteCounts[slug] = { love: 0, own: 0, want: 0 };
  if (!state.myVotes[slug]) state.myVotes[slug] = [];

  const idx = state.myVotes[slug].indexOf(voteType);
  if (idx >= 0) {
    state.myVotes[slug].splice(idx, 1);
    state.voteCounts[slug][voteType] = Math.max(0, (state.voteCounts[slug][voteType] || 0) - 1);
  } else {
    state.myVotes[slug].push(voteType);
    state.voteCounts[slug][voteType] = (state.voteCounts[slug][voteType] || 0) + 1;
  }
  renderGrid();

  try {
    await convex.mutation(api.votes.toggleVote, { productSlug: slug, visitorId, voteType });
    await loadRemoteData();
  } catch {
    // Convex not available — keep optimistic state
  }
}

/** Admin: delete a hack tip. */
async function handleDeleteHack(hackId, invoker) {
  if (!confirm("Delete this tip?")) return;
  if (!getLoggedInUser() && !(await NeoAuth.requireSignIn({ reason: "Sign in to delete this tip.", invoker }))) return;
  try {
    const result = await convex.mutation(api.hacks.deleteHack, { hackId });
    if (result.ok) {
      toast("Tip deleted");
      await loadRemoteData();
    } else {
      toast(result.error);
    }
  } catch {
    toast("Delete failed");
  }
}

/** Admin: delete a user-submitted product. */
async function handleDeleteProduct(productId, invoker) {
  if (!confirm("Delete this product?")) return;
  if (!getLoggedInUser() && !(await NeoAuth.requireSignIn({ reason: "Sign in to delete this product.", invoker }))) return;
  try {
    const result = await convex.mutation(api.products.deleteProduct, { productId });
    if (result.ok) {
      toast("Product deleted");
      await loadRemoteData();
    } else {
      toast(result.error);
    }
  } catch {
    toast("Delete failed");
  }
}

/** Handle product image upload + form submission. */
let pendingFile = null;

function setupUploadPanel() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const previewImg = document.getElementById("previewImg");
  const uploadSubmit = document.getElementById("uploadSubmit");
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
  });

  function handleFileSelect(file) {
    pendingFile = file;
    const url = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = url;
      previewImg.style.display = "block";
      dropZone.style.display = "none";
    }
  }

  if (uploadSubmit) {
    uploadSubmit.addEventListener("click", async () => {
      const name = document.getElementById("productName")?.value.trim();
      const brand = document.getElementById("productBrand")?.value.trim();
      const category = document.getElementById("productCategory")?.value;
      const description = document.getElementById("productDescription")?.value.trim();
      const tagsRaw = document.getElementById("productTags")?.value.trim();
      const verdict = document.getElementById("productVerdict")?.value;
      if (!getLoggedInUser() && !(await NeoAuth.requireSignIn({ reason: ADD_PRODUCT_REASON, invoker: uploadSubmit }))) return;
      if (!name) { toast("Product name is required"); return; }
      if (!brand) { toast("Brand is required"); return; }
      if (!description) { toast("Description is required"); return; }

      const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

      uploadSubmit.disabled = true;
      uploadSubmit.textContent = "Uploading...";

      try {
        let storageId = undefined;
        if (pendingFile) {
          let fileToUpload = pendingFile;
          const removeBg = document.getElementById("removeBgToggle")?.checked;

          // Route through Cloudflare Worker for background removal
          if (removeBg) {
            uploadSubmit.textContent = "Removing background...";
            const bgResponse = await fetch(REMOVEBG_WORKER_URL, {
              method: "POST",
              headers: { "Content-Type": pendingFile.type },
              body: pendingFile,
            });
            if (!bgResponse.ok) {
              const err = await bgResponse.json().catch(() => ({}));
              throw new Error(err.error || "Background removal failed");
            }
            const pngBlob = await bgResponse.blob();
            fileToUpload = new File([pngBlob], "product.png", { type: "image/png" });
            uploadSubmit.textContent = "Uploading...";
          }

          const uploadUrl = await convex.mutation(api.products.getUploadUrl, {});
          const uploadResult = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": fileToUpload.type },
            body: fileToUpload,
          });
          const { storageId: sid } = await uploadResult.json();
          storageId = sid;
        }

        const productUrlRaw = document.getElementById("productUrl")?.value?.trim() || "";
        const productUrl = sanitizeExternalUrl(productUrlRaw) || undefined;

        const result = await convex.mutation(api.products.saveProduct, {
          name, brand, category, tags, description, verdict,
          productUrl,
          storageId,
        });

        if (result.ok) {
          toast("Product added!");
          // Reset form
          pendingFile = null;
          document.getElementById("productName").value = "";
          document.getElementById("productBrand").value = "";
          document.getElementById("productDescription").value = "";
          document.getElementById("productTags").value = "";
          const pu = document.getElementById("productUrl");
          if (pu) pu.value = "";
          if (previewImg) { previewImg.style.display = "none"; previewImg.src = ""; }
          if (dropZone) dropZone.style.display = "";
          await loadRemoteData();
        } else {
          toast(result.error);
        }
      } catch (e) {
        toast("Upload failed: " + e.message);
      } finally {
        uploadSubmit.disabled = false;
        uploadSubmit.textContent = "Submit Product";
      }
    });
  }
}

/** Update upload zone visibility based on auth state. */
function updateUploadZoneVisibility() {
  const user = getLoggedInUser();
  const loginPrompt = document.getElementById("uploadLoginPrompt");
  const uploadZone = document.getElementById("uploadZone");
  if (loginPrompt) loginPrompt.style.display = user ? "none" : "";
  if (uploadZone) uploadZone.style.display = user ? "" : "none";
}

/** Handle hack form submissions. Resolves true only when the tip was posted. */
async function handleHackSubmit(slug, text, submitBtn) {
  if (!text.trim() || state.pendingTips.has(slug)) return false;
  state.pendingTips.add(slug);
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (!getLoggedInUser() && !(await NeoAuth.requireSignIn({ reason: "Sign in to share tips.", invoker: submitBtn }))) return false;
    renderProductDetailModal();
    const result = await convex.mutation(api.hacks.submitHack, {
      productSlug: slug,
      text: text.trim(),
      visitorId,
    });
    if (result.ok) {
      toast("Tip shared!");
      // The form may have been replaced during auth or a background refresh.
      // Clear the current field before refreshing so a successful draft is not
      // carried into the newly rendered form.
      if (state.detailSlug === slug) {
        const input = document.querySelector('#product-detail-body .hack-input');
        if (input) input.value = '';
      }
      await loadRemoteData();
      return true;
    } else {
      toast(result.error);
    }
  } catch {
    toast("Could not submit tip. Check your connection and try again.");
  } finally {
    state.pendingTips.delete(slug);
    if (state.detailSlug === slug) renderProductDetailModal();
  }
}

/** Bind all event listeners. */
export function bindEvents() {
  document.getElementById("category-select")?.addEventListener("change", (e) => {
    navigation.flush();
    state.activeCategory = e.target.value;
    refreshBrowseUi();
    navigation.push();
  });

  // Search
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      renderGrid();
      navigation.schedule();
    });
  }

  // Sort
  document.getElementById("sort-select")?.addEventListener("change", (e) => {
    navigation.flush();
    state.sortBy = e.target.value;
    renderGrid();
    navigation.push();
  });

  document.getElementById("clear-filters")?.addEventListener("click", clearAllFilters);

  window.addEventListener("resize", debounce(() => syncControlsFromState(), 200));

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      if (v !== "grid" && v !== "compact") return;
      navigation.flush();
      state.viewMode = v;
      renderViewToggle();
      renderGrid();
      navigation.push();
    });
  });

  navigation.listen(() => {
    state.detailSlug = null;
    readUrlIntoState(state);
    syncControlsFromState();
    refreshBrowseUi();
  });
  for (const id of ['refreshProducts', 'retryProducts']) {
    document.getElementById(id)?.addEventListener('click', () => {
      searchInput?.focus();
      void loadRemoteData();
    });
  }
  document.getElementById('shareView')?.addEventListener('click', async () => {
    navigation.replace();
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied with your filters and layout');
    } catch { toast('Could not copy. Copy the address from your browser.'); }
  });

  function closeProductDetail() {
    state.detailSlug = null;
    renderProductDetailModal();
  }

  let detailInvoker;
  let detailSlug;
  const detailDialog = document.getElementById('product-detail-modal');
  document.getElementById("product-detail-close")?.addEventListener("click", closeProductDetail);
  detailDialog?.addEventListener('click', event => { if (event.target === detailDialog) closeProductDetail(); });
  detailDialog?.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); closeProductDetail(); });
  detailDialog?.addEventListener('close', () => {
    if (detailDialog.open) return;
    state.detailSlug = null;
    document.body.classList.remove('product-detail-open');
    const replacement = [...document.querySelectorAll('[data-open-product]')].find(button => button.dataset.openProduct === detailSlug && button.getClientRects().length);
    (detailInvoker?.isConnected && detailInvoker.getClientRects().length ? detailInvoker : replacement || searchInput)?.focus({ preventScroll: true });
  });

  document.getElementById("product-detail-modal")?.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.id === "detail-include-product-links") {
      state.detailIncludeProductLinks = !!t.checked;
      try {
        localStorage.setItem("buyhacks-detail-include-links", state.detailIncludeProductLinks ? "1" : "0");
      } catch {
        /* ignore */
      }
      renderProductDetailModal();
    }
  });

  // Open detail modal (anywhere), votes + hacks only inside grid or detail panel
  document.body.addEventListener("click", (e) => {
    if (e.target.closest("[data-clear-filters]")) {
      clearAllFilters();
      return;
    }

    const openBtn = e.target.closest("[data-open-product]");
    if (openBtn) {
      const slug = openBtn.getAttribute("data-open-product");
      if (slug) {
        detailInvoker = openBtn;
        detailSlug = slug;
        state.detailSlug = slug;
        renderProductDetailModal();
      }
      return;
    }

    const scope = e.target.closest("#product-grid, #product-detail-body");
    if (!scope) return;

    const voteBtn = e.target.closest(".vote-btn");
    if (voteBtn) {
      handleVote(voteBtn.dataset.slug, voteBtn.dataset.type, voteBtn);
      return;
    }

    const hackDel = e.target.closest(".hack-delete");
    if (hackDel) {
      handleDeleteHack(hackDel.dataset.hackId, hackDel);
      return;
    }

    const prodDel = e.target.closest(".product-delete");
    if (prodDel) {
      handleDeleteProduct(prodDel.dataset.productId, prodDel);
      return;
    }
  });

  document.body.addEventListener("submit", (e) => {
    if (!e.target.classList.contains("hack-form")) return;
    if (!e.target.closest("#product-grid, #product-detail-body")) return;
    e.preventDefault();
    const slug = e.target.dataset.slug;
    const input = e.target.querySelector(".hack-input");
    const submitBtn = e.target.querySelector(".hack-submit");
    if (input && input.value.trim()) {
      // Cleared only once the tip is posted: dismissing the sign-in dialog, or a
      // failed post, leaves what the visitor typed where they typed it.
      void handleHackSubmit(slug, input.value, submitBtn).then((posted) => {
        if (posted) input.value = "";
      });
    }
  });

  // Add Product toggle
  document.getElementById("addProductToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("uploadPanel");
    if (panel) {
      const open = panel.classList.toggle('open');
      document.getElementById('addProductToggle').setAttribute('aria-expanded', String(open));
    }
  });

  // Sign in from the Add Product panel
  document.getElementById("uploadSigninBtn")?.addEventListener("click", (e) => {
    void NeoAuth.requireSignIn({ reason: ADD_PRODUCT_REASON, invoker: e.currentTarget });
  });

  setupUploadPanel();
  updateUploadZoneVisibility();
}
