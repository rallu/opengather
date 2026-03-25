import type { LoaderFunctionArgs } from "react-router";
import { ensureInstanceMembershipForUser } from "~/server/community.service.server";
import type { GroupMemberSummary } from "~/server/group.service.server";
import { loadGroup } from "~/server/group.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { loadUserAlbumTags } from "~/server/post-assets.server";
import {
	type PostListPage,
	type PostListSortMode,
	parsePostListSortMode,
} from "~/server/post-list.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";
import { toCommunityUser } from "../community/shared";

type GroupLoadResult = Awaited<ReturnType<typeof loadGroup>>;
type AuthUser = Awaited<ReturnType<typeof getAuthUserFromRequest>>;
type ViewerRole = Awaited<ReturnType<typeof getInstanceViewerRole>> | "guest";
type LoaderContext = {
	authUser: AuthUser;
	viewerRole: ViewerRole;
	previousAlbums: string[];
	sortMode: PostListSortMode;
	apiPath: string;
};

type GroupAccessibleResult = Extract<GroupLoadResult, { group: unknown }>;

type GroupPayload = {
	group: GroupAccessibleResult["group"];
	groupRole: GroupAccessibleResult["groupRole"];
	membershipStatus: GroupAccessibleResult["membershipStatus"];
	joinState: GroupAccessibleResult["joinState"];
	canPost: boolean;
	canManage: boolean;
	page: PostListPage;
	pendingRequests: Array<{
		userId: string;
		label: string;
		requestKey: string;
		role: string;
		approvalStatus: string;
	}>;
	members: GroupMemberSummary[];
};

export type GroupDetailOkData = LoaderContext &
	GroupPayload & {
		status: "ok";
	};
type GroupDetailRestrictedData = LoaderContext &
	GroupPayload & {
		status: "pending_membership" | "forbidden";
	};
type GroupDetailAccessData = LoaderContext & {
	status: "requires_authentication" | "not_found";
};
type GroupDetailNotSetupData = {
	status: "not_setup";
	authUser: AuthUser;
	viewerRole: "guest";
	previousAlbums: string[];
	sortMode: PostListSortMode;
	apiPath: string;
};

export type GroupDetailLoaderData =
	| GroupDetailNotSetupData
	| GroupDetailAccessData
	| GroupDetailRestrictedData
	| GroupDetailOkData;

async function loadGroupDetailData(params: {
	request: Request;
	groupId: string;
}): Promise<GroupDetailLoaderData> {
	const authUser = await getAuthUserFromRequest({ request: params.request });
	const user = toCommunityUser({ authUser });
	const url = new URL(params.request.url);
	const sortMode = parsePostListSortMode(url.searchParams.get("sort"));
	const setup = await getSetupStatus();

	if (!setup.isSetup || !setup.instance) {
		return {
			status: "not_setup" as const,
			authUser,
			viewerRole: "guest" as const,
			previousAlbums: [],
			sortMode,
			apiPath: `/api/post-list?scope=group&groupId=${params.groupId}&sort=${sortMode}`,
		};
	}

	if (user) {
		await ensureInstanceMembershipForUser({
			instanceId: setup.instance.id,
			approvalMode: setup.instance.approvalMode,
			user,
		});
	}

	const viewerRole = user
		? await getInstanceViewerRole({
				instanceId: setup.instance.id,
				userId: user.id,
			})
		: "guest";
	const result = await loadGroup({
		groupId: params.groupId,
		authUser,
		instanceViewerRole: viewerRole,
		sortMode,
	});
	const previousAlbums = authUser
		? await loadUserAlbumTags({
				instanceId: setup.instance.id,
				userId: authUser.id,
				hubUserId: authUser.hubUserId ?? undefined,
			})
		: [];
	const routeContext = {
		authUser,
		viewerRole,
		previousAlbums,
		sortMode,
		apiPath: `/api/post-list?scope=group&groupId=${params.groupId}&sort=${sortMode}`,
	};

	if (result.status === "ok") {
		return {
			...result,
			...routeContext,
		};
	}

	if (
		result.status === "pending_membership" ||
		result.status === "forbidden"
	) {
		return {
			...result,
			...routeContext,
		};
	}

	if (result.status === "requires_authentication") {
		return {
			status: "requires_authentication",
			...routeContext,
		};
	}

	if (result.status === "not_found") {
		return {
			status: "not_found",
			...routeContext,
		};
	}

	return {
		status: "not_setup" as const,
		authUser,
		viewerRole: "guest",
		previousAlbums: [],
		sortMode,
		apiPath: routeContext.apiPath,
	};
}

export async function loader({
	request,
	params,
}: LoaderFunctionArgs): Promise<GroupDetailLoaderData> {
	return loadGroupDetailData({
		request,
		groupId: params.groupId ?? "",
	});
}
