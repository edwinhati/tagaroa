# Wait for Longhorn to be ready and create default StorageClass
resource "null_resource" "longhorn_setup" {
  count = var.enable_post_deployment_config && var.enable_worker_storage ? 1 : 0
  depends_on = [null_resource.post_deployment_config]

  provisioner "local-exec" {
    command = <<-EOT
      # Create temporary kubeconfig file
      KUBECONFIG_FILE=$(mktemp)
      echo '${talos_cluster_kubeconfig.cluster.kubeconfig_raw}' > "$KUBECONFIG_FILE"
      
      # Wait for Longhorn to be ready
      kubectl --kubeconfig "$KUBECONFIG_FILE" wait --for=condition=ready pod -l app=longhorn-manager -n longhorn-system --timeout=600s || true
      
      # Set Longhorn as default StorageClass
      kubectl --kubeconfig "$KUBECONFIG_FILE" patch storageclass longhorn -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' || true
      
      # Remove local-path as default if it exists
      kubectl --kubeconfig "$KUBECONFIG_FILE" patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}' || true
      
      # Clean up
      rm -f "$KUBECONFIG_FILE"
    EOT
  }
}
