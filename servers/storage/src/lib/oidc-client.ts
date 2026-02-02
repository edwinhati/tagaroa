import * as jose from "jose";
import type { createLogger } from "../logger.js";

export interface OIDCConfig {
  issuerUrl: string;
  clientId: string;
  skipClientIdCheck?: boolean;
}

interface OIDCDiscovery {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
}

export interface TokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  [key: string]: unknown;
}

export class OIDCClient {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private discovery: OIDCDiscovery | null = null;
  private lastRefresh: number = 0;
  private readonly refreshInterval = 60 * 60 * 1000; // 1 hour
  private readonly config: OIDCConfig;
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(config: OIDCConfig, logger: ReturnType<typeof createLogger>) {
    if (!config.issuerUrl?.trim()) {
      throw new Error("issuer URL is required");
    }
    this.config = config;
    this.logger = logger;
  }

  private async ensureInitialized(): Promise<void> {
    const now = Date.now();
    if (this.jwks && now - this.lastRefresh < this.refreshInterval) {
      return;
    }

    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const discoveryUrl = `${this.config.issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`;

    this.logger.info(`Fetching OIDC discovery from ${discoveryUrl}`);

    const discoveryResponse = await fetch(discoveryUrl);
    if (!discoveryResponse.ok) {
      throw new Error(
        `Failed to fetch OIDC discovery: ${discoveryResponse.status} ${discoveryResponse.statusText}`,
      );
    }

    this.discovery = (await discoveryResponse.json()) as OIDCDiscovery;

    if (!this.discovery.jwks_uri) {
      throw new Error("OIDC discovery missing jwks_uri");
    }

    this.logger.info(`Creating JWKS from ${this.discovery.jwks_uri}`);
    this.jwks = jose.createRemoteJWKSet(new URL(this.discovery.jwks_uri));
    this.lastRefresh = Date.now();
  }

  async verify(token: string): Promise<TokenClaims> {
    if (!token?.trim()) {
      throw new Error("token is empty");
    }

    await this.ensureInitialized();

    if (!this.jwks) {
      throw new Error("OIDC client not initialized");
    }

    const options: jose.JWTVerifyOptions = {
      issuer: this.discovery?.issuer || this.config.issuerUrl,
    };

    if (!this.config.skipClientIdCheck && this.config.clientId) {
      options.audience = this.config.clientId;
    }

    const { payload } = await jose.jwtVerify(token, this.jwks, options);

    return payload as TokenClaims;
  }

  async getSubject(token: string): Promise<string> {
    const claims = await this.verify(token);

    if (!claims.sub?.trim()) {
      throw new Error("token subject claim is empty");
    }

    return claims.sub;
  }
}

export async function createOIDCClient(
  config: OIDCConfig,
  logger: ReturnType<typeof createLogger>,
): Promise<OIDCClient> {
  const client = new OIDCClient(config, logger);
  return client;
}
