// ── Entry point ──────────────────────────────────────────────
import { renderChips, renderGrid } from "./render.js";
import { bindEvents, loadRemoteData } from "./events.js";

function init() {
  renderChips();
  renderGrid();
  bindEvents();
  loadRemoteData();
}

init();
