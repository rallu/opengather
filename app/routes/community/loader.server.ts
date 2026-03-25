import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { loadCommunity } from "~/server/community.service.server";
import { loadUserAlbumTags } from "~/server/post-assets.server";
import { parsePostListSortMode } from "~/server/post-list.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";
import { toCommunityUser } from "./shared";

async function loadCommunityData(params: { request: Request }) {
	const url = new URL(params.request.url);
	const sortMode = parsePostListSortMode(url.searchParams.get("sort"));
	const setup = await getSetupStatus();

	try {
		const authUser = await getAuthUserFromRequest({ request: params.request });
		const user = toCommunityUser({ authUser });
		const data = await loadCommunity({ user, sortMode });
		const previousAlbums =
			authUser && setup.isSetup && setup.instance
				? await loadUserAlbumTags({
						instanceId: setup.instance.id,
						userId: authUser.id,
						hubUserId: authUser.hubUserId ?? undefined,
					})
				: [];

		return {
			...data,
			sortMode,
			apiPath: `/api/post-list?scope=community&sort=${sortMode}`,
			authUser,
			previousAlbums,
		};
	} catch {
		return {
			status: "not_setup" as const,
			viewerRole: "guest" as const,
			page: {
				items: [],
				hasMore: false,
				sortMode,
			},
			sortMode,
			apiPath: `/api/post-list?scope=community&sort=${sortMode}`,
			authUser: null,
			previousAlbums: [],
		};
	}
}

export type CommunityLoaderData = Awaited<ReturnType<typeof loadCommunityData>>;

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<CommunityLoaderData | Response> {
	const data = await loadCommunityData({ request });
	if (data.status !== "requires_registration") {
		return data;
	}

	const url = new URL(request.url);
	const params = new URLSearchParams({
		next: url.pathname,
		reason: "members-only",
	});
	return redirect(`/register?${params.toString()}`);
}
