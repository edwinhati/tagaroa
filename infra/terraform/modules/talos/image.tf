# Download Talos Linux nocloud image to each Proxmox node
resource "proxmox_virtual_environment_download_file" "talos_image" {
  count                   = length(var.proxmox_nodes)
  content_type            = "iso"
  datastore_id            = var.proxmox_storage
  node_name               = var.proxmox_nodes[count.index]
  file_name               = "talos-${var.talos_version}-nocloud-amd64.img"
  url                     = "https://factory.talos.dev/image/${var.talos_image_schematic_id}/${var.talos_version}/nocloud-amd64.raw.gz"
  decompression_algorithm = "gz"
  overwrite               = true
  overwrite_unmanaged     = true
  upload_timeout          = 3600
}
