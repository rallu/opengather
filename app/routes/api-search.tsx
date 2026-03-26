import type { LoaderFunctionArgs } from "react-router";
import {
	MINIMUM_SEARCH_QUERY_LENGTH,
	normalizeSearchQuery,
	type SearchResults,
} from "~/lib/search";
import { getViewerContext } from "~/server/permissions.server";
import { searchPosts, searchProfiles } from "~/server/search.service.server";

function emptyResults(query: string): SearchResults {
	return {
		query,
		people: [],
		posts: [],
	};
}

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<SearchResults> {
	const query = normalizeSearchQuery(
		new URL(request.url).searchParams.get("q"),
	);

	if (query.length < MINIMUM_SEARCH_QUERY_LENGTH) {
		return emptyResults(query);
	}

	const { authUser, setup, viewerRole } = await getViewerContext({ request });
	if (!setup.isSetup || !setup.instance) {
		return emptyResults(query);
	}

	const [people, posts] = await Promise.all([
		searchProfiles({
			query,
			authUser,
			instanceId: setup.instance.id,
			instanceVisibilityMode: setup.instance.visibilityMode,
			viewerRole,
		}),
		searchPosts({
			query,
			authUser,
			instanceId: setup.instance.id,
			viewerRole,
		}),
	]);

	return {
		query,
		people,
		posts,
	};
}
