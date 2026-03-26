import assert from "node:assert/strict";
import test from "node:test";

import {
	buildUploadedProfileImageUrl,
	isUploadedProfileImageOverride,
	parseProfileImageOverrideInput,
	resolveEffectiveProfileImage,
} from "./profile-image.server.ts";

test("resolveEffectiveProfileImage prefers local override", () => {
	assert.equal(
		resolveEffectiveProfileImage({
			image: "https://hub.example/avatar.png",
			imageOverride: "https://instance.example/local.png",
		}),
		"https://instance.example/local.png",
	);
});

test("resolveEffectiveProfileImage falls back to provider image", () => {
	assert.equal(
		resolveEffectiveProfileImage({
			image: "https://hub.example/avatar.png",
			imageOverride: null,
		}),
		"https://hub.example/avatar.png",
	);
});

test("parseProfileImageOverrideInput accepts blank values for fallback", () => {
	assert.deepEqual(parseProfileImageOverrideInput({ image: "   " }), {
		ok: true,
		value: null,
	});
});

test("parseProfileImageOverrideInput rejects non-http urls", () => {
	assert.deepEqual(
		parseProfileImageOverrideInput({ image: "ftp://example.com/a" }),
		{
			ok: false,
			error: "Image URL must start with http:// or https://.",
		},
	);
});

test("uploaded profile image urls are recognized", () => {
	const uploadedUrl = buildUploadedProfileImageUrl({
		userId: "user-123",
		version: 42,
	});
	assert.equal(isUploadedProfileImageOverride(uploadedUrl), true);
	assert.equal(
		isUploadedProfileImageOverride("https://example.com/avatar.png"),
		false,
	);
});
