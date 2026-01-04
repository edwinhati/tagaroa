# Worker VMs
resource "proxmox_virtual_environment_vm" "worker" {
  count       = var.worker_count
  name        = "talos-worker-${count.index + 1}"
  description = "Talos Worker Node ${count.index + 1} - Managed by Terraform"
  tags        = ["terraform", "talos", "worker"]
  node_name   = var.proxmox_nodes[(count.index + var.control_plane_count) % length(var.proxmox_nodes)]  # Distribute across nodes
  on_boot     = true
  vm_id       = 810 + count.index

  cpu {
    cores = var.worker_cpu
    type  = "x86-64-v2-AES"
  }

  memory {
    dedicated = var.worker_memory
  }

  agent {
    enabled = false
  }

  network_device {
    bridge  = var.network_bridge
    vlan_id = var.network_vlan
  }

  # Boot disk with Talos image
  disk {
    datastore_id = var.proxmox_datastore
    file_id      = proxmox_virtual_environment_download_file.talos_image[(count.index + var.control_plane_count) % length(var.proxmox_nodes)].id
    file_format  = "raw"
    interface    = "virtio0"
    size         = var.worker_disk_size
  }

  # Additional storage disk for persistent volumes
  dynamic "disk" {
    for_each = var.enable_worker_storage ? [1] : []
    content {
      datastore_id = var.proxmox_datastore
      interface    = "virtio1"
      size         = var.worker_storage_disk_size
      file_format  = "raw"
    }
  }

  operating_system {
    type = "l26"
  }

  initialization {
    datastore_id = var.proxmox_datastore
    ip_config {
      ipv4 {
        address = "${var.worker_ips[count.index]}/24"
        gateway = var.default_gateway
      }
    }
    dns {
      servers = var.dns_servers
    }
  }

  depends_on = [proxmox_virtual_environment_download_file.talos_image]
}
