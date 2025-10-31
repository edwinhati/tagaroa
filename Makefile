# Unified Makefile for Mixed Node.js/Go Monorepo
# Optimized for Turborepo + Go workspace architecture

# =============================================================================
# VARIABLES
# =============================================================================

# Project Configuration
PROJECT_NAME := registry.gitlab.com/tagaroa
DOCKER_REGISTRY := registry.gitlab.com/tagaroa
GO_VERSION := 1.23.0

# Package Managers
NODE_PKG_MANAGER := bun
GO_CMD := go

# Directories
APPS_DIR := apps
SERVERS_DIR := servers
PACKAGES_DIR := packages
BUILD_DIR := build
BIN_DIR := $(BUILD_DIR)/bin

# Node.js Apps
NODE_APPS := auth admin
NODE_SERVERS := auth

# Go Servers
GO_SERVERS := finance

# Docker Configuration
DOCKER_TARGETOS ?= linux
DOCKER_TARGETARCH ?= amd64
COMPOSE_FILE := docker-compose.yaml

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m

# =============================================================================
# HELP & INFO
# =============================================================================

.PHONY: help
help: ## Show available commands
	@echo "$(BLUE)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: info
info: ## Show project information
	@echo "$(BLUE)Project Information:$(NC)"
	@echo "  Project: $(PROJECT_NAME)"
	@echo "  Go Version: $(GO_VERSION)"
	@echo "  Node Package Manager: $(NODE_PKG_MANAGER)"
	@echo "  Node Apps: $(NODE_APPS)"
	@echo "  Node Servers: $(NODE_SERVERS)"


# =============================================================================
# SETUP & DEPENDENCIES
# =============================================================================

.PHONY: setup
setup: ## Complete project setup
	@echo "$(BLUE)Setting up project...$(NC)"
	@$(MAKE) install-deps
	@$(MAKE) env-setup
	@echo "$(GREEN)Setup complete!$(NC)"

.PHONY: install-deps
install-deps: install-node ## Install all dependencies

.PHONY: install-node
install-node: ## Install Node.js dependencies
	@echo "$(BLUE)Installing Node.js dependencies...$(NC)"
	@$(NODE_PKG_MANAGER) install
	@echo "$(GREEN)Node.js dependencies installed!$(NC)"

.PHONY: env-setup
env-setup: ## Setup environment files from examples
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
	@for server in $(GO_SERVERS); do \
		if [ -f servers/$$server/.env.example ] && [ ! -f servers/$$server/.env ]; then \
			cp servers/$$server/.env.example servers/$$server/.env; \
			echo "$(YELLOW)Created servers/$$server/.env$(NC)"; \
		fi; \
	done

# =============================================================================
# BUILD COMMANDS
# =============================================================================

.PHONY: build
build: build-apps build-servers ## Build all projects

.PHONY: build-apps
build-apps: ## Build all Node.js apps
	@echo "$(BLUE)Building Node.js apps...$(NC)"
	@$(NODE_PKG_MANAGER) run build
	@echo "$(GREEN)Node.js apps built!$(NC)"

.PHONY: build-servers
build-servers: ## Build all servers (Node.js + Go)
	@echo "$(BLUE)Building all servers...$(NC)"
	@mkdir -p $(BIN_DIR)
	@for server in $(GO_SERVERS); do \
		$(MAKE) build-server SERVER=$$server; \
	done
	@echo "$(GREEN)All servers built!$(NC)"

.PHONY: build-server
build-server: ## Build specific server (SERVER=name)
	@if [ -z "$(SERVER)" ]; then \
		echo "$(RED)SERVER variable is required. Usage: make build-server SERVER=finance$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Building server: $(SERVER)$(NC)"
	@if [ ! -d "servers/$(SERVER)" ]; then \
		echo "$(RED)Server directory servers/$(SERVER) not found$(NC)"; \
		exit 1; \
	fi
	@if [ -f "servers/$(SERVER)/go.mod" ]; then \
		cd servers/$(SERVER) && \
		CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
		$(GO_CMD) build -a -installsuffix cgo \
		-ldflags '-extldflags "-static"' \
		-o ../../$(BIN_DIR)/$(SERVER)-server \
		./cmd/main.go; \
		echo "$(GREEN)Built Go server $(SERVER) -> $(BIN_DIR)/$(SERVER)-server$(NC)"; \
	else \
		echo "$(YELLOW)Skipping $(SERVER) - not a Go server$(NC)"; \
	fi

