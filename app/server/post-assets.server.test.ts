import assert from "node:assert/strict";
import test from "node:test";

import {
	extractPostUploadsFromMultipartRequest,
	parseAlbumTagsInput,
} from "./post-assets.server.ts";

test("parseAlbumTagsInput trims whitespace and deduplicates tags", () => {
	assert.deepEqual(
		parseAlbumTagsInput(" Summer Trip, Volunteers\nsummer trip, Photo Wall "),
		["Summer Trip", "Volunteers", "Photo Wall"],
	);
});

test("extractPostUploadsFromMultipartRequest returns parsed album tags", async () => {
	const formData = new FormData();
	formData.set("_action", "post");
	formData.set("bodyText", "hello world");
	formData.set("assetAlbums", "Summer Trip, Volunteers");
	formData.set(
		"assets",
		new File([new Uint8Array([1, 2, 3])], "photo.png", {
			type: "image/png",
		}),
	);

	const parsed = await extractPostUploadsFromMultipartRequest({
		request: new Request("http://localhost/feed", {
			method: "POST",
			body: formData,
		}),
	});

	try {
		assert.equal(parsed.actionType, "post");
		assert.equal(parsed.bodyText, "hello world");
		assert.deepEqual(parsed.albumTags, ["Summer Trip", "Volunteers"]);
		assert.equal(parsed.uploads.length, 1);
		assert.equal(parsed.uploads[0]?.filename, "photo.png");
	} finally {
		await parsed.cleanup();
	}
});
