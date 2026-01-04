# Proxmox Configuration
variable "proxmox_endpoint" {
  description = "Proxmox VE endpoint URL"
  type        = string
  default     = "https://your-proxmox-ip:8006/"
}

variable "proxmox_username" {
  description = "Proxmox VE username"
  type        = string
  default     = "root@pam"
}

variable "proxmox_password" {
  description = "Proxmox VE password"
  type        = string
  sensitive   = true
}

variable "proxmox_insecure" {
  description = "Skip TLS verification for self-signed certificates"
  type        = bool
  default     = true
}

variable "proxmox_nodes" {
  description = "List of Proxmox node names"
  type        = list(string)
  default     = ["pve"]
}

variable "proxmox_datastore" {
  description = "Proxmox datastore for VM disks"
  type        = string
  default     = "local-lvm"
}

variable "proxmox_storage" {
  description = "Proxmox storage for ISO files"
  type        = string
  default     = "local"
}

# Cluster Configuration
variable "cluster_name" {
  description = "Talos cluster name"
  type        = string
  default     = "tagaroa-k8s"
}

variable "talos_version" {
  description = "Talos Linux version"
  type        = string
  default     = "v1.12.0"
}

# Network Configuration
variable "network_bridge" {
  description = "Proxmox network bridge"
  type        = string
  default     = "vmbr0"
}

variable "network_vlan" {
  description = "VLAN ID (optional)"
  type        = number
  default     = null
}

variable "default_gateway" {
  description = "Default gateway IP"
  type        = string
  default     = "10.10.10.1"
}

variable "dns_servers" {
  description = "DNS servers"
  type        = list(string)
  default     = ["8.8.8.8", "8.8.4.4"]
}

# Control Plane Nodes
variable "control_plane_count" {
  description = "Number of control plane nodes"
  type        = number
  default     = 3
}

variable "control_plane_cpu" {
  description = "CPU cores for control plane nodes"
  type        = number
  default     = 2
}

variable "control_plane_memory" {
  description = "Memory in MB for control plane nodes"
  type        = number
  default     = 4096
}

variable "control_plane_disk_size" {
  description = "Disk size in GB for control plane nodes"
  type        = number
  default     = 32
}

variable "control_plane_ips" {
  description = "Static IP addresses for control plane nodes"
  type        = list(string)
  default     = ["10.10.10.11", "10.10.10.12", "10.10.10.13"]
}

variable "control_plane_vip" {
  description = "Virtual IP for control plane load balancer"
  type        = string
  default     = "10.10.10.10"
}

# Worker Nodes
variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 3
}

variable "worker_cpu" {
  description = "CPU cores for worker nodes"
  type        = number
  default     = 4
}

variable "worker_memory" {
  description = "Memory in MB for worker nodes"
  type        = number
  default     = 8192
}

variable "worker_disk_size" {
  description = "Disk size in GB for worker nodes"
  type        = number
  default     = 64
}

variable "worker_ips" {
  description = "Static IP addresses for worker nodes"
  type        = list(string)
  default     = ["10.10.10.21", "10.10.10.22", "10.10.10.23"]
}

# Additional storage for workers (optional)
variable "worker_storage_disk_size" {
  description = "Additional storage disk size in GB for worker nodes"
  type        = number
  default     = 100
}

variable "enable_worker_storage" {
  description = "Enable additional storage disk for worker nodes"
  type        = bool
  default     = true
}
# Post-deployment configuration
variable "enable_post_deployment_config" {
  description = "Enable post-deployment configuration (metrics-server, longhorn, etc.)"
  type        = bool
  default     = false
}

# Tailscale Configuration
variable "tailscale_auth_key" {
  description = "Tailscale authentication key for node registration"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_tailscale" {
  description = "Enable Tailscale configuration in post-deployment"
  type        = bool
  default     = false
}
