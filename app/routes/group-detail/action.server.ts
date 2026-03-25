import type { ActionFunctionArgs } from "react-router";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import { createPost } from "~/server/community.service.server";
import {
	removeGroupMember,
	requestGroupAccess,
	updateGroupMemberRole,
	updateGroupMembershipApproval,
	updateGroupVisibility,
} from "~/server/group.service.server";
import { parseGroupVisibilityMode } from "~/server/group-membership.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { extractPostUploadsFromMultipartRequest } from "~/server/post-assets.server";
import type { PostListItem } from "~/server/post-list.service.server";
import { parsePostListSortMode } from "~/server/post-list.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";
import { toCommunityUser, toPriorityPostListItem } from "../community/shared";

export type GroupDetailPostSuccessAction = {
	ok: true;
	actionType: "post";
	createdPost: PostListItem;
};

export type GroupDetailActionData =
	| GroupDetailPostSuccessAction
	| {
			ok: true;
			actionType:
				| "request-access"
				| "approve-membership"
				| "reject-membership"
				| "update-visibility"
				| "update-member-role"
				| "remove-member";
			message: string;
	  }
	| { error: string };

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<GroupDetailActionData> {
	const sortMode = parsePostListSortMode(
		new URL(request.url).searchParams.get("sort"),
	);
	let multipart: Awaited<
		ReturnType<typeof extractPostUploadsFromMultipartRequest>
	> | null = null;
	let formData: FormData | null = null;
	let actionType = "";

	try {
		const isMultipart = (request.headers.get("content-type") ?? "")
			.toLowerCase()
			.includes("multipart/form-data");
		multipart = isMultipart
			? await extractPostUploadsFromMultipartRequest({ request })
			: null;
		formData = multipart ? null : await request.formData();
		actionType = multipart
			? multipart.actionType
			: String(formData?.get("_action") ?? "");
		const authUser = await getAuthUserFromRequest({ request });
		const groupId = params.groupId ?? "";

		if (!authUser) {
			return { error: "Sign in required" };
		}

		const setup = await getSetupStatus();
		if (!setup.isSetup || !setup.instance) {
			return { error: "Setup not completed" };
		}

		const user = toCommunityUser({ authUser });
		await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		});

		if (actionType === "request-access") {
			const viewerRole = await getInstanceViewerRole({
				instanceId: setup.instance.id,
				userId: authUser.id,
			});
			const result = await requestGroupAccess({
				groupId,
				authUser,
				instanceViewerRole: viewerRole,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action:
					result.outcome === "joined" ? "group.join" : "group.request_access",
				actor: { type: "user", id: authUser.id },
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: { outcome: result.outcome },
			});

			return {
				ok: true,
				actionType,
				message:
					result.outcome === "joined"
						? "You joined the group."
						: result.outcome === "requested"
							? "Access request sent."
							: "Access request is already pending.",
			};
		}

		if (actionType === "post") {
			const text = multipart
				? multipart.bodyText
				: String(formData?.get("bodyText") ?? "");
			const parentPostId = multipart
				? multipart.parentPostId
				: String(formData?.get("parentPostId") ?? "").trim() || undefined;
			const result = await createPost({
				user,
				text,
				albumTags: multipart?.albumTags ?? [],
				parentPostId,
				groupId,
				uploads: multipart?.uploads ?? [],
			});
			await multipart?.cleanup();
			if (!result.ok) {
				return { error: result.error };
			}

			return {
				ok: true,
				actionType,
				createdPost: toPriorityPostListItem({
					post: result.createdPost,
					sortMode,
				}),
			};
		}

		if (
			actionType === "approve-membership" ||
			actionType === "reject-membership"
		) {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const status =
				actionType === "approve-membership" ? "approved" : "rejected";
			const result = await updateGroupMembershipApproval({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
				status,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action:
					status === "approved"
						? "group.membership.approve"
						: "group.membership.reject",
				actor: { type: "user", id: authUser.id },
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: { targetUserId, status },
			});

			return {
				ok: true,
				actionType,
				message:
					status === "approved"
						? "Membership approved."
						: "Membership rejected.",
			};
		}

		if (actionType === "update-visibility") {
			const visibilityMode = parseGroupVisibilityMode(
				String(formData?.get("visibilityMode") ?? "public"),
			);
			const result = await updateGroupVisibility({
				groupId,
				managerUserId: authUser.id,
				visibilityMode,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.visibility.update",
				actor: { type: "user", id: authUser.id },
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					previousVisibilityMode: result.previousVisibilityMode,
					visibilityMode,
				},
			});

			return { ok: true, actionType, message: "Group visibility updated." };
		}

		if (actionType === "update-member-role") {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const role = String(formData?.get("role") ?? "");
			const result = await updateGroupMemberRole({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
				role,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.member.role_update",
				actor: { type: "user", id: authUser.id },
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: { targetUserId, role: result.role },
			});

			return { ok: true, actionType, message: "Member role updated." };
		}

		if (actionType === "remove-member") {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const result = await removeGroupMember({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.member.remove",
				actor: { type: "user", id: authUser.id },
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: { targetUserId },
			});

			return {
				ok: true,
				actionType,
				message: "Member removed from group.",
			};
		}

		await multipart?.cleanup().catch(() => undefined);
		return { error: "Unsupported action" };
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
		return {
			error: error instanceof Error ? error.message : "Request failed",
		};
	}
}
