// ── Event handlers ───────────────────────────────────────────────────
import { state, convex, api, visitorId, getLoggedInUser, setAuthSession, REMOVEBG_WORKER_URL } from "./state.js";
import { catalogFromConvexRows } from "./filters.js";
import { normalizeCategoryId } from "./data.js";
import { renderChips, renderGrid, renderFreshnessSection, renderViewToggle, renderProductDetailModal } from "./render.js";
import { toast, debounce, sanitizeExternalUrl } from "./utils.js";
import { writeStateToUrl } from "./url-sync.js";

const pushUrl = debounce(() => writeStateToUrl(), 400);

let buyhacksClerk = null;

async function refreshAdminFlag() {
  if (!getLoggedInUser()) {
    setAuthSession(null, false);
    return;
  }
  try {
    const isAd = await convex.query(api.auth.isAdmin, {});
    setAuthSession(state.authLabel, !!isAd);
  } catch {
    setAuthSession(state.authLabel, false);
  }
}

async function refreshLegacyLinkSection() {
  const section = document.getElementById("legacyLinkSection");
  const msg = document.getElementById("legacyLinkMessage");
  if (!section) return;
  if (!getLoggedInUser()) {
    section.hidden = true;
    return;
  }
  try {
    const link = await convex.query(api.migration.myAccountLink, {});
    section.hidden = !!link;
    if (msg) {
      msg.hidden = true;
      msg.textContent = "";
      msg.classList.remove("legacy-link-message--err");
    }
  } catch {
    section.hidden = true;
  }
}

async function onLegacyLinkClick() {
  const userEl = document.getElementById("legacyLinkUser");
  const passEl = document.getElementById("legacyLinkPassword");
  const msg = document.getElementById("legacyLinkMessage");
  const section = document.getElementById("legacyLinkSection");
  const username = userEl?.value?.trim() || "";
  const password = passEl?.value || "";
  if (!username || !password) {
    if (msg) {
      msg.textContent = "Enter legacy username and password.";
      msg.classList.add("legacy-link-message--err");
      msg.hidden = false;
    }
    return;
  }
  try {
    const res = await convex.mutation(api.migration.linkLegacyAccount, { username, password });
    if (res.ok) {
      if (msg) {
        msg.textContent = `Linked @${res.legacyUsername}.`;
        msg.classList.remove("legacy-link-message--err");
        msg.hidden = false;
      }
      if (userEl) userEl.value = "";
      if (passEl) passEl.value = "";
      if (section) section.hidden = true;
      toast("Legacy account linked");
    } else if (msg) {
      msg.textContent = res.error || "Link failed";
      msg.classList.add("legacy-link-message--err");
      msg.hidden = false;
    }
  } catch {
    if (msg) {
      msg.textContent = "Link failed. Try again.";
      msg.classList.add("legacy-link-message--err");
      msg.hidden = false;
    }
  }
}

/** Clerk dark theme + accent (SignIn, UserButton, OAuth, loading states). */
const BUYHACKS_CLERK_APPEARANCE = {
  baseTheme: "dark",
  variables: {
    colorPrimary: "#f59e0b",
    colorPrimaryForeground: "#0c0a06",
    colorForeground: "#f9f9f9",
    colorDanger: "#f87171",
    colorSuccess: "#22c55e",
    colorWarning: "#fbbf24",
    colorBackground: "#121828",
    colorInputBackground: "rgba(255, 255, 255, 0.08)",
    colorInputForeground: "#f9f9f9",
    colorText: "#f9f9f9",
    colorTextSecondary: "rgba(202, 202, 202, 0.92)",
    colorShimmer: "rgba(251, 191, 36, 0.35)",
    colorNeutral: "rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  elements: {
    formButtonPrimary: {
      backgroundColor: "#f59e0b",
      color: "#0c0a06",
      fontWeight: "600",
      boxShadow: "0 1px 0 rgba(255, 255, 255, 0.12) inset",
    },
    formButtonReset: {
      color: "rgba(202, 202, 202, 0.95)",
    },
    socialButtonsBlockButton: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      color: "#f9f9f9",
    },
    socialButtonsBlockButtonText: {
      color: "#f9f9f9",
    },
    alternativeMethodsBlockButton: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      color: "#f9f9f9",
    },
    card: {
      backgroundColor: "transparent",
      boxShadow: "none",
      width: "100%",
    },
    rootBox: {
      width: "100%",
      maxWidth: "400px",
      marginLeft: "auto",
      marginRight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  },
};

