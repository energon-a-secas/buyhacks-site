// ── Entry point ──────────────────────────────────────────────
import { readUrlIntoState } from "./url-sync.js";
import { renderGridSkeleton } from "./render.js";
import { bindEvents, loadRemoteData, syncControlsFromState, initBuyhacksAuth } from "./events.js";

readUrlIntoState();
renderGridSkeleton();
await initBuyhacksAuth();
syncControlsFromState();
bindEvents();
await loadRemoteData();
