import { createAuth } from "./auth";
import { createAuthMetadataRepository } from "./infrastructure/persistence/auth.persistence.module";

export const auth = createAuth(createAuthMetadataRepository(), {
  baseURL: "http://localhost:8080",
  nodeEnv: "development",
  passkeyOrigins: "http://localhost:3001",
  passkeyRpId: "localhost",
  secret: "schema-generation-only-not-used-at-runtime",
  trustedOrigins: ["http://localhost:8080"],
});
