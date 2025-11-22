import posthog from "posthog-js";

export function initPostHog(key?: string, host?: string) {
	const hasWindow =
		typeof globalThis !== "undefined" &&
		typeof (globalThis as { window?: Window }).window !== "undefined";

	if (hasWindow && key) {
		posthog.init(key, {
			api_host: host,
			// Disable automatic pageview capture since we handle it manually
			capture_pageview: false,
			// Enable session recording (optional)
			disable_session_recording: false,
			// Respect user privacy
			respect_dnt: true,
			// Enable feature flags
			bootstrap: {
				featureFlags: {},
			},
		});
	}
}
