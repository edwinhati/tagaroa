# Global variables used across environments
variable "talos_version" {
  description = "Talos Linux version"
  type        = string
  default     = "v1.12.0"
}

variable "network_bridge" {
  description = "Proxmox network bridge"
  type        = string
  default     = "vmbr0"
}

variable "dns_servers" {
  description = "DNS servers"
  type        = list(string)
  default     = ["8.8.8.8", "8.8.4.4"]
}
