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
