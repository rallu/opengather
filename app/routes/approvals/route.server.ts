import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	listPendingApprovals,
	type PendingApprovalRow,
	resolveGroupMembershipApproval,
	resolveInstanceMembershipApproval,
} from "~/server/approval.service.server";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import { getViewerContext } from "~/server/permissions.server";

export type ActionData =
	| { ok: true; message: string }
	| { ok: false; error: string }
	| undefined;

export type ApprovalsLoaderData =
	| {
			status: "unauthenticated";
			authUser: null;
			viewerRole: "guest";
			focusedRequestKey: string;
			instanceRequests: PendingApprovalRow[];
			groupRequests: PendingApprovalRow[];
	  }
	| {
			status: "not_setup" | "forbidden";
			authUser: NonNullable<
				Awaited<ReturnType<typeof getViewerContext>>["authUser"]
			>;
			viewerRole: Awaited<ReturnType<typeof getViewerContext>>["viewerRole"];
			focusedRequestKey: string;
			instanceRequests: PendingApprovalRow[];
			groupRequests: PendingApprovalRow[];
	  }
	| {
			status: "ok";
			authUser: NonNullable<
				Awaited<ReturnType<typeof getViewerContext>>["authUser"]
			>;
			viewerRole: Awaited<ReturnType<typeof getViewerContext>>["viewerRole"];
			focusedRequestKey: string;
			instanceRequests: PendingApprovalRow[];
			groupRequests: PendingApprovalRow[];
	  };

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<ApprovalsLoaderData> {
	const viewer = await getViewerContext({ request });
	const focusedRequestKey = new URL(request.url).searchParams.get("request") ?? "";

	if (!viewer.authUser) {
		return {
			status: "unauthenticated",
			authUser: null,
			viewerRole: "guest",
			focusedRequestKey,
			instanceRequests: [],
			groupRequests: [],
		};
	}

	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return {
			status: "not_setup",
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			focusedRequestKey: "",
			instanceRequests: [],
			groupRequests: [],
		};
	}

	const approvals = await listPendingApprovals({
		instanceId: viewer.setup.instance.id,
		userId: viewer.authUser.id,
		viewerRole: viewer.viewerRole,
	});

	if (!approvals.canAccessApprovals) {
		return {
			status: "forbidden",
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			focusedRequestKey: "",
			instanceRequests: [],
			groupRequests: [],
		};
	}

	return {
		status: "ok",
		authUser: viewer.authUser,
		viewerRole: viewer.viewerRole,
		focusedRequestKey,
		instanceRequests: approvals.instanceRequests,
		groupRequests: approvals.groupRequests,
	};
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<ActionData> {
	const viewer = await getViewerContext({ request });
	if (!viewer.authUser) {
		return { ok: false, error: "Sign in required." };
	}
	if (!viewer.setup.isSetup || !viewer.setup.instance) {
		return { ok: false, error: "Setup not completed." };
	}

	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");
	const scope = String(formData.get("scope") ?? "");
	const targetUserId = String(formData.get("targetUserId") ?? "");
	const status = actionType === "approve" ? "approved" : "rejected";

	if (!targetUserId || (actionType !== "approve" && actionType !== "reject")) {
		return { ok: false, error: "Unsupported approval action." };
	}

	if (scope === "instance") {
		const result = await resolveInstanceMembershipApproval({
			instanceId: viewer.setup.instance.id,
			managerUserId: viewer.authUser.id,
			targetUserId,
			status,
			viewerRole: viewer.viewerRole,
		});
		if (!result.ok) {
			return { ok: false, error: result.error };
		}

		await writeAuditLogSafely({
			action:
				status === "approved"
					? "instance.membership.approve"
					: "instance.membership.reject",
			actor: {
				type: "user",
				id: viewer.authUser.id,
			},
			resourceType: "instance_membership",
			resourceId: targetUserId,
			request,
			payload: {
				targetUserId,
				status,
			},
		});

		return {
			ok: true,
			message:
				status === "approved"
					? "Server membership approved."
					: "Server membership rejected.",
		};
	}

	if (scope !== "group") {
		return { ok: false, error: "Unsupported approval scope." };
	}

	const groupId = String(formData.get("groupId") ?? "");
	if (!groupId) {
		return { ok: false, error: "Group id is required." };
	}

	const result = await resolveGroupMembershipApproval({
		groupId,
		managerUserId: viewer.authUser.id,
		targetUserId,
		status,
	});
	if (!result.ok) {
		return { ok: false, error: result.error };
	}

	await writeAuditLogSafely({
		action:
			status === "approved"
				? "group.membership.approve"
				: "group.membership.reject",
		actor: {
			type: "user",
			id: viewer.authUser.id,
		},
		resourceType: "group",
		resourceId: groupId,
		request,
		payload: {
			targetUserId,
			status,
		},
	});

	return {
		ok: true,
		message:
			status === "approved"
				? "Group membership approved."
				: "Group membership rejected.",
	};
}
