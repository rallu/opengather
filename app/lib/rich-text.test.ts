import assert from "node:assert/strict";
import test from "node:test";

import {
	plainTextToRichTextDocument,
	RICH_TEXT_VERSION,
	resolveRichTextLinkTarget,
} from "./rich-text.ts";

test("plainTextToRichTextDocument tokenizes links, mentions, and routes", () => {
	const document = plainTextToRichTextDocument(
		"Check https://example.com @alex /groups and plain text",
	);
	assert.equal(document.version, RICH_TEXT_VERSION);
	assert.equal(document.blocks.length, 1);

	const block = document.blocks[0];
	assert.equal(block?.type, "paragraph");
	assert.deepEqual(block?.children, [
		{ type: "text", text: "Check " },
		{
			type: "link",
			text: "https://example.com",
			target: { type: "external", href: "https://example.com" },
		},
		{ type: "text", text: " " },
		{
			type: "link",
			text: "@alex",
			target: { type: "profile", profileId: "alex", to: "/profile/alex" },
		},
		{ type: "text", text: " " },
		{
			type: "link",
			text: "/groups",
			target: { type: "route", to: "/groups" },
		},
		{ type: "text", text: " and plain text" },
	]);
});

test("plainTextToRichTextDocument preserves paragraph breaks", () => {
	const document = plainTextToRichTextDocument(
		"First paragraph\n\nSecond paragraph",
	);
	assert.equal(document.blocks.length, 2);
	assert.equal(document.blocks[0]?.children[0]?.type, "text");
	assert.equal(document.blocks[1]?.children[0]?.type, "text");
});

test("resolveRichTextLinkTarget handles typed targets", () => {
	assert.equal(
		resolveRichTextLinkTarget({ type: "profile", profileId: "alex" }),
		"/profile/alex",
	);
	assert.equal(
		resolveRichTextLinkTarget({ type: "route", to: "/feed" }),
		"/feed",
	);
	assert.equal(
		resolveRichTextLinkTarget({
			type: "external",
			href: "https://example.com",
		}),
		"https://example.com",
	);
});
