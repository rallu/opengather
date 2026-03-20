import type { LoaderFunctionArgs } from "react-router";
import { getPendingApprovalSummary } from "~/server/approval.service.server";
import { countUnreadNotifications } from "~/server/notification.service.server";
import { getViewerContext } from "~/server/permissions.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const { authUser, setup, viewerRole } = await getViewerContext({ request });

	if (!authUser || !setup.isSetup || !setup.instance) {
		return {
			unreadCount: 0,
			pendingApprovalCount: 0,
			canAccessApprovals: false,
		};
	}

	const [unreadCount, approvalSummary] = await Promise.all([
		countUnreadNotifications({ userId: authUser.id }),
		getPendingApprovalSummary({
			instanceId: setup.instance.id,
			userId: authUser.id,
			viewerRole,
		}),
	]);

	return {
		unreadCount,
		pendingApprovalCount: approvalSummary.pendingApprovalCount,
		canAccessApprovals: approvalSummary.canAccessApprovals,
	};
}
