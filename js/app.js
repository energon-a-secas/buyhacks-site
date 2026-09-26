// ── Entry point ──────────────────────────────────────────────
import { state } from './state.js';
import { readUrlIntoState, navigation } from "./url-sync.js";
import { renderChips } from "./render.js";
import { bindEvents, loadRemoteData, syncControlsFromState, initBuyhacksAuth } from "./events.js";

readUrlIntoState(state);
navigation.replace();
renderChips();
syncControlsFromState();
bindEvents();
void loadRemoteData();
void initBuyhacksAuth().catch(() => {});
