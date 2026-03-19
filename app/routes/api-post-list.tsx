import type { LoaderFunctionArgs } from "react-router";
import {
	type CommunityUser,
	loadCommunity,
} from "~/server/community.service.server";
import { loadGroup } from "~/server/group.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { parsePostListSortMode } from "~/server/post-list.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

function toCommunityUser(params: {
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
}): CommunityUser | null {
	if (!params.authUser) {
		return null;
	}
	return {
		id: params.authUser.id,
		hubUserId: params.authUser.hubUserId,
		role: "member",
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const scope = url.searchParams.get("scope");
	const sortMode = parsePostListSortMode(url.searchParams.get("sort"));
	const cursor = url.searchParams.get("cursor");
	const authUser = await getAuthUserFromRequest({ request });

	if (scope === "community") {
		const user = toCommunityUser({ authUser });
		const result = await loadCommunity({
			user,
			sortMode,
			cursor,
		});
		if (result.status !== "ok") {
			return Response.json({ error: result.status }, { status: 403 });
		}
		return Response.json(result.page);
	}

	if (scope === "group") {
		const groupId = url.searchParams.get("groupId") ?? "";
		const setup = await getSetupStatus();
		if (!setup.isSetup || !setup.instance) {
			return Response.json({ error: "not_setup" }, { status: 503 });
		}

		const viewerRole = authUser
			? await getInstanceViewerRole({
					instanceId: setup.instance.id,
					userId: authUser.id,
				})
			: "guest";
		const result = await loadGroup({
			groupId,
			authUser,
			instanceViewerRole: viewerRole,
			sortMode,
			cursor,
		});

		if (result.status !== "ok") {
			return Response.json({ error: result.status }, { status: 403 });
		}
		return Response.json(result.page);
	}

	return Response.json({ error: "unsupported_scope" }, { status: 400 });
}
