# Wait for Longhorn to be ready and create default StorageClass
resource "null_resource" "longhorn_setup" {
  count = var.enable_post_deployment_config && var.enable_worker_storage ? 1 : 0
  depends_on = [null_resource.post_deployment_config]

  provisioner "local-exec" {
    command = <<-EOT
      # Wait for Longhorn to be ready
      kubectl wait --for=condition=ready pod -l app=longhorn-manager -n longhorn-system --timeout=600s || true

      # Set Longhorn as default StorageClass
      kubectl patch storageclass longhorn -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' || true

      # Remove local-path as default if it exists
      kubectl patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}' || true
    EOT

    environment = {
      KUBECONFIG = "${path.root}/kubeconfig"
    }
  }
}
