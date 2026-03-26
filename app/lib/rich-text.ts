export const RICH_TEXT_VERSION = 1 as const;

export type RichTextDocument = {
	version: typeof RICH_TEXT_VERSION;
	blocks: RichTextBlock[];
};

export type RichTextBlock = RichTextParagraphBlock;

export type RichTextParagraphBlock = {
	type: "paragraph";
	children: RichTextInline[];
};

export type RichTextInline = RichTextTextNode | RichTextLinkNode;

export type RichTextTextNode = {
	type: "text";
	text: string;
};

export type RichTextLinkNode = {
	type: "link";
	text: string;
	target: RichTextLinkTarget;
};

export type RichTextLinkTarget =
	| {
			type: "external";
			href: string;
	  }
	| {
			type: "route";
			to: string;
	  }
	| {
			type: "profile";
			profileId: string;
			to?: string;
	  }
	| {
			type: "post";
			postId: string;
			groupId?: string;
			to?: string;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isTextNode(value: unknown): value is RichTextTextNode {
	return (
		isRecord(value) && value.type === "text" && typeof value.text === "string"
	);
}

function isLinkTarget(value: unknown): value is RichTextLinkTarget {
	if (!isRecord(value) || typeof value.type !== "string") {
		return false;
	}

	switch (value.type) {
		case "external":
			return typeof value.href === "string";
		case "route":
			return typeof value.to === "string";
		case "profile":
			return (
				typeof value.profileId === "string" &&
				(value.to === undefined || typeof value.to === "string")
			);
		case "post":
			return (
				typeof value.postId === "string" &&
				(value.groupId === undefined || typeof value.groupId === "string") &&
				(value.to === undefined || typeof value.to === "string")
			);
		default:
			return false;
	}
}

function isLinkNode(value: unknown): value is RichTextLinkNode {
	return (
		isRecord(value) &&
		value.type === "link" &&
		typeof value.text === "string" &&
		isLinkTarget(value.target)
	);
}

function isInlineNode(value: unknown): value is RichTextInline {
	return isTextNode(value) || isLinkNode(value);
}

function isParagraphBlock(value: unknown): value is RichTextParagraphBlock {
	return (
		isRecord(value) &&
		value.type === "paragraph" &&
		Array.isArray(value.children) &&
		value.children.every(isInlineNode)
	);
}

export function isRichTextDocument(value: unknown): value is RichTextDocument {
	return (
		isRecord(value) &&
		value.version === RICH_TEXT_VERSION &&
		Array.isArray(value.blocks) &&
		value.blocks.every(isParagraphBlock)
	);
}

export function parseRichTextDocument(value: unknown): RichTextDocument | null {
	return isRichTextDocument(value) ? value : null;
}

function getLinkTargetForToken(token: string): RichTextLinkTarget | null {
	if (/^https?:\/\//i.test(token)) {
		return { type: "external", href: token };
	}

	if (/^\/[\w./#-]*$/.test(token)) {
		return { type: "route", to: token };
	}

	const mentionMatch = token.match(/^@([a-zA-Z0-9._-]{2,})$/);
	if (mentionMatch) {
		return {
			type: "profile",
			profileId: mentionMatch[1],
			to: `/profile/${mentionMatch[1]}`,
		};
	}

	return null;
}

function toInlineNodes(text: string): RichTextInline[] {
	const tokenPattern = /(https?:\/\/[^\s]+|\/[\w./#-]+|@[a-zA-Z0-9._-]{2,})/g;
	const nodes: RichTextInline[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(tokenPattern)) {
		const index = match.index ?? 0;
		const matchedText = match[0] ?? "";
		if (index > lastIndex) {
			nodes.push({
				type: "text",
				text: text.slice(lastIndex, index),
			});
		}

		const target = getLinkTargetForToken(matchedText);
		if (target) {
			nodes.push({ type: "link", text: matchedText, target });
		} else {
			nodes.push({ type: "text", text: matchedText });
		}

		lastIndex = index + matchedText.length;
	}

	if (lastIndex < text.length) {
		nodes.push({ type: "text", text: text.slice(lastIndex) });
	}

	if (nodes.length === 0) {
		nodes.push({ type: "text", text: "" });
	}

	return nodes;
}

export function plainTextToRichTextDocument(text: string): RichTextDocument {
	const normalized = text.replace(/\r\n/g, "\n");
	const paragraphs = normalized.split(/\n{2,}/);

	return {
		version: RICH_TEXT_VERSION,
		blocks: paragraphs.map((paragraph) => ({
			type: "paragraph",
			children: toInlineNodes(paragraph),
		})),
	};
}

export function resolveRichTextLinkTarget(target: RichTextLinkTarget): string {
	switch (target.type) {
		case "external":
			return target.href;
		case "route":
			return target.to;
		case "profile":
			return target.to ?? `/profile/${target.profileId}`;
		case "post":
			if (target.to) {
				return target.to;
			}
			if (target.groupId) {
				return `/groups/${target.groupId}#post-${target.postId}`;
			}
			return `/feed#post-${target.postId}`;
	}
}
