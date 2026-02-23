# Shared config patches for extension services (used by both CP and workers)
locals {
  tailscale_config_patch = var.enable_tailscale && var.tailscale_auth_key != "" ? [
    yamlencode({
      apiVersion = "v1alpha1"
      kind       = "ExtensionServiceConfig"
      name       = "tailscale"
      environment = [
        "TS_AUTHKEY=${var.tailscale_auth_key}"
      ]
    })
  ] : []

  # Workaround for Talos v1.12.x bug #985: ExtensionServiceConfig env vars are NOT injected
  # into extension containers. Instead, we override the netbird.yaml via machine.files to
  # bake NB_SETUP_KEY directly into the container environment, and remove the
  # "configuration: true" dependency so the service doesn't wait for ExtensionServiceConfig.
  netbird_service_yaml = join("\n", compact([
    "name: netbird",
    "depends:",
    "  - service: cri",
    "  - network:",
    "    - addresses",
    "    - connectivity",
    "    - etcfiles",
    "    - hostname",
    "container:",
    "  entrypoint: /usr/local/bin/netbird",
    "  args:",
    "    - \"up\"",
    "    - \"--foreground-mode\"",
    "  environment:",
    "    - NB_SETUP_KEY=${var.netbird_setup_key}",
    var.netbird_management_url != "" ? "    - NB_MANAGEMENT_URL=${var.netbird_management_url}" : "",
    var.netbird_admin_url != "" ? "    - NB_ADMIN_URL=${var.netbird_admin_url}" : "",
    "    - NB_DAEMON_ADDR=unix:///var/run/netbird/netbird.sock",
    "    - NB_LOG_FILE=console,/var/log/netbird/client.log",
    "    - NB_DISABLE_PROFILES=true",
    "    - USER=talos",
    "    - NB_CONFIG=/var/run/netbird/config.json",
    "    - HOME=/var/run/netbird",
    "    - PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "  security:",
    "    writeableRootfs: false",
    "    writeableSysfs: true",
    "  mounts:",
    "  - source: /dev/net/tun",
    "    destination: /dev/net/tun",
    "    type: bind",
    "    options:",
    "      - bind",
    "      - rw",
    "  - source: /var/lib/netbird",
    "    destination: /var/lib/netbird",
    "    type: bind",
    "    options:",
    "      - bind",
    "      - rw",
    "  - source: /var/log/netbird",
    "    destination: /var/log/netbird",
    "    type: bind",
    "    options:",
    "      - bind",
    "      - rw",
    "  - source: /var/run/netbird",
    "    destination: /var/run/netbird",
    "    type: bind",
    "    options:",
    "      - bind",
    "      - rw",
    "  - source: /etc/ssl/certs",
    "    destination: /etc/ssl/certs",
    "    type: bind",
    "    options:",
    "      - rbind",
    "      - ro",
    "  - source: /etc/os-release",
    "    destination: /etc/os-release",
    "    type: bind",
    "    options:",
    "      - bind",
    "      - ro",
    "restart: always",
  ]))

  netbird_file_override_patch = var.enable_netbird && var.netbird_setup_key != "" ? [
    yamlencode({
      machine = {
        files = [{
          content     = local.netbird_service_yaml
          path        = "/usr/local/etc/containers/netbird.yaml"
          permissions = 420
          op          = "overwrite"
        }]
      }
    })
  ] : []

  # Minimal ExtensionServiceConfig to unblock the service from "Waiting for extension service config".
  # Talos v1.12.x always waits for this resource regardless of YAML depends.
  # The actual NB_SETUP_KEY is baked into the YAML override above (bug #985 prevents
  # ExtensionServiceConfig env vars from reaching the container).
  netbird_config_patch = var.enable_netbird && var.netbird_setup_key != "" ? [
    yamlencode({
      apiVersion = "v1alpha1"
      kind       = "ExtensionServiceConfig"
      name       = "netbird"
      environment = [
        "NB_LOG_LEVEL=info"
      ]
    })
  ] : []
}

# Generate Talos machine secrets
resource "talos_machine_secrets" "cluster_secrets" {
  talos_version = var.talos_version
}

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
    yamlencode({
      machine = {
        install = {
          extraKernelArgs = ["net.ifnames=0"]
        }
        network = {
          interfaces = [{
            interface = "eth0"
            vip = {
              ip = var.control_plane_vip
            }
          }]
        }
      }
    })
  ],
  local.tailscale_config_patch,
  local.netbird_file_override_patch,
  local.netbird_config_patch,
  )

  depends_on = [proxmox_virtual_environment_vm.control_plane]
}

# Apply configuration to worker nodes
resource "talos_machine_configuration_apply" "worker" {
  count                       = var.worker_count
  client_configuration        = talos_machine_secrets.cluster_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.worker[count.index].machine_configuration
  node                        = var.worker_ips[count.index]

  config_patches = concat([
    yamlencode({
      machine = {
        install = {
          extraKernelArgs = ["net.ifnames=0"]
        }
      }
    })
  ],
  local.tailscale_config_patch,
  local.netbird_file_override_patch,
  local.netbird_config_patch,
  )

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
