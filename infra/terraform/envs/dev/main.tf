terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.96.0"
    }
    talos = {
      source  = "siderolabs/talos"
      version = "~> 0.10.1"
    }
  }
  required_version = ">= 1.0"
}

provider "proxmox" {
  endpoint = var.proxmox_endpoint
  username = var.proxmox_username
  password = var.proxmox_password
  insecure = var.proxmox_insecure
}

module "talos" {
  source = "../../modules/talos"

  # Proxmox Configuration
  proxmox_endpoint  = var.proxmox_endpoint
  proxmox_username  = var.proxmox_username
  proxmox_password  = var.proxmox_password
  proxmox_insecure  = var.proxmox_insecure
  proxmox_nodes     = var.proxmox_nodes
  proxmox_datastore = var.proxmox_datastore
  proxmox_storage   = var.proxmox_storage

  # Cluster Configuration
  cluster_name             = var.cluster_name
  talos_version            = var.talos_version
  talos_image_schematic_id = var.talos_image_schematic_id

  # Network Configuration
  network_bridge  = var.network_bridge
  network_vlan    = var.network_vlan
  default_gateway = var.default_gateway
  dns_servers     = var.dns_servers

  # Control Plane Configuration
  control_plane_count     = var.control_plane_count
  control_plane_cpu       = var.control_plane_cpu
  control_plane_memory    = var.control_plane_memory
  control_plane_disk_size = var.control_plane_disk_size
  control_plane_ips       = var.control_plane_ips
  control_plane_vip       = var.control_plane_vip

  # Worker Configuration
  worker_count                  = var.worker_count
  worker_cpu                    = var.worker_cpu
  worker_memory                 = var.worker_memory
  worker_disk_size              = var.worker_disk_size
  worker_ips                    = var.worker_ips
  worker_storage_disk_size      = var.worker_storage_disk_size
  enable_worker_storage         = var.enable_worker_storage
  enable_post_deployment_config = var.enable_post_deployment_config

  # Tailscale Configuration
  enable_tailscale   = var.enable_tailscale
  tailscale_auth_key = var.tailscale_auth_key

  # Netbird Configuration
  enable_netbird         = var.enable_netbird
  netbird_setup_key      = var.netbird_setup_key
  netbird_management_url = var.netbird_management_url
  netbird_admin_url      = var.netbird_admin_url

  # MetalLB Configuration
  enable_metallb       = var.enable_metallb
  metallb_helm_version = var.metallb_helm_version
  metallb_ip_range     = var.metallb_ip_range
}
