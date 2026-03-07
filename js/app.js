// ── Entry point ──────────────────────────────────────────────
import { getLoggedInUser } from "./state.js";
import { renderChips, renderGrid, renderAuth } from "./render.js";
import { bindEvents, loadRemoteData } from "./events.js";

function init() {
  renderChips();
  renderGrid();
  renderAuth(getLoggedInUser());
  bindEvents();
  loadRemoteData();
}

init();
