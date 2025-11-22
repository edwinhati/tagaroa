import type { Context } from "hono";
import { auth } from "../auth";
import { config } from "../config";
import type { Logger } from "../logger";

export const handleAuth = async (c: Context) => {
	const requestId = c.get("requestId") as string | undefined;
	const logger = c.get("logger") as Logger | undefined;

	try {
		const response = await auth.handler(c.req.raw);

		if (requestId && !response.headers.has("x-request-id")) {
			response.headers.set("x-request-id", requestId);
		}

		return response;
	} catch (err) {
		const error = err as Error;
		logger?.error(
			`Auth handler failed - ${error.message}`,
			config.isDevelopment ? error.stack : undefined,
			requestId ? `req:${requestId}` : undefined,
		);

		const headers = new Headers();
		if (requestId) {
			headers.set("x-request-id", requestId);
		}

		if (config.isDevelopment) {
			headers.set("content-type", "application/json");
			return new Response(
				JSON.stringify({
					error: "Internal Server Error",
					message: error.message,
					requestId,
				}),
				{ status: 500, headers },
			);
		}

		return new Response(null, { status: 500, headers });
	}
};
