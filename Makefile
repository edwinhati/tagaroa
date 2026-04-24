# Unified Makefile for Tagaroa Monorepo

# =============================================================================
# VARIABLES
# =============================================================================

# Project Configuration
PROJECT_NAME := tagaroa

# Package Managers
NODE_PKG_MANAGER := bun

# Directories
BUILD_DIR := build

# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
MAGENTA := \033[0;35m
CYAN := \033[0;36m
NC := \033[0m

# =============================================================================
# HELP & INFO
# =============================================================================

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available commands
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  Tagaroa - Unified Development Commands$(NC)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(NC) %s\n", $$1, $$2}'

.PHONY: info
info: ## Show project information
	@echo "$(BLUE)━━━ Project Information ━━━$(NC)"
	@echo "  Project: $(PROJECT_NAME)"
	@echo "  Node Package Manager: $(NODE_PKG_MANAGER)"
	@echo "  Node Apps: $(NODE_APPS)"
	@echo "  Current TF Environment: $(TF_ENV)"

# =============================================================================
# SETUP & DEPENDENCIES
# =============================================================================

.PHONY: setup
setup: install-deps env-setup ## Complete project setup (Setup)
	@echo "$(GREEN)✅ Setup complete!$(NC)"

.PHONY: install-deps
install-deps: install-node install-ansible ## Install all dependencies (Dependencies)

.PHONY: install-node
install-node: ## Install Node.js dependencies (Dependencies)
	@echo "$(BLUE)Installing Node.js dependencies...$(NC)"
	@$(NODE_PKG_MANAGER) install
	@echo "$(GREEN)✅ Node.js dependencies installed!$(NC)"

.PHONY: env-setup
env-setup: ## Setup environment files from examples (Setup)
	@echo "$(BLUE)Setting up environment files...$(NC)"
	@for server in $(NODE_SERVERS); do \
		if [ -f servers/$$server/.env.example ] && [ ! -f servers/$$server/.env ]; then \
			cp servers/$$server/.env.example servers/$$server/.env; \
			echo "$(YELLOW)Created servers/$$server/.env$(NC)"; \
		fi; \
	done
	@for app in $(NODE_APPS); do \
		if [ -f apps/$$app/.env.example ] && [ ! -f apps/$$app/.env ]; then \
			cp apps/$$app/.env.example apps/$$app/.env; \
			echo "$(YELLOW)Created apps/$$app/.env$(NC)"; \
		fi; \
	done

.PHONY: clean
clean: ## Clean all build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@$(NODE_PKG_MANAGER) run clean 2>/dev/null || true
	@rm -rf $(BUILD_DIR)
	@rm -rf apps/*/.next apps/*/dist packages/*/dist
	@echo "$(GREEN)✅ Cleaned!$(NC)"
