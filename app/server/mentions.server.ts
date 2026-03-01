export function extractMentionEmails(params: { text: string }): string[] {
	const matches = params.text.match(
		/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,})/g,
	);
	if (!matches) {
		return [];
	}
	return [...new Set(matches.map((value) => value.slice(1).toLowerCase()))];
}
