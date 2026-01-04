output "talosconfig" {
  description = "Talos configuration for cluster management"
  value       = data.talos_client_configuration.talosconfig.talos_config
  sensitive   = true
}

output "kubeconfig" {
  description = "Kubernetes configuration for cluster access"
  value       = talos_cluster_kubeconfig.cluster.kubeconfig_raw
  sensitive   = true
}

output "cluster_endpoint" {
  description = "Kubernetes cluster endpoint"
  value       = "https://${var.control_plane_vip}:6443"
}

output "control_plane_ips" {
  description = "Control plane node IP addresses"
  value       = var.control_plane_ips
}

output "worker_ips" {
  description = "Worker node IP addresses"
  value       = var.worker_ips
}

output "cluster_name" {
  description = "Talos cluster name"
  value       = var.cluster_name
}
