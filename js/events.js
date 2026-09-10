// ── Event handlers ───────────────────────────────────────────────────
import { state, convex, api, visitorId, getLoggedInUser, setAuthSession, REMOVEBG_WORKER_URL } from "./state.js";
import { catalogFromConvexRows } from "./filters.js";
import { normalizeCategoryId } from "./data.js";
import { renderChips, renderGrid, renderFreshnessSection, renderViewToggle, renderProductDetailModal } from "./render.js";
import { toast, debounce, sanitizeExternalUrl } from "./utils.js";
import { writeStateToUrl } from "./url-sync.js";
import { NeoAuth } from "./neorgon-auth.js";

const pushUrl = debounce(() => writeStateToUrl(), 400);

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
 * Called once from app.js, before bindEvents. The kit calls the listener with the
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
  pushUrl();
}

/** Reset every browse filter to its default and re-render. */
function clearAllFilters() {
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

/** Load votes, hacks, user products, and freshness feed from Convex. */
export async function loadRemoteData() {
  try {
    const [voteData, hackData, productRows] = await Promise.all([
      convex.query(api.votes.getVotes, { visitorId }),
      convex.query(api.hacks.getHacks, {}),
      convex.query(api.products.list, {}),
    ]);
    state.voteCounts = voteData.counts;
    state.myVotes = voteData.mine;
    state.hacks = hackData;
    state.products = catalogFromConvexRows(productRows || []);
  } catch {
    state.productsLoaded = true;
    refreshBrowseUi();
    return;
  }
  state.productsLoaded = true;
  try {
    state.freshnessFeed = await convex.query(api.freshness.getFeed, { tipsLimit: 6, productsLimit: 3 });
  } catch {
    state.freshnessFeed = { recentTips: [], newestProducts: [] };
  }
  refreshBrowseUi();
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
  if (!getLoggedInUser() && !(await NeoAuth.requireSignIn({ reason: "Sign in to share tips.", invoker: submitBtn }))) return false;
  if (!text.trim()) return false;

  let restoreLabel;
  if (submitBtn) {
    restoreLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";
  }

  try {
    const result = await convex.mutation(api.hacks.submitHack, {
      productSlug: slug,
      text: text.trim(),
      visitorId,
    });
    if (result.ok) {
      toast("Tip shared!");
      await loadRemoteData();
      return true;
    } else {
      toast(result.error);
    }
  } catch {
    toast("Could not submit tip. Check your connection and try again.");
  } finally {
    // loadRemoteData re-renders the panel, but restore in case the node persists.
    if (submitBtn && submitBtn.isConnected) {
      submitBtn.disabled = false;
      submitBtn.textContent = restoreLabel || "Post";
    }
  }
}

/** Bind all event listeners. */
export function bindEvents() {
  document.getElementById("category-select")?.addEventListener("change", (e) => {
    state.activeCategory = e.target.value;
    refreshBrowseUi();
  });

  // Search
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce((e) => {
        state.searchQuery = e.target.value;
        renderGrid();
        pushUrl();
      }, 300)
    );
  }

  // Sort
  document.getElementById("sort-select")?.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderGrid();
    pushUrl();
  });

  document.getElementById("clear-filters")?.addEventListener("click", clearAllFilters);

  window.addEventListener("resize", debounce(() => syncControlsFromState(), 200));

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      if (v !== "grid" && v !== "compact") return;
      state.viewMode = v;
      renderViewToggle();
      renderGrid();
      pushUrl();
    });
  });

  function closeProductDetail() {
    state.detailSlug = null;
    renderProductDetailModal();
  }

  document.getElementById("product-detail-close")?.addEventListener("click", closeProductDetail);
  document.getElementById("product-detail-backdrop")?.addEventListener("click", closeProductDetail);

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
    if (panel) panel.classList.toggle("open");
  });

  // Sign in from the Add Product panel
  document.getElementById("uploadSigninBtn")?.addEventListener("click", (e) => {
    void NeoAuth.requireSignIn({ reason: ADD_PRODUCT_REASON, invoker: e.currentTarget });
  });

  // Escape closes the product detail modal
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // The kit's sign-in dialog is a native <dialog> that takes its own Escape;
    // closing the detail modal behind it too would drop the tip being posted.
    if (document.querySelector("dialog[open]")) return;
    const detail = document.getElementById("product-detail-modal");
    if (detail?.classList.contains("open")) {
      state.detailSlug = null;
      renderProductDetailModal();
    }
  });

  setupUploadPanel();
  updateUploadZoneVisibility();
}
