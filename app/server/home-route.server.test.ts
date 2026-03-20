import assert from "node:assert/strict";
import test from "node:test";

import { shouldRedirectHome } from "./home-route.server.ts";

test("redirects authenticated users away from the landing page", () => {
	assert.equal(
		shouldRedirectHome({
			isSetup: true,
			isAuthenticated: true,
		}),
		true,
	);
});

test("keeps guests on the landing page when the instance is public", () => {
	assert.equal(
		shouldRedirectHome({
			isSetup: true,
			isAuthenticated: false,
		}),
		false,
	);
});

test("keeps guests on the landing page for private instances too", () => {
	assert.equal(
		shouldRedirectHome({
			isSetup: true,
			isAuthenticated: false,
		}),
		false,
	);
});

test("does not redirect before setup is complete", () => {
	assert.equal(
		shouldRedirectHome({
			isSetup: false,
			isAuthenticated: true,
		}),
		false,
	);
});
