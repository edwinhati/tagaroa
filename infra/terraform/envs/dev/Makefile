.PHONY: help init plan apply destroy clean kubeconfig talosconfig status

# Default target
help: ## Show this help message
	@echo "Talos Kubernetes Cluster on Proxmox"
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

init: ## Initialize Terraform
	terraform init

plan: ## Plan Terraform deployment
	terraform plan

apply: ## Apply Terraform configuration
	terraform apply

destroy: ## Destroy infrastructure
	terraform destroy

clean: ## Clean Terraform state and cache
	rm -rf .terraform/
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate*

kubeconfig: ## Save kubeconfig to file
	@mkdir -p ~/.kube
	terraform output -raw kubeconfig > ~/.kube/tagaroa-config
	@echo "Kubeconfig saved to ~/.kube/tagaroa-config"
	@echo "Run: export KUBECONFIG=~/.kube/tagaroa-config"

talosconfig: ## Save talosconfig to file
	@mkdir -p ~/.talos
	terraform output -raw talosconfig > ~/.talos/tagaroa-config
	@echo "Talosconfig saved to ~/.talos/tagaroa-config"
	@echo "Run: export TALOSCONFIG=~/.talos/tagaroa-config"

configs: kubeconfig talosconfig ## Save both kubeconfig and talosconfig

status: ## Show cluster status
	@echo "=== Terraform State ==="
	terraform show
	@echo ""
	@echo "=== Cluster Endpoint ==="
	terraform output cluster_endpoint
	@echo ""
	@echo "=== Node IPs ==="
	@echo "Control Plane:"
	terraform output -json control_plane_ips | jq -r '.[]'
	@echo "Workers:"
	terraform output -json worker_ips | jq -r '.[]'

validate: ## Validate Terraform configuration
	terraform validate
	terraform fmt -check

format: ## Format Terraform files
	terraform fmt -recursive

upgrade: ## Upgrade Terraform providers
	terraform init -upgrade
