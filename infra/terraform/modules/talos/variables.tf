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
  default     = "v1.8.3"

  validation {
    condition     = can(regex("^v\\d+\\.\\d+\\.\\d+$", var.talos_version))
    error_message = "talos_version must be in format 'vX.Y.Z' (e.g., v1.12.4)."
  }
}

variable "talos_image_schematic_id" {
  description = "Talos Image Factory schematic ID for custom extensions"
  type        = string
  default     = ""

  validation {
    condition     = var.talos_image_schematic_id == "" || can(regex("^[a-f0-9]{64}$", var.talos_image_schematic_id))
    error_message = "talos_image_schematic_id must be a 64-character hex string or empty."
  }
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
  default     = "192.168.1.1"
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

  validation {
    condition     = var.control_plane_count >= 1 && var.control_plane_count % 2 == 1
    error_message = "control_plane_count must be an odd number >= 1 for etcd quorum."
  }
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

  validation {
    condition     = var.control_plane_memory >= 2048
    error_message = "control_plane_memory must be at least 2048 MB for Talos."
  }
}

variable "control_plane_disk_size" {
  description = "Disk size in GB for control plane nodes"
  type        = number
  default     = 32
}

variable "control_plane_ips" {
  description = "Static IP addresses for control plane nodes"
  type        = list(string)
  default     = ["192.168.1.10", "192.168.1.11", "192.168.1.12"]
}

variable "control_plane_vip" {
  description = "Virtual IP for control plane load balancer"
  type        = string
  default     = "192.168.1.15"
}

# Worker Nodes
variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 3

  validation {
    condition     = var.worker_count >= 1
    error_message = "worker_count must be at least 1."
  }
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

  validation {
    condition     = var.worker_memory >= 2048
    error_message = "worker_memory must be at least 2048 MB for Talos."
  }
}

variable "worker_disk_size" {
  description = "Disk size in GB for worker nodes"
  type        = number
  default     = 64
}

variable "worker_ips" {
  description = "Static IP addresses for worker nodes"
  type        = list(string)
  default     = ["192.168.1.20", "192.168.1.21", "192.168.1.22"]
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

# Netbird Configuration
variable "enable_netbird" {
  description = "Enable Netbird VPN extension on all nodes"
  type        = bool
  default     = false
}

variable "netbird_setup_key" {
  description = "Netbird peer setup key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "netbird_management_url" {
  description = "Netbird management URL (leave empty for cloud-hosted Netbird)"
  type        = string
  default     = ""
}

variable "netbird_admin_url" {
  description = "Netbird admin URL (leave empty for cloud-hosted Netbird)"
  type        = string
  default     = ""
}

# MetalLB Configuration
variable "enable_metallb" {
  description = "Enable MetalLB for LoadBalancer services"
  type        = bool
  default     = true
}

variable "metallb_helm_version" {
  description = "MetalLB Helm chart version"
  type        = string
  default     = "0.15.3"
}

variable "metallb_ip_range" {
  description = "IP address range for MetalLB LoadBalancer services (e.g., 10.10.10.200-10.10.10.250)"
  type        = string
  default     = "10.10.10.200-10.10.10.250"
}