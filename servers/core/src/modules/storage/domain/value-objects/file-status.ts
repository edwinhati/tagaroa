export enum FileStatus {
  PENDING = "PENDING", // Uploaded, awaiting scan
  SCANNED = "SCANNED", // Scanned, clean
  INFECTED = "INFECTED", // Scanned, infected
}
