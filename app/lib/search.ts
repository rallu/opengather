export const MINIMUM_SEARCH_QUERY_LENGTH = 2;
export const SEARCH_PEOPLE_LIMIT = 5;
export const SEARCH_POSTS_LIMIT = 6;

export type SearchProfileResult = {
	id: string;
	name: string;
	imageSrc?: string;
	summary?: string;
	profilePath: string;
};

export type SearchPostResult = {
	id: string;
	authorName: string;
	excerpt: string;
	postPath: string;
	groupName?: string;
};

export type SearchResults = {
	query: string;
	people: SearchProfileResult[];
	posts: SearchPostResult[];
};

export function normalizeSearchQuery(raw: string | null | undefined): string {
	return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export function buildSearchExcerpt(
	raw: string | null | undefined,
	maxLength = 140,
): string {
	const compact = (raw ?? "").trim().replace(/\s+/g, " ");
	if (!compact) {
		return "";
	}
	if (compact.length <= maxLength) {
		return compact;
	}
	return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}