.PHONY: clean
clean: ## Clean all build artifacts
	@echo "$(BLUE)Cleaning all build artifacts...$(NC)"
	@$(NODE_PKG_MANAGER) run clean 2>/dev/null || true
	@rm -rf $(BUILD_DIR)
	@rm -rf apps/*/.next
	@rm -rf apps/*/dist
	@rm -rf packages/*/dist
	@for server in $(GO_SERVERS); do \
		if [ -f servers/$$server/$$server-server ]; then \
			rm servers/$$server/$$server-server; \
		fi; \
	done
	@echo "$(GREEN)All build artifacts cleaned!$(NC)"

# =============================================================================
# TEST COMMANDS
# =============================================================================

.PHONY: test
test: test-apps test-servers ## Run all tests

.PHONY: test-apps
test-apps: ## Run tests for Node.js apps
	@echo "$(BLUE)Running Node.js app tests...$(NC)"
	@$(NODE_PKG_MANAGER) run test 2>/dev/null || echo "$(YELLOW)No test script found for Node.js apps$(NC)"
	@echo "$(GREEN)Node.js app tests completed!$(NC)"

.PHONY: test-servers
test-servers: ## Run tests for all servers
	@echo "$(BLUE)Running server tests...$(NC)"
	@for server in $(GO_SERVERS); do \
		$(MAKE) test-server SERVER=$$server; \
	done
	@echo "$(GREEN)All server tests completed!$(NC)"

.PHONY: test-server
test-server: ## Run tests for specific server (SERVER=name)
	@if [ -z "$(SERVER)" ]; then \
		echo "$(RED)SERVER variable is required. Usage: make test-server SERVER=finance$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Running tests for server: $(SERVER)$(NC)"
	@if [ ! -d "servers/$(SERVER)" ]; then \
		echo "$(RED)Server directory servers/$(SERVER) not found$(NC)"; \
		exit 1; \
	fi
	@if [ -f "servers/$(SERVER)/go.mod" ]; then \
		cd servers/$(SERVER) && \
		$(GO_CMD) test -v ./...; \
		echo "$(GREEN)Go server $(SERVER) tests completed!$(NC)"; \
	else \
		echo "$(YELLOW)Skipping $(SERVER) - not a Go server$(NC)"; \
	fi

.PHONY: test-watch
test-watch: ## Run tests in watch mode (SERVER=name for specific server)
	@if [ -n "$(SERVER)" ]; then \
		echo "$(BLUE)Running tests in watch mode for server: $(SERVER)$(NC)"; \
		if [ -f "servers/$(SERVER)/go.mod" ]; then \
			cd servers/$(SERVER) && \
			$(GO_CMD) test -v ./... -count=1 -run=.; \
		fi; \
	else \
		echo "$(BLUE)Running Node.js tests in watch mode...$(NC)"; \
		$(NODE_PKG_MANAGER) run test:watch 2>/dev/null || echo "$(YELLOW)No test:watch script found$(NC)"; \
	fi

.PHONY: test-coverage
test-coverage: ## Run tests with coverage (SERVER=name for specific server)
	@if [ -n "$(SERVER)" ]; then \
		echo "$(BLUE)Running tests with coverage for server: $(SERVER)$(NC)"; \
		if [ -f "servers/$(SERVER)/go.mod" ]; then \
			cd servers/$(SERVER) && \
			$(GO_CMD) test -v ./... -coverprofile=coverage.out && \
			$(GO_CMD) tool cover -html=coverage.out -o coverage.html; \
			echo "$(GREEN)Coverage report generated: servers/$(SERVER)/coverage.html$(NC)"; \
		fi; \
	else \
		echo "$(BLUE)Running Node.js tests with coverage...$(NC)"; \
		$(NODE_PKG_MANAGER) run test:coverage 2>/dev/null || echo "$(YELLOW)No test:coverage script found$(NC)"; \
	fi

# =============================================================================
# DOCKER COMMANDS
# =============================================================================

.PHONY: docker-build
docker-build: docker-build-apps docker-build-servers ## Build all Docker images

.PHONY: docker-build-apps
docker-build-apps: ## Build Docker images for all apps
	@echo "$(BLUE)Building Docker images for apps...$(NC)"
	@for app in $(NODE_APPS); do \
		if [ -f apps/$$app/Dockerfile ]; then \
			$(MAKE) docker-build-app APP=$$app; \
		fi; \
	done

.PHONY: docker-build-servers
docker-build-servers: ## Build Docker images for all servers
	@echo "$(BLUE)Building Docker images for servers...$(NC)"
	@for server in $(NODE_SERVERS) $(GO_SERVERS); do \
		if [ -f servers/$$server/Dockerfile ]; then \
			$(MAKE) docker-build-server SERVER=$$server; \
		fi; \
	done

.PHONY: docker-build-app
docker-build-app: ## Build Docker image for specific app (APP=name)
	@echo "$(BLUE)Building Docker image for app: $(APP)$(NC)"
	@if [ -f apps/$(APP)/.env ]; then \
		echo "$(YELLOW)Loading environment variables from apps/$(APP)/.env$(NC)"; \
		ENV_ARGS=$$(grep -v '^#' apps/$(APP)/.env | grep -v '^$$' | sed 's/^/--build-arg /' | tr '\n' ' '); \
		docker build \
			--build-arg APP=$(APP) \
			$$ENV_ARGS \
			-t $(DOCKER_REGISTRY)/$(APP)-app:latest \
			-f apps/$(APP)/Dockerfile .; \
	else \
		docker build \
			--build-arg APP=$(APP) \
			-t $(DOCKER_REGISTRY)/$(APP)-app:latest \
			-f apps/$(APP)/Dockerfile .; \
	fi

.PHONY: docker-build-server
docker-build-server: ## Build Docker image for specific server (SERVER=name)
	@echo "$(BLUE)Building Docker image for server: $(SERVER)$(NC)"
	@docker build \
		--build-arg TARGETOS=$(DOCKER_TARGETOS) \
		--build-arg TARGETARCH=$(DOCKER_TARGETARCH) \
		-t $(DOCKER_REGISTRY)/$(SERVER)-server:latest \
		-f servers/$(SERVER)/Dockerfile .
	@echo "$(BLUE)Building Docker image for Go server: $(SERVER)$(NC)"
	@docker build \
		--build-arg TARGETOS=$(DOCKER_TARGETOS) \
		--build-arg TARGETARCH=$(DOCKER_TARGETARCH) \
		-t $(DOCKER_REGISTRY)/$(SERVER)-server:latest \
		-f servers/$(SERVER)/Dockerfile .

.PHONY: docker-up
docker-up: ## Start services with docker-compose
	@echo "$(BLUE)Starting services...$(NC)"
	@docker compose up -d

.PHONY: docker-down
docker-down: ## Stop docker compose services
	@echo "$(BLUE)Stopping services...$(NC)"
	@docker compose down

.PHONY: docker-logs
docker-logs: ## Show docker compose logs
	@docker compose logs -f

.PHONY: docker-clean
docker-clean: ## Clean Docker images and containers
	@echo "$(BLUE)Cleaning Docker resources...$(NC)"
	@docker system prune -f
	@docker image prune -f
	@echo "$(GREEN)Docker cleanup completed!$(NC)"

.PHONY: docker-rebuild
docker-rebuild: docker-clean docker-build ## Clean and rebuild all Docker images

# =============================================================================
# DATABASE COMMANDS
# =============================================================================

.PHONY: db-init
db-init: ## Initialize databases
	@echo "$(BLUE)Initializing databases...$(NC)"
	@docker-compose up -d postgres
	@sleep 5
	@for db in auth finance file; do \
		docker-compose exec postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$$db'" | grep -q 1 || \
		docker-compose exec postgres psql -U postgres -c "CREATE DATABASE $$db;"; \
	done
	@for user in auth finance file; do \
		if ! docker-compose exec postgres psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$$user'" | grep -q 1; then \
			docker-compose exec postgres psql -U postgres -c "CREATE USER $$user WITH PASSWORD '$$user';"; \
		fi; \
		docker-compose exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $$user TO $$user;"; \
	done
	@echo "$(GREEN)Databases initialized!$(NC)"


# =============================================================================
# DOCUMENTATION COMMANDS
# =============================================================================
.PHONY: swagger
swagger: ## Generate Swagger docs for the selected server, e.g. make swagger SERVER=auth
	@set -euo pipefail; \
	if [ -z "$(SERVER)" ]; then \
		echo "$(RED)SERVER variable is required. Usage: make swagger SERVER=auth$(NC)"; \
		exit 1; \
	fi; \
	if [ ! -d "$(SERVERS_DIR)" ]; then \
		echo "$(RED)Servers directory $(SERVERS_DIR) not found$(NC)"; \
		exit 1; \
	fi; \
	if ! command -v swag >/dev/null 2>&1; then \
		echo "$(RED)swag CLI not found. Install it with: go install github.com/swaggo/swag/cmd/swag@latest$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Generating Swagger docs for $(SERVICE)...$(NC)"; \
	mkdir -p $(CURDIR)/.gocache; \
	cd $(SERVICE_DIR); \
	export GOCACHE=$(CURDIR)/.gocache; \
	SWAG_EXTRA_DIRS=$$(find . -type f -name '*.go' \
		-not -path "./cmd/*" \
		-not -path "./docs/*" \
		-not -path "./vendor/*" \
		-exec dirname {} \; | sed 's#^\./##' | sort -u); \
	SWAG_DIRS="cmd"; \
	for dir in $$SWAG_EXTRA_DIRS; do \
		if [ -n "$$dir" ] && [ "$$dir" != "cmd" ]; then \
			SWAG_DIRS="$$SWAG_DIRS,$$dir"; \
		fi; \
	done; \
	swag fmt -g main.go -d $$SWAG_DIRS; \
	swag init -g main.go -d $$SWAG_DIRS -o docs --parseDependency --parseInternal; \
	echo "$(GREEN)Swagger docs generated in $(SWAGGER_OUTPUT_DIR)$(NC)"
