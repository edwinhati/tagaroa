KUBECTL ?= kubectl

MINIO_HELM_RELEASE := ./release/minio.yaml
MINIO_HELM_REPO := ../../helm/bitnami.yaml
MINIO_SECRET := ./secrets/minio-secret.yaml

POSTGRES_RELEASE := ./release/postgres.yaml
PG_SECRET := ./secrets/pg-secret.yaml
CNPG_HELM_REPO := ../../helm/cnpg.yaml
CNPG_HELM_RELEASE := ./release/cnpg.yaml

.PHONY: deploy-minio
deploy-minio: ## Deploy MinIO HelmRelease via Flux
	@echo "Deploying MinIO release..."
	@$(KUBECTL) apply -f $(MINIO_HELM_REPO)
	@$(KUBECTL) get namespace minio >/dev/null 2>&1 || $(KUBECTL) create namespace minio
	@$(KUBECTL) apply -f $(MINIO_SECRET)
	@$(KUBECTL) apply -f $(MINIO_HELM_RELEASE)
	@echo "MinIO HelmRelease applied!"

.PHONY: install-cnpg
install-cnpg: ## Install CloudNativePG operator via Flux
	@echo "Installing CloudNativePG operator..."
	@$(KUBECTL) apply -f $(CNPG_HELM_REPO)
	@$(KUBECTL) get namespace cnpg-system >/dev/null 2>&1 || $(KUBECTL) create namespace cnpg-system
	@$(KUBECTL) apply -f $(CNPG_HELM_RELEASE)
	@echo "Waiting for CNPG operator to be ready..."
	@until $(KUBECTL) get deployment -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg -o name 2>/dev/null | grep -q .; do sleep 2; done
	@$(KUBECTL) wait --for=condition=available --timeout=120s deployment -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg
	@echo "CloudNativePG operator installed!"

.PHONY: deploy-postgres
deploy-postgres: ## Deploy CloudNativePG Postgres cluster
	@echo "Deploying PostgreSQL cluster..."
	@$(KUBECTL) get helmrelease cnpg -n cnpg-system >/dev/null 2>&1 || $(MAKE) install-cnpg
	@$(KUBECTL) get namespace postgres >/dev/null 2>&1 || $(KUBECTL) create namespace postgres
	@$(KUBECTL) apply -f $(PG_SECRET)
	@cat $(MINIO_SECRET) | sed 's/namespace: minio/namespace: postgres/' | $(KUBECTL) apply -f -
	@$(KUBECTL) apply -f $(POSTGRES_RELEASE)
	@echo "PostgreSQL cluster applied!"