/** Clerk + Convex JWT (Neorgon shared client). Call from app.js before bindEvents. */
export async function initBuyhacksAuth() {
  const pk = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim();
  if (!pk) {
    console.warn("BuyHacks: add clerk-publishable-key meta for sign-in.");
    return;
  }
  try {
    const { initNeorgonClerkConvex, neorgonDisplayLabel } = await import("./vendor/neorgon-auth.js");
    buyhacksClerk = await initNeorgonClerkConvex({
      convex,
      publishableKey: pk,
      signInHost: "#neorgon-signin-mount",
      userButtonHost: "#neorgon-user-mount",
      clerkAppearance: BUYHACKS_CLERK_APPEARANCE,
      userButtonProps: {
        showName: true,
      },
      signInProps: {
        appearance: {
          ...BUYHACKS_CLERK_APPEARANCE,
          layout: { unsafe_disableDevelopmentModeWarnings: true },
        },
      },
      onSession: ({ clerk, hasSession }) => {
        buyhacksClerk = clerk;
        if (hasSession) {
          setAuthSession(neorgonDisplayLabel(clerk), false);
          void refreshAdminFlag();
          void refreshLegacyLinkSection();
        } else {
          setAuthSession(null, false);
        }
        renderAuthState();
        updateUploadZoneVisibility();
        refreshBrowseUi();
        if (hasSession) closeAuthModal();
      },
    });
  } catch (e) {
    console.warn("BuyHacks: Clerk init failed", e);
  }
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
async function handleDeleteHack(hackId) {
  if (!confirm("Delete this tip?")) return;
  const username = getLoggedInUser();
  if (!username) { toast("Login required"); return; }
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
async function handleDeleteProduct(productId) {
  if (!confirm("Delete this product?")) return;
  const username = getLoggedInUser();
  if (!username) { toast("Login required"); return; }
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
      if (!getLoggedInUser()) { toast("Sign in to add products"); return; }
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

/** Handle hack form submissions. */
async function handleHackSubmit(slug, text, submitBtn) {
  const user = getLoggedInUser();
  if (!user) {
    toast("Sign in to share tips");
    return;
  }
  if (!text.trim()) return;

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
    } else {
      toast(result.error);
    }
  } catch {
    toast("Could not submit tip — check Convex connection");
  } finally {
    // loadRemoteData re-renders the panel, but restore in case the node persists.
    if (submitBtn && submitBtn.isConnected) {
      submitBtn.disabled = false;
      submitBtn.textContent = restoreLabel || "Post";
    }
  }
}

/** Match modal title to Clerk hash routing (sign-in vs sign-up). */
function syncAuthModalTitleFromClerkRoute() {
  const modal = document.getElementById("authModal");
  const title = document.getElementById("authModalTitle");
  if (!modal?.classList.contains("open") || !title) return;
  if (getLoggedInUser()) {
    title.textContent = "Account";
    return;
  }
  const h = (window.location.hash || "").toLowerCase();
  if (h.includes("sign-up") || h.includes("signup") || h.includes("sign_up")) title.textContent = "Create account";
  else title.textContent = "Sign in";
}

function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-modal-open");
  syncAuthModalTitleFromClerkRoute();
  requestAnimationFrame(() => {
    syncAuthModalTitleFromClerkRoute();
    requestAnimationFrame(() => syncAuthModalTitleFromClerkRoute());
  });
  if (getLoggedInUser()) void refreshLegacyLinkSection();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-modal-open");
}

/** Update auth UI state (Clerk session). */
function renderAuthState() {
  const loggedIn = !!getLoggedInUser();
  const authGate = document.getElementById("authGate");
  const authUser = document.getElementById("authUser");
  const authToggle = document.getElementById("authToggle");
  const authUsername = document.getElementById("authUsername");
  const authModalTitle = document.getElementById("authModalTitle");
  if (!authGate || !authUser) return;
  authGate.hidden = loggedIn;
  authUser.hidden = !loggedIn;
  if (authToggle) authToggle.classList.toggle("logged-in", loggedIn);
  if (loggedIn && authUsername) authUsername.textContent = state.authLabel || "";
  if (authModalTitle) {
    if (loggedIn) authModalTitle.textContent = "Account";
    else if (document.getElementById("authModal")?.classList.contains("open")) syncAuthModalTitleFromClerkRoute();
    else authModalTitle.textContent = "Sign in";
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
      handleDeleteHack(hackDel.dataset.hackId);
      return;
    }

    const prodDel = e.target.closest(".product-delete");
    if (prodDel) {
      handleDeleteProduct(prodDel.dataset.productId);
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
      handleHackSubmit(slug, input.value, submitBtn);
      input.value = "";
    }
  });

  // Add Product toggle
  document.getElementById("addProductToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("uploadPanel");
    if (panel) panel.classList.toggle("open");
  });

  // Auth modal
  document.getElementById("authToggle")?.addEventListener("click", () => {
    const modal = document.getElementById("authModal");
    if (modal?.classList.contains("open")) closeAuthModal();
    else openAuthModal();
  });
  document.getElementById("authModalBackdrop")?.addEventListener("click", () => closeAuthModal());
  document.getElementById("authModalClose")?.addEventListener("click", () => closeAuthModal());
  window.addEventListener("hashchange", () => syncAuthModalTitleFromClerkRoute());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const detail = document.getElementById("product-detail-modal");
    if (detail?.classList.contains("open")) {
      state.detailSlug = null;
      renderProductDetailModal();
      return;
    }
    const modal = document.getElementById("authModal");
    if (modal?.classList.contains("open")) closeAuthModal();
  });

  document.getElementById("legacyLinkBtn")?.addEventListener("click", () => {
    void onLegacyLinkClick();
  });
  setupUploadPanel();
  updateUploadZoneVisibility();

  // Scroll to top
  const scrollBtn = document.getElementById("scroll-top");
  if (scrollBtn) {
    window.addEventListener("scroll", () => {
      scrollBtn.classList.toggle("visible", window.scrollY > 400);
    });
    scrollBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}
