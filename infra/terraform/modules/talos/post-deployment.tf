# Post-deployment configuration for additional features
# This can be applied after the cluster is running to avoid slowing initial deployment

# Null resource to apply additional configurations after cluster is ready
resource "null_resource" "post_deployment_config" {
  count = var.enable_post_deployment_config ? 1 : 0

  triggers = {
    # Force re-run to apply Longhorn namespace security fixes
    deploy_version     = "v2-fix-longhorn-psp"
    enable_tailscale   = var.enable_tailscale
    tailscale_auth_key = var.tailscale_auth_key
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Wait for cluster API to be available
      echo "Waiting for cluster API to be ready..."
      for i in {1..60}; do
        if kubectl get nodes --request-timeout=5s >/dev/null 2>&1; then
          echo "Cluster API is ready!"
          break
        fi
        echo "Attempt $i/60: Cluster not ready yet, waiting 10 seconds..."
        sleep 10
      done

      # Verify cluster is accessible
      if ! kubectl get nodes --request-timeout=5s >/dev/null 2>&1; then
        echo "ERROR: Cluster is not accessible after 10 minutes"
        exit 1
      fi

      # Wait for all nodes to be ready
      echo "Waiting for all nodes to be ready..."
      kubectl wait --for=condition=Ready nodes --all --timeout=300s

      # Apply additional manifests with validation disabled to avoid API issues
      echo "Applying kubelet-serving-cert-approver..."
      kubectl apply --validate=false -f https://raw.githubusercontent.com/alex1989hu/kubelet-serving-cert-approver/main/deploy/standalone-install.yaml
      
      echo "Applying metrics-server..."
      kubectl apply --validate=false -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
      
      # Wait for metrics-server deployment to exist before patching
      kubectl wait --for=condition=available --timeout=60s deployment/metrics-server -n kube-system || true
      
      # Patch metrics-server to add --kubelet-insecure-tls
      kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

      # Apply Longhorn if storage is enabled
      %{ if var.enable_worker_storage }
      echo "Setting up Longhorn storage..."
      # Create namespace and label it FIRST
      kubectl create namespace longhorn-system --dry-run=client -o yaml | kubectl apply -f -
      kubectl label namespace longhorn-system pod-security.kubernetes.io/enforce=privileged pod-security.kubernetes.io/audit=privileged pod-security.kubernetes.io/warn=privileged --overwrite
      
      # Then apply Longhorn with validation disabled
      kubectl apply --validate=false -f https://raw.githubusercontent.com/longhorn/longhorn/v1.10.1/deploy/longhorn.yaml
      %{ else }
      echo 'Storage disabled, skipping Longhorn'
      %{ endif }

      # Deploy MetalLB for LoadBalancer support
      %{ if var.enable_metallb }
      echo "Setting up MetalLB..."
      
      # Create namespace with privileged labels
      kubectl create namespace metallb-system --dry-run=client -o yaml | kubectl apply -f -
      kubectl label namespace metallb-system pod-security.kubernetes.io/enforce=privileged pod-security.kubernetes.io/audit=privileged pod-security.kubernetes.io/warn=privileged --overwrite
      
      # Add MetalLB Helm repo and install
      helm repo add metallb https://metallb.github.io/metallb 2>/dev/null || true
      helm repo update
      helm upgrade --install metallb metallb/metallb \
        --namespace metallb-system \
        --version ${var.metallb_helm_version} \
        --wait --timeout 5m
      
      # Wait for MetalLB to be ready
      echo "Waiting for MetalLB controller..."
      kubectl wait --for=condition=available --timeout=120s deployment/metallb-controller -n metallb-system
      
      # Create IPAddressPool
      cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
    - ${var.metallb_ip_range}
EOF

      # Create L2Advertisement
      cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - default-pool
EOF

      echo "MetalLB deployed with IP range: ${var.metallb_ip_range}"
      %{ else }
      echo 'MetalLB disabled, skipping'
      %{ endif }

      # Configure Tailscale if enabled
      %{ if var.enable_tailscale && var.tailscale_auth_key != "" }
      echo "Configuring Tailscale..."
      
      # Configure Tailscale on all nodes
      %{ for ip in concat(var.control_plane_ips, var.worker_ips) }
      echo "Configuring Tailscale on node ${ip}..."
      talosctl --nodes ${ip} service tailscaled start || true
      talosctl --nodes ${ip} exec -- tailscale up --auth-key="${var.tailscale_auth_key}" --accept-routes --accept-dns=false || true
      %{ endfor }
      
      echo "Tailscale configuration completed!"
      %{ else }
      echo 'Tailscale disabled or no auth key provided, skipping Tailscale configuration'
      %{ endif }
      
      echo "Post-deployment configuration completed successfully!"
    EOT
    
    environment = {
      KUBECONFIG = "${path.root}/kubeconfig"
      TALOSCONFIG = "${path.root}/talosconfig"
    }
  }

  depends_on = [
    talos_cluster_kubeconfig.cluster,
    local_file.kubeconfig,
    local_file.talosconfig
  ]
}

# Save kubeconfig to file for post-deployment scripts
resource "local_file" "kubeconfig" {
  content  = talos_cluster_kubeconfig.cluster.kubeconfig_raw
  filename = "${path.root}/kubeconfig"
  
  depends_on = [talos_cluster_kubeconfig.cluster]
}

# Save talosconfig to file for post-deployment scripts
resource "local_file" "talosconfig" {
  content  = data.talos_client_configuration.talosconfig.talos_config
  filename = "${path.root}/talosconfig"
  
  depends_on = [data.talos_client_configuration.talosconfig]
}