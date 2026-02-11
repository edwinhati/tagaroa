# Unified Makefile for Tagaroa Monorepo
# Optimized for Turborepo + Go workspace + K8s Infrastructure

# =============================================================================
# VARIABLES
# =============================================================================

# Project Configuration
PROJECT_NAME := tagaroa
DOCKER_REGISTRY := registry.gitlab.com/tagaroa

# Package Managers
NODE_PKG_MANAGER := bun
NODE_PKG_EXEC := bunx

# Directories
APPS_DIR := apps
SERVERS_DIR := servers
PACKAGES_DIR := packages
BUILD_DIR := build
BIN_DIR := $(BUILD_DIR)/bin
INFRA_DIR := infra

# Terraform
TF_ENV ?= dev
TF_DIR := $(INFRA_DIR)/terraform/envs/$(TF_ENV)

# Ansible
ANSIBLE_DIR := $(INFRA_DIR)/ansible

DOCKER_TARGETOS ?= linux
DOCKER_TARGETARCH ?= amd64
COMPOSE_FILE := docker-compose.yml

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

.PHONY: install-ansible
install-ansible: ## Install Ansible collections (Dependencies)
	@echo "$(BLUE)Installing Ansible collections...$(NC)"
	@cd $(ANSIBLE_DIR) && make install-requirements
	@echo "$(GREEN)✅ Ansible collections installed!$(NC)"

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

# =============================================================================
# DEVELOPMENT
# =============================================================================

.PHONY: dev
dev: ## Start development servers
	@echo "$(BLUE)Starting development servers...$(NC)"
	
dev-docker: docker-up ## Start Docker infrastructure for development
	@echo "$(GREEN)✅ Docker infrastructure ready!$(NC)"
	@echo "$(BLUE)Run 'make dev' in another terminal to start development servers$(NC)"

# =============================================================================
# BUILD COMMANDS
# =============================================================================

.PHONY: build
build: build-apps ## Build all projects

.PHONY: build-apps
build-apps: ## Build all Node.js apps
	@echo "$(BLUE)Building Node.js apps...$(NC)"
	@$(NODE_PKG_MANAGER) run build
	@echo "$(GREEN)✅ Node.js apps built!$(NC)"

.PHONY: clean
clean: ## Clean all build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@$(NODE_PKG_MANAGER) run clean 2>/dev/null || true
	@rm -rf $(BUILD_DIR)
	@rm -rf apps/*/.next apps/*/dist packages/*/dist
	@echo "$(GREEN)✅ Cleaned!$(NC)"

# =============================================================================
# QUALITY COMMANDS
# =============================================================================

.PHONY: format
format: ## Format all code
	
.PHONY: lint
lint: lint-node ## Run all lint checks

.PHONY: lint-node
lint-node: ## Run lint checks for Node.js
	@echo "$(BLUE)Linting Node.js...$(NC)"
	@$(NODE_PKG_MANAGER) run lint

COVERAGE_FLAG ?=

.PHONY: test
test: test-apps ## Run all tests

.PHONY: test-apps
test-apps: ## Run tests for Node.js apps
	@$(NODE_PKG_MANAGER) run test 2>/dev/null || echo "$(YELLOW)No tests configured$(NC)"

# =============================================================================
# DOCKER COMMANDS
# =============================================================================

.PHONY: docker-up
docker-up: ## Start Docker services
	@echo "$(BLUE)Starting Docker services...$(NC)"
	@docker compose up -d

.PHONY: docker-down
docker-down: ## Stop Docker services
	@docker compose down

.PHONY: docker-logs
docker-logs: ## Show Docker logs
	@docker compose logs -f

.PHONY: docker-ps
docker-ps: ## Show Docker container status
	@docker compose ps

.PHONY: docker-build
docker-build: ## Build all Docker images
	@for app in $(NODE_APPS); do \
		if [ -f apps/$$app/Dockerfile ]; then \
			docker build -t $(DOCKER_REGISTRY)/$$app-app:latest -f apps/$$app/Dockerfile .; \
		fi; \
	done
	@for server in $(NODE_SERVERS); do \
		if [ -f servers/$$server/Dockerfile ]; then \
			docker build -t $(DOCKER_REGISTRY)/$$server-server:latest -f servers/$$server/Dockerfile .; \
		fi; \
	done

.PHONY: docker-clean
docker-clean: ## Clean Docker resources
	@docker system prune -f
	@docker image prune -f

# =============================================================================
# INFRASTRUCTURE - TERRAFORM
# =============================================================================

.PHONY: tf-init
tf-init: ## Initialize Terraform (TF_ENV=dev|staging|prod)
	@echo "$(BLUE)Initializing Terraform for $(TF_ENV)...$(NC)"
	@cd $(TF_DIR) && terraform init

.PHONY: tf-plan
tf-plan: ## Plan Terraform changes (TF_ENV=dev|staging|prod)
	@echo "$(BLUE)Planning Terraform for $(TF_ENV)...$(NC)"
	@cd $(TF_DIR) && terraform plan

.PHONY: tf-apply
tf-apply: ## Apply Terraform changes (TF_ENV=dev|staging|prod)
	@echo "$(BLUE)Applying Terraform for $(TF_ENV)...$(NC)"
	@cd $(TF_DIR) && terraform apply

.PHONY: tf-destroy
tf-destroy: ## Destroy Terraform resources (TF_ENV=dev|staging|prod)
	@echo "$(RED)⚠️  Destroying Terraform resources for $(TF_ENV)...$(NC)"
	@cd $(TF_DIR) && terraform destroy

.PHONY: tf-output
tf-output: ## Show Terraform outputs (TF_ENV=dev|staging|prod)
	@cd $(TF_DIR) && terraform output

# =============================================================================
# INFRASTRUCTURE - KUBERNETES (ANSIBLE)
# =============================================================================

.PHONY: k8s-deploy
k8s-deploy: ## Deploy all K8s services via Ansible
	@echo "$(BLUE)Deploying K8s services...$(NC)"
	@cd $(ANSIBLE_DIR) && make deploy

.PHONY: k8s-deploy-kong
k8s-deploy-kong: ## Deploy Kong Gateway
	@cd $(ANSIBLE_DIR) && make deploy-kong

.PHONY: k8s-deploy-minio
k8s-deploy-minio: ## Deploy MinIO
	@cd $(ANSIBLE_DIR) && make deploy-minio

.PHONY: k8s-deploy-postgres
k8s-deploy-postgres: ## Deploy PostgreSQL
	@cd $(ANSIBLE_DIR) && make deploy-postgres

.PHONY: k8s-status
k8s-status: ## Show K8s deployment status
	@cd $(ANSIBLE_DIR) && make status

.PHONY: k8s-cleanup
k8s-cleanup: ## Cleanup K8s deployments
	@cd $(ANSIBLE_DIR) && make cleanup

# =============================================================================
# INFRASTRUCTURE - QUICK COMMANDS
# =============================================================================

.PHONY: infra-up
infra-up: tf-apply k8s-deploy ## Provision infrastructure & deploy services
	@echo "$(GREEN)✅ Infrastructure ready!$(NC)"

.PHONY: infra-status
infra-status: tf-output k8s-status ## Show infrastructure status

# =============================================================================
# DATABASE COMMANDS
# =============================================================================

.PHONY: db-init
db-init: ## Initialize databases
	@echo "$(BLUE)Initializing databases...$(NC)"
	
	done
	@echo "$(GREEN)✅ Databases initialized!$(NC)"
