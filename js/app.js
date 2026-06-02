// ── Entry point ──────────────────────────────────────────────
import { readUrlIntoState } from "./url-sync.js";
import { bindEvents, loadRemoteData, syncControlsFromState, initBuyhacksAuth } from "./events.js";

readUrlIntoState();
await initBuyhacksAuth();
syncControlsFromState();
bindEvents();
await loadRemoteData();
