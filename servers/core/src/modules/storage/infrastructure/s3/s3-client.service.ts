import { Injectable } from "@nestjs/common";

interface S3Config {
  provider: "minio" | "aws" | "r2";
  bucket: string;
  region: string;
  endpoint?: string; // For MinIO/R2
  accessKeyId: string;
  secretAccessKey: string;
  accountId?: string; // For Cloudflare R2
}

@Injectable()
export class S3ClientService {
  private readonly config: S3Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): S3Config {
    const provider = (process.env.S3_PROVIDER || "minio") as
      | "minio"
      | "aws"
      | "r2";
    const config: S3Config = {
      provider,
      bucket: process.env.S3_BUCKET || "uploads",
      region: process.env.S3_REGION || "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    };

    // Provider-specific configuration
    if (provider === "minio") {
      config.endpoint = process.env.S3_ENDPOINT || "";
    } else if (provider === "aws") {
      config.endpoint = process.env.S3_ENDPOINT;
    } else if (provider === "r2") {
      config.accountId =
        process.env.S3_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
      config.region = "auto"; // R2 uses 'auto' for regional endpoints
      if (config.accountId) {
        config.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
      } else {
        config.endpoint = process.env.S3_ENDPOINT;
      }
    }

    return config;
  }

  /**
   * Generate AWS Signature V4 headers using Bun's native crypto
   */
  private async getSignedHeaders(
    method: string,
    path: string,
    contentType: string,
    contentLength: number,
    payload: Buffer | null = null,
  ): Promise<Record<string, string>> {
    const { accessKeyId, secretAccessKey, region, endpoint } = this.config;

    // Parse endpoint to get host
    const url = new URL(endpoint || "");
    const host = url.host;

    // AWS Signature V4 requires timestamps in specific format
    const now = new Date();
    const amzDate = now.toISOString().replaceAll(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

    // Calculate payload hash using SHA256 (not HMAC!)
    const payloadHash = payload
      ? new Bun.CryptoHasher("sha256").update(payload).digest("hex")
      : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // Empty payload hash

    // Create canonical headers (must be sorted alphabetically!)
    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    // Only add content-type if it's not empty (for non-GET/HEAD requests)
    if (contentType) {
      headers["content-type"] = contentType;
    }

    // Sort headers alphabetically
    const sortedHeaderKeys = Object.keys(headers).sort((a, b) =>
      a.localeCompare(b),
    );
    const canonicalHeaders = sortedHeaderKeys
      .map((key) => `${key}:${headers[key]}\n`)
      .join("");
    const signedHeaders = sortedHeaderKeys.join(";");

    // Create canonical request
    // IMPORTANT: For Supabase/S3-compatible endpoints with path prefixes (e.g. /storage/v1/s3),
    // the canonical URI MUST include that prefix.
    const endpointPath = url.pathname === "/" ? "" : url.pathname;
    const canonicalUri = `${endpointPath}${path}`;
    const canonicalQueryString = "";

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const canonicalRequestHash = new Bun.CryptoHasher("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    const kDate = new Bun.CryptoHasher("sha256", `AWS4${secretAccessKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = new Bun.CryptoHasher("sha256", kDate)
      .update(region)
      .digest();
    const kService = new Bun.CryptoHasher("sha256", kRegion)
      .update("s3")
      .digest();
    const kSigning = new Bun.CryptoHasher("sha256", kService)
      .update("aws4_request")
      .digest();
    const signature = new Bun.CryptoHasher("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    // Build authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Return headers (must match what we signed!)
    const result: Record<string, string> = {
      Host: host,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
      Authorization: authorizationHeader,
    };

    if (contentType) {
      result["Content-Type"] = contentType;
    }

    if (contentLength > 0) {
      result["Content-Length"] = contentLength.toString();
    }

    return result;
  }

  /**
   * Upload file to S3/MinIO with proper AWS Signature V4 authentication
   */
  async upload(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { endpoint, bucket } = this.config;

    if (!endpoint) {
      throw new Error("S3 endpoint not configured");
    }

    const path = `/${bucket}/${key}`;
    const url = `${endpoint}${path}`;

    // Generate signed headers using AWS Signature V4
    const headers = await this.getSignedHeaders(
      "PUT",
      path,
      contentType,
      fileBuffer.length,
      fileBuffer,
    );

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: new Uint8Array(fileBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `S3 upload failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return url;
  }

  /**
   * Download file from S3
   */
  async download(key: string): Promise<Buffer> {
    const { endpoint, bucket } = this.config;

    if (!endpoint) {
      throw new Error("S3 endpoint not configured");
    }

    const path = `/${bucket}/${key}`;
    const url = `${endpoint}${path}`;
    const headers = await this.getSignedHeaders("GET", path, "", 0);

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`S3 download failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get presigned URL for download
   */
  async getPresignedUrl(key: string): Promise<string> {
    const { endpoint, bucket } = this.config;

    if (!endpoint) {
      throw new Error("S3 endpoint not configured");
    }

    // For now, return direct URL
    // TODO: Implement presigned URL with expiration
    return `${endpoint}/${bucket}/${key}`;
  }

  /**
   * Delete file from S3
   */
  async delete(key: string): Promise<void> {
    const { endpoint, bucket } = this.config;

    if (!endpoint) {
      throw new Error("S3 endpoint not configured");
    }

    const path = `/${bucket}/${key}`;
    const url = `${endpoint}${path}`;
    const headers = await this.getSignedHeaders("DELETE", path, "", 0);

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 delete failed: ${response.statusText}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const { endpoint, bucket } = this.config;

      if (!endpoint) {
        return false;
      }

      const path = `/${bucket}/${key}`;
      const url = `${endpoint}${path}`;
      const headers = await this.getSignedHeaders("HEAD", path, "", 0);

      const response = await fetch(url, {
        method: "HEAD",
        headers,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(
    key: string,
  ): Promise<{ size: number; contentType: string }> {
    const { endpoint, bucket } = this.config;

    if (!endpoint) {
      throw new Error("S3 endpoint not configured");
    }

    const path = `/${bucket}/${key}`;
    const url = `${endpoint}${path}`;
    const headers = await this.getSignedHeaders("HEAD", path, "", 0);

    const response = await fetch(url, {
      method: "HEAD",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    return {
      size: Number.parseInt(response.headers.get("Content-Length") || "0", 10),
      contentType:
        response.headers.get("Content-Type") || "application/octet-stream",
    };
  }

  getBucket(): string {
    return this.config.bucket;
  }
}
