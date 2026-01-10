# ============================================================================
# Ansible K8s Deployment Makefile
# ============================================================================

ANSIBLE ?= ansible-playbook
ANSIBLE_GALAXY ?= ansible-galaxy
INVENTORY_DEV := inventories/dev/hosts.yml

# Additional arguments (e.g., ARGS="--check --diff")
ARGS ?=

# ============================================================================
# Targets
# ============================================================================

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

# ----------------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------------

.PHONY: install-requirements
install-requirements: ## Install Ansible Galaxy requirements
	@echo "Installing Ansible collections..."
	@$(ANSIBLE_GALAXY) collection install -r requirements.yml --force
	@echo "Done!"

.PHONY: lint
lint: ## Run ansible-lint on playbooks
	@ansible-lint playbooks/*.yml

.PHONY: syntax-check
syntax-check: ## Check playbook syntax
	@$(ANSIBLE) playbooks/deploy.yml --syntax-check

# ----------------------------------------------------------------------------
# Deploy Commands
# ----------------------------------------------------------------------------

.PHONY: deploy
deploy: ## Deploy all services to dev
	@echo "Deploying to DEV environment..."
	@$(ANSIBLE) playbooks/deploy.yml -i $(INVENTORY_DEV) $(ARGS)

.PHONY: deploy-minio
deploy-minio: ## Deploy MinIO
	@$(ANSIBLE) playbooks/deploy-minio.yml -i $(INVENTORY_DEV) $(ARGS)

.PHONY: deploy-postgres
deploy-postgres: ## Deploy PostgreSQL
	@$(ANSIBLE) playbooks/deploy-postgres.yml -i $(INVENTORY_DEV) $(ARGS)

.PHONY: deploy-kong
deploy-kong: ## Deploy Kong Gateway
	@$(ANSIBLE) playbooks/deploy-kong.yml -i $(INVENTORY_DEV) $(ARGS)

# ----------------------------------------------------------------------------
# Dry Run
# ----------------------------------------------------------------------------

.PHONY: dry-run
dry-run: ## Dry run deployment
	@$(ANSIBLE) playbooks/deploy.yml -i $(INVENTORY_DEV) --check --diff

# ----------------------------------------------------------------------------
# Status and Cleanup
# ----------------------------------------------------------------------------

KUBECONFIG_PATH := ../terraform/envs/dev/kubeconfig

.PHONY: status
status: ## Show deployment status
	@export KUBECONFIG=$(KUBECONFIG_PATH) && \
	echo "=== Namespaces ===" && \
	kubectl get ns minio cnpg-system postgres kong metallb-system 2>/dev/null || echo "Some namespaces not found" && \
	echo "\n=== Helm Releases ===" && \
	helm list -A 2>/dev/null || true && \
	echo "\n=== PostgreSQL Clusters ===" && \
	kubectl get clusters -A 2>/dev/null || true && \
	echo "\n=== LoadBalancer Services ===" && \
	kubectl get svc -A | grep LoadBalancer 2>/dev/null || true && \
	echo "\n=== Pods ===" && \
	kubectl get pods -n minio 2>/dev/null || true && \
	kubectl get pods -n kong 2>/dev/null || true && \
	kubectl get pods -n postgres 2>/dev/null || true

.PHONY: cleanup
cleanup: ## Remove all deployments
	@echo "Cleaning up DEV environment..."
	@$(ANSIBLE) playbooks/cleanup.yml -i $(INVENTORY_DEV) $(ARGS)
