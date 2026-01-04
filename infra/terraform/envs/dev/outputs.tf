output "talosconfig" {
  description = "Talos configuration for cluster management"
  value       = module.talos.talosconfig
  sensitive   = true
}

output "kubeconfig" {
  description = "Kubernetes configuration for cluster access"
  value       = module.talos.kubeconfig
  sensitive   = true
}

output "cluster_endpoint" {
  description = "Kubernetes cluster endpoint"
  value       = module.talos.cluster_endpoint
}

output "control_plane_ips" {
  description = "Control plane node IP addresses"
  value       = module.talos.control_plane_ips
}

output "worker_ips" {
  description = "Worker node IP addresses"
  value       = module.talos.worker_ips
}

output "cluster_name" {
  description = "Talos cluster name"
  value       = module.talos.cluster_name
}
