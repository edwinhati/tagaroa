import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	admin,
	haveIBeenPwned,
	jwt,
	multiSession,
	oidcProvider,
	openAPI,
} from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";

type UserInfoClaimSource = {
	name?: string | null;
	image?: string | null;
	email?: string | null;
	emailVerified?: boolean | null;
};

type ClientMetadata = {
	internal?: boolean;
};

type AuthClient = {
	metadata?: ClientMetadata | null;
};

export const trustedOrigins = process.env.TRUSTED_ORIGINS
	? process.env.TRUSTED_ORIGINS.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	: [];

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
		schema,
	}),
	// disabledPaths: ["/token"],
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		crossSubDomainCookies: {
			enabled: true,
			domain: process.env.BASE_URL?.replace(/^https?:\/\//, ""),
		},
		ipAddress: {
			// Support multiple IP headers for different proxy setups
			ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
		},
		database: {
			generateId: () => crypto.randomUUID(),
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	rateLimit: {
		enabled: true, // Enable rate limiting in all environments
		window: 60, // 1 minute window
		max: 100, // 100 requests per minute per IP
		storage: process.env.NODE_ENV === "production" ? "database" : "memory", // Use database in production
		customRules: {
			// Stricter limits for authentication endpoints
			"/sign-in/email": {
				window: 10, // 10 seconds
				max: 3, // 3 attempts per 10 seconds
			},
			"/sign-up/email": {
				window: 60, // 1 minute
				max: 5, // 5 sign-up attempts per minute
			},
			"/reset-password": {
				window: 300, // 5 minutes
				max: 3, // 3 password reset attempts per 5 minutes
			},
			"/verify-email": {
				window: 60, // 1 minute
				max: 5, // 5 verification attempts per minute
			},
			// OAuth endpoints
			"/oauth2/authorize": {
				window: 60,
				max: 20, // 20 authorization attempts per minute
			},
			"/oauth2/token": {
				window: 60,
				max: 30, // 30 token requests per minute
			},
			// Skip rate limiting for certain endpoints
			"/.well-known/*": false,
			"/jwks": false,
			"/oauth2/userinfo": {
				window: 60,
				max: 200, // Higher limit for userinfo endpoint
			},
		},
	},
	plugins: [
		jwt({
			jwt: {
				issuer: `${process.env.BASE_URL}/api/auth`,
				audience: process.env.BASE_URL as string,
				expirationTime: "15m",
			},
			jwks: {
				keyPairConfig: {
					alg: "RS256",
					modulusLength: 2048,
				},
			},
		}),
		admin(),
		oidcProvider({
			useJWTPlugin: true, // Use JWT plugin
			loginPage: process.env.AUTH_APP_URL as string,
			consentPage: `${process.env.AUTH_APP_URL}/consent`, // Custom consent page
			allowDynamicClientRegistration: process.env.NODE_ENV !== "production", // Only allow in development
			metadata: {
				issuer: `${process.env.BASE_URL}/api/auth`,
				userinfo_endpoint: `${process.env.BASE_URL}/api/auth/oauth2/userinfo`,
				registration_endpoint: `${process.env.BASE_URL}/api/auth/oauth2/register`,
				authorization_endpoint: `${process.env.BASE_URL}/api/auth/oauth2/authorize`,
				token_endpoint: `${process.env.BASE_URL}/api/auth/oauth2/token`,
				jwks_uri: `${process.env.BASE_URL}/api/auth/jwks`,
				scopes_supported: ["openid", "profile", "email"],
				response_types_supported: ["code"],
				grant_types_supported: ["authorization_code", "refresh_token"],
				subject_types_supported: ["public"],
				id_token_signing_alg_values_supported: ["RS256"],
				token_endpoint_auth_methods_supported: [
					"client_secret_basic",
					"client_secret_post",
					"none",
				],
				code_challenge_methods_supported: ["S256"], // PKCE support
				claims_supported: [
					"sub",
					"name",
					"email",
					"email_verified",
					"picture",
					"given_name",
					"family_name",
				],
			},
			getAdditionalUserInfoClaim: (
				user: UserInfoClaimSource,
				scopes: string[],
				client: AuthClient,
			) => {
				const claims: Record<string, unknown> = {};

				// Add profile information if profile scope is requested
				if (scopes.includes("profile")) {
					claims.name = user.name;
					claims.picture = user.image;
					claims.given_name = user.name?.split(" ")[0];
					claims.family_name = user.name?.split(" ").slice(1).join(" ");
				}

				// Add email information if email scope is requested
				if (scopes.includes("email")) {
					claims.email = user.email;
					claims.email_verified = user.emailVerified;
				}

				// Add custom claims for internal applications
				if (client.metadata?.internal) {
					claims.internal_user = true;
					claims.roles = ["user"]; // Add role information for internal apps
				}

				return claims;
			},
		}),
		multiSession({ maximumSessions: 3 }),
		haveIBeenPwned(),
		...(process.env.NODE_ENV === "production" ? [] : [openAPI()]),
	],
	trustedOrigins,
	logger: {
		disabled: false,
		disableColors: false,
		level: process.env.NODE_ENV === "production" ? "error" : "info",
		log: (level, message, ...args) => {
			// Custom logging implementation with timestamp
			const timestamp = new Date().toISOString();
			console.log(
				`[${timestamp}] [${level.toUpperCase()}] ${message}`,
				...args,
			);
		},
	},
});
