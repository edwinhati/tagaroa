# Generate Talos machine secrets
resource "talos_machine_secrets" "cluster_secrets" {}

# Generate Talos client configuration
data "talos_client_configuration" "talosconfig" {
  cluster_name         = var.cluster_name
  client_configuration = talos_machine_secrets.cluster_secrets.client_configuration
  endpoints            = var.control_plane_ips
}

# Generate control plane machine configuration
data "talos_machine_configuration" "control_plane" {
  cluster_name     = var.cluster_name
  cluster_endpoint = "https://${var.control_plane_vip}:6443"
  machine_type     = "controlplane"
  machine_secrets  = talos_machine_secrets.cluster_secrets.machine_secrets
  
  config_patches = [
    yamlencode({
      machine = {
        network = {
          interfaces = [{
            interface = "eth0"
            addresses = ["${var.control_plane_ips[0]}/24"]
            routes = [{
              network = "0.0.0.0/0"
              gateway = var.default_gateway
            }]
          }]
          nameservers = var.dns_servers
        }
      }
    })
  ]
}

# Generate worker machine configuration
data "talos_machine_configuration" "worker" {
  count            = var.worker_count
  cluster_name     = var.cluster_name
  cluster_endpoint = "https://${var.control_plane_vip}:6443"
  machine_type     = "worker"
  machine_secrets  = talos_machine_secrets.cluster_secrets.machine_secrets
  
  config_patches = [
    yamlencode({
      machine = {
        network = {
          interfaces = [{
            interface = "eth0"
            addresses = ["${var.worker_ips[count.index]}/24"]
            routes = [{
              network = "0.0.0.0/0"
              gateway = var.default_gateway
            }]
          }]
          nameservers = var.dns_servers
        }
      }
    })
  ]
}

# Apply configuration to control plane nodes
resource "talos_machine_configuration_apply" "control_plane" {
  count                       = var.control_plane_count
  client_configuration        = talos_machine_secrets.cluster_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.control_plane.machine_configuration
  node                        = var.control_plane_ips[count.index]

  config_patches = concat([
    # Essential network configuration only
    yamlencode({
      machine = {
        install = {
          extraKernelArgs = ["net.ifnames=0"]
        }
        network = {
          interfaces = [
            {
              interface = "eth0"
              vip = {
                ip = var.control_plane_vip
              }
            }
          ]
        }
      }
    })
  ],
  # Tailscale ExtensionServiceConfig
  var.enable_tailscale && var.tailscale_auth_key != "" ? [
    yamlencode({
      apiVersion = "v1alpha1"
      kind       = "ExtensionServiceConfig"
      name       = "tailscale"
      environment = [
        "TS_AUTHKEY=${var.tailscale_auth_key}"
      ]
    })
  ] : [])

  depends_on = [proxmox_virtual_environment_vm.control_plane]
}

# Apply configuration to worker nodes
resource "talos_machine_configuration_apply" "worker" {
  count                       = var.worker_count
  client_configuration        = talos_machine_secrets.cluster_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.worker[count.index].machine_configuration
  node                        = var.worker_ips[count.index]

  config_patches = concat([
    # Essential network configuration only
    yamlencode({
      machine = {
        install = {
          extraKernelArgs = ["net.ifnames=0"]
        }
      }
    })
  ],
  # Tailscale ExtensionServiceConfig
  var.enable_tailscale && var.tailscale_auth_key != "" ? [
    yamlencode({
      apiVersion = "v1alpha1"
      kind       = "ExtensionServiceConfig"
      name       = "tailscale"
      environment = [
        "TS_AUTHKEY=${var.tailscale_auth_key}"
      ]
    })
  ] : [])

  depends_on = [
    proxmox_virtual_environment_vm.worker,
    talos_machine_configuration_apply.control_plane
  ]
}

# Bootstrap the cluster
resource "talos_machine_bootstrap" "cluster" {
  client_configuration = talos_machine_secrets.cluster_secrets.client_configuration
  node                 = var.control_plane_ips[0]

  depends_on = [talos_machine_configuration_apply.control_plane]
}

# Generate kubeconfig
resource "talos_cluster_kubeconfig" "cluster" {
  client_configuration = talos_machine_secrets.cluster_secrets.client_configuration
  node                 = var.control_plane_ips[0]

  depends_on = [talos_machine_bootstrap.cluster]
}
