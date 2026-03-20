import assert from "node:assert/strict";
import test from "node:test";

import {
	cleanupParsedMultipartForm,
	parseMultipartForm,
} from "./multipart-form.server.ts";

test("parseMultipartForm ignores empty file placeholders from optional inputs", async () => {
	const formData = new FormData();
	formData.set("_action", "post");
	formData.set("bodyText", "hello world");
	formData.set(
		"assets",
		new File([new Uint8Array()], "", {
			type: "application/octet-stream",
		}),
	);

	const parsed = await parseMultipartForm({
		request: new Request("http://localhost/feed", {
			method: "POST",
			body: formData,
		}),
		maxFiles: 10,
		maxFileSizeBytes: 1024 * 1024,
	});

	try {
		assert.equal(parsed.fields.get("_action"), "post");
		assert.equal(parsed.fields.get("bodyText"), "hello world");
		assert.deepEqual(parsed.files, []);
	} finally {
		await cleanupParsedMultipartForm(parsed);
	}
});

test("parseMultipartForm keeps actual uploaded files", async () => {
	const formData = new FormData();
	formData.set(
		"assets",
		new File([new Uint8Array([1, 2, 3])], "photo.png", {
			type: "image/png",
		}),
	);

	const parsed = await parseMultipartForm({
		request: new Request("http://localhost/feed", {
			method: "POST",
			body: formData,
		}),
		maxFiles: 10,
		maxFileSizeBytes: 1024 * 1024,
	});

	try {
		assert.equal(parsed.files.length, 1);
		assert.equal(parsed.files[0]?.fieldName, "assets");
		assert.equal(parsed.files[0]?.filename, "photo.png");
		assert.equal(parsed.files[0]?.mimeType, "image/png");
		assert.equal(parsed.files[0]?.byteSize, 3);
	} finally {
		await cleanupParsedMultipartForm(parsed);
	}
});
