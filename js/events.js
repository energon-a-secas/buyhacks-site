// ── Event handlers ───────────────────────────────────────────────────
import { state, convex, api, visitorId, getLoggedInUser, setLoggedInUser, getUserRole, setUserRole, REMOVEBG_WORKER_URL } from "./state.js";
import { renderChips, renderGrid } from "./render.js";
import { toast, debounce } from "./utils.js";

/** Load votes, hacks, and user products from Convex. */
export async function loadRemoteData() {
  try {
    const [voteData, hackData, userProducts] = await Promise.all([
      convex.query(api.votes.getVotes, { visitorId }),
      convex.query(api.hacks.getHacks, {}),
      convex.query(api.products.list, {}),
    ]);
    state.voteCounts = voteData.counts;
    state.myVotes = voteData.mine;
    state.hacks = hackData;
    state.userProducts = userProducts || [];
    renderChips();
    renderGrid();
  } catch {
    // Convex not configured yet — run with local-only data
  }
}

/** Handle vote button clicks. */
async function handleVote(slug, voteType) {
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
    const result = await convex.mutation(api.hacks.deleteHack, { hackId, adminUsername: username });
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
    const result = await convex.mutation(api.products.deleteProduct, { productId, adminUsername: username });
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
      const username = getLoggedInUser();

      if (!username) { toast("Login to add products"); return; }
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

        const result = await convex.mutation(api.products.saveProduct, {
          name, brand, category, tags, description, verdict,
          storageId,
          uploadedBy: username,
        });

        if (result.ok) {
          toast("Product added!");
          // Reset form
          pendingFile = null;
          document.getElementById("productName").value = "";
          document.getElementById("productBrand").value = "";
          document.getElementById("productDescription").value = "";
          document.getElementById("productTags").value = "";
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
async function handleHackSubmit(slug, text) {
  const user = getLoggedInUser();
  if (!user) {
    toast("Login to share tips");
    return;
  }
  if (!text.trim()) return;

  try {
    const result = await convex.mutation(api.hacks.submitHack, {
      productSlug: slug,
      text: text.trim(),
      submittedBy: user,
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
  }
}

/** Update auth UI state. */
function renderAuthState(username, role) {
  const loggedIn = !!username;
  const authGate = document.getElementById("authGate");
  const authUser = document.getElementById("authUser");
  const authToggle = document.getElementById("authToggle");
  const authUsername = document.getElementById("authUsername");
  const authRole = document.getElementById("authRole");
  if (!authGate || !authUser) return;
  authGate.hidden = loggedIn;
  authUser.hidden = !loggedIn;
  if (authToggle) authToggle.classList.toggle("logged-in", loggedIn);
  if (loggedIn) {
    if (authUsername) authUsername.textContent = username;
    if (authRole) authRole.hidden = role !== "admin";
  }
}

/** Handle auth (login/register). */
async function handleAuth(action) {
  const isLogin = action === "login";
  const userEl = document.getElementById(isLogin ? "authLoginUser" : "authRegUser");
  const passEl = document.getElementById(isLogin ? "authLoginPass" : "authRegPass");
  if (!userEl || !passEl) return;

  const username = userEl.value.trim();
  const password = passEl.value;
  if (!username || !password) {
    toast("Enter username and password");
    return;
  }

  try {
    const fn = isLogin ? api.auth.login : api.auth.register;
    const result = await convex.mutation(fn, { username, password });
    if (result.ok) {
      const role = result.role || "user";
      setLoggedInUser(result.username);
      setUserRole(role);
      renderAuthState(result.username, role);
      toast(isLogin ? `Welcome back, ${result.username}` : `Welcome, ${result.username}!`);
      updateUploadZoneVisibility();
      renderGrid();
      userEl.value = "";
      passEl.value = "";
    } else {
      toast(result.error);
    }
  } catch {
    toast("Auth failed — check Convex connection");
  }
}

/** Bind all event listeners. */
export function bindEvents() {
  // Category chips
  document.getElementById("category-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.activeCategory = btn.dataset.category;
    renderChips();
    renderGrid();
  });

  // Search
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce((e) => {
        state.searchQuery = e.target.value;
        renderGrid();
      }, 300)
    );
  }

  // Sort
  document.getElementById("sort-select")?.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderGrid();
  });

  // Vote buttons + hack toggles + hack forms (delegated)
  document.getElementById("product-grid")?.addEventListener("click", (e) => {
    // Vote button
    const voteBtn = e.target.closest(".vote-btn");
    if (voteBtn) {
      handleVote(voteBtn.dataset.slug, voteBtn.dataset.type);
      return;
    }

    // Admin: delete hack
    const hackDel = e.target.closest(".hack-delete");
    if (hackDel) {
      handleDeleteHack(hackDel.dataset.hackId);
      return;
    }

    // Admin: delete product
    const prodDel = e.target.closest(".product-delete");
    if (prodDel) {
      handleDeleteProduct(prodDel.dataset.productId);
      return;
    }

    // Hack toggle
    const hackToggle = e.target.closest(".hacks-toggle");
    if (hackToggle) {
      const slug = hackToggle.dataset.slug;
      if (state.expandedHacks.has(slug)) state.expandedHacks.delete(slug);
      else state.expandedHacks.add(slug);
      renderGrid();
      return;
    }
  });

  // Hack form submit (delegated)
  document.getElementById("product-grid")?.addEventListener("submit", (e) => {
    if (!e.target.classList.contains("hack-form")) return;
    e.preventDefault();
    const slug = e.target.dataset.slug;
    const input = e.target.querySelector(".hack-input");
    if (input && input.value.trim()) {
      handleHackSubmit(slug, input.value);
      input.value = "";
    }
  });

  // Add Product toggle
  document.getElementById("addProductToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("uploadPanel");
    if (panel) panel.classList.toggle("open");
  });

  // Auth toggle
  document.getElementById("authToggle")?.addEventListener("click", () => {
    const panel = document.getElementById("authPanel");
    panel?.classList.toggle("open");
    if (panel?.classList.contains("open")) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Auth tab switching
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      const loginForm = document.getElementById("authLoginForm");
      const regForm = document.getElementById("authRegisterForm");
      if (loginForm) loginForm.hidden = !isLogin;
      if (regForm) regForm.hidden = isLogin;
    });
  });

  // Auth buttons
  document.getElementById("authLoginBtn")?.addEventListener("click", () => handleAuth("login"));
  document.getElementById("authRegBtn")?.addEventListener("click", () => handleAuth("register"));
  document.getElementById("authLogout")?.addEventListener("click", () => {
    setLoggedInUser(null);
    setUserRole(null);
    renderAuthState(null);
    updateUploadZoneVisibility();
    renderGrid();
    toast("Logged out");
  });

  // Enter key on auth forms
  ["authLoginUser", "authLoginPass"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAuth("login");
    });
  });
  ["authRegUser", "authRegPass"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAuth("register");
    });
  });

  // Upload panel
  setupUploadPanel();

  // Restore auth state on load
  const savedUser = getLoggedInUser();
  if (savedUser) renderAuthState(savedUser, getUserRole());
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
