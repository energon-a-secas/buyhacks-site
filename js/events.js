// ── Event handlers ───────────────────────────────────────────────────
import { state, convex, api, visitorId, getLoggedInUser, setLoggedInUser } from "./state.js";
import { renderChips, renderGrid, renderAuth } from "./render.js";
import { toast, debounce } from "./utils.js";

/** Load votes and hacks from Convex. */
export async function loadRemoteData() {
  try {
    const [voteData, hackData] = await Promise.all([
      convex.query(api.votes.getVotes, { visitorId }),
      convex.query(api.hacks.getHacks, {}),
    ]);
    state.voteCounts = voteData.counts;
    state.myVotes = voteData.mine;
    state.hacks = hackData;
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

/** Handle auth (login/register). */
async function handleAuth(action) {
  const usernameEl = document.getElementById("auth-username-input");
  const passwordEl = document.getElementById("auth-password-input");
  if (!usernameEl || !passwordEl) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  if (!username || !password) {
    toast("Enter username and password");
    return;
  }

  try {
    const fn = action === "register" ? api.auth.register : api.auth.login;
    const result = await convex.mutation(fn, { username, password });
    if (result.ok) {
      setLoggedInUser(result.username);
      renderAuth(result.username);
      toast(action === "register" ? "Registered!" : "Logged in!");
      usernameEl.value = "";
      passwordEl.value = "";
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

  // Auth buttons
  document.getElementById("auth-login-btn")?.addEventListener("click", () => handleAuth("login"));
  document.getElementById("auth-register-btn")?.addEventListener("click", () => handleAuth("register"));
  document.getElementById("auth-logout-btn")?.addEventListener("click", () => {
    setLoggedInUser(null);
    renderAuth(null);
    toast("Logged out");
  });

  // Auth toggle
  document.getElementById("auth-toggle")?.addEventListener("click", () => {
    const panel = document.getElementById("auth-panel");
    if (panel) panel.classList.toggle("open");
  });

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
