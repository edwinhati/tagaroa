# Control Plane VMs
resource "proxmox_virtual_environment_vm" "control_plane" {
  count       = var.control_plane_count
  name        = "talos-cp-${count.index + 1}"
  description = "Talos Control Plane Node ${count.index + 1} - Managed by Terraform"
  tags        = ["terraform", "talos", "control-plane"]
  node_name   = var.proxmox_nodes[count.index % length(var.proxmox_nodes)]  # Distribute across nodes
  on_boot     = true
  vm_id       = 800 + count.index

  cpu {
    cores = var.control_plane_cpu
    type  = "x86-64-v2-AES"
  }

  memory {
    dedicated = var.control_plane_memory
  }

  agent {
    enabled = false
  }

  network_device {
    bridge  = var.network_bridge
    vlan_id = var.network_vlan
  }

  # Boot disk with Talos nocloud image
  disk {
    datastore_id = var.proxmox_datastore
    file_id      = "${var.proxmox_storage}:iso/talos-${var.talos_version}-nocloud-amd64.img"
    file_format  = "raw"
    interface    = "virtio0"
    size         = var.control_plane_disk_size
  }

  operating_system {
    type = "l26"
  }

  initialization {
    datastore_id = var.proxmox_datastore
    ip_config {
      ipv4 {
        address = "${var.control_plane_ips[count.index]}/24"
        gateway = var.default_gateway
      }
    }
    dns {
      servers = var.dns_servers
    }
  }

  depends_on = [proxmox_virtual_environment_download_file.talos_image]
}
