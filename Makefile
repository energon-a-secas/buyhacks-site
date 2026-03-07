.DEFAULT_GOAL := help

PORT ?= 8777

# ── Help ───────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  buyhacks-site"
	@echo ""
	@echo "  make setup      Install deps + deploy Convex functions"
	@echo "  make install    Install npm dependencies"
	@echo "  make dev        Run Convex dev (deploys functions + watches)"
	@echo "  make deploy     Deploy Convex functions to production"
	@echo "  make serve      Serve the site locally on PORT (default: $(PORT))"
	@echo "  make open       Open the site in the browser"
	@echo "  make login      Authenticate with Convex"
	@echo ""

# ── Setup ──────────────────────────────────────────────────────────────────────
.PHONY: setup
setup: install deploy
	@echo "Setup complete — run 'make serve' to view the site"

# ── Dependencies ───────────────────────────────────────────────────────────────
.PHONY: install
install:
	npm install

# ── Convex ─────────────────────────────────────────────────────────────────────
.PHONY: login
login:
	npx convex login

.PHONY: dev
dev:
	npx convex dev

.PHONY: deploy
deploy:
	npx convex deploy

# ── Local server ───────────────────────────────────────────────────────────────
.PHONY: serve
serve:
	@echo "Serving on http://localhost:$(PORT)"
	python3 -m http.server $(PORT)

.PHONY: open
open:
	open http://localhost:$(PORT)
