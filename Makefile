.DEFAULT_GOAL := help

PORT ?= 8812

# ── Help ───────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  buyhacks-site"
	@echo ""
	@echo "  make setup            Install deps + deploy Convex functions"
	@echo "  make install          Install npm dependencies"
	@echo "  make dev              Run Convex dev (pushes every save to the LIVE deployment)"
	@echo "  make typecheck        Typecheck the Convex functions"
	@echo "  make deploy           Push functions to both deployments, then verify them"
	@echo "  make deploy-live      Push only to the deployment the shipped page calls"
	@echo "  make deploy-prod      Push only to the production deployment"
	@echo "  make check-deployed   Read-only: does each deployment serve what source exports"
	@echo "  make serve            Serve the site locally on PORT (default: $(PORT))"
	@echo "  make open             Open the site in the browser"
	@echo "  make login            Authenticate with Convex"
	@echo ""

# ── Setup ──────────────────────────────────────────────────────────────────────
.PHONY: setup
setup: install deploy
	@echo "Setup complete: run 'make serve' to view the site"

# ── Dependencies ───────────────────────────────────────────────────────────────
.PHONY: install
install:
	npm install

# ── Convex ─────────────────────────────────────────────────────────────────────
.PHONY: login
login:
	npx convex login

# The shipped page (js/client.js) calls the deployment .env.local names, the one
# `convex dev` targets, so that is the live one. `npx convex deploy` updates the
# production deployment, which nothing calls, so a push there alone leaves the
# live site serving what it served before (queue #63). `deploy` pushes both, in
# order, then checks that each serves exactly what source exports.
.PHONY: dev
dev:
	npx convex dev

.PHONY: typecheck
typecheck:
	npx -p typescript tsc --noEmit -p convex/tsconfig.json --types node

.PHONY: deploy
deploy:
	@$(MAKE) --no-print-directory typecheck
	@$(MAKE) --no-print-directory deploy-live
	@$(MAKE) --no-print-directory deploy-prod
	@$(MAKE) --no-print-directory check-deployed

.PHONY: deploy-live
deploy-live:
	node scripts/check-deployed.mjs --guard
	npx convex dev --once

.PHONY: deploy-prod
deploy-prod:
	npx convex deploy

.PHONY: check-deployed
check-deployed:
	@node scripts/check-deployed.mjs; live=$$?; \
	node scripts/check-deployed.mjs --prod; prod=$$?; \
	[ $$live -eq 0 ] && [ $$prod -eq 0 ]

# ── Local server ───────────────────────────────────────────────────────────────
.PHONY: serve
serve:
	@echo "Serving on http://localhost:$(PORT)"
	@if [ -f ../../scripts/serve.py ]; then python3 ../../scripts/serve.py $(PORT); else python3 -m http.server $(PORT); fi

.PHONY: open
open:
	open http://localhost:$(PORT)
