import assert from "node:assert/strict";
import test from "node:test";
import { extractMentionEmails } from "./mentions.server.ts";

test("extractMentionEmails returns unique lowercase email mentions", () => {
	const emails = extractMentionEmails({
		text: "Hi @USER@example.com and @user@example.com, ping @second.user@domain.org",
	});

	assert.deepEqual(emails, ["user@example.com", "second.user@domain.org"]);
});

test("extractMentionEmails returns empty list when no valid mentions exist", () => {
	const emails = extractMentionEmails({
		text: "Hello @not-an-email and @also_invalid, no matches here.",
	});

	assert.deepEqual(emails, []);
});

test("extractMentionEmails handles punctuation around mentions", () => {
	const emails = extractMentionEmails({
		text: "Thanks, @first.user@example.com! Also looping in (@SECOND@domain.io).",
	});

	assert.deepEqual(emails, ["first.user@example.com", "second@domain.io"]);
});
