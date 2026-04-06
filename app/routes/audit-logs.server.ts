import type { LoaderFunctionArgs } from "react-router";
import {
	canAccessAuditLogs,
	getViewerContext,
} from "~/server/permissions.server";

type AuditLogFilters = {
	actorType: string;
	actorId: string;
	resourceType: string;
	resourceId: string;
	action: string;
};

type AuditLogRow = {
	id: string;
	createdAt: Date;
	action: string;
	actorId: string | null;
	actorType: string;
	resourceType: string | null;
	resourceId: string | null;
	payload: unknown;
};

function parseFilters(request: Request): AuditLogFilters {
	const url = new URL(request.url);
	return {
		actorType: url.searchParams.get("actorType")?.trim() ?? "",
		actorId: url.searchParams.get("actorId")?.trim() ?? "",
		resourceType: url.searchParams.get("resourceType")?.trim() ?? "",
		resourceId: url.searchParams.get("resourceId")?.trim() ?? "",
		action: url.searchParams.get("action")?.trim() ?? "",
	};
}

function buildAuditWhere(filters: AuditLogFilters): Record<string, string> {
	const where: Record<string, string> = {};
	if (filters.actorType) {
		where.actorType = filters.actorType;
	}
	if (filters.actorId) {
		where.actorId = filters.actorId;
	}
	if (filters.resourceType) {
		where.resourceType = filters.resourceType;
	}
	if (filters.resourceId) {
		where.resourceId = filters.resourceId;
	}
	if (filters.action) {
		where.action = filters.action;
	}
	return where;
}

function formatActorLabel(
	row: Pick<AuditLogRow, "actorType" | "actorId">,
): string {
	const typeLabel =
		row.actorType === "agent"
			? "Agent"
			: row.actorType === "user"
				? "User"
				: row.actorType === "system"
					? "System"
					: row.actorType;
	return row.actorId ? `${typeLabel}:${row.actorId}` : typeLabel;
}

function formatResourceLabel(
	row: Pick<AuditLogRow, "resourceType" | "resourceId">,
): string {
	if (!row.resourceType) {
		return "-";
	}

	return row.resourceId
		? `${row.resourceType}:${row.resourceId}`
		: row.resourceType;
}

export async function loadAuditLogs(
	request: Request,
	deps?: {
		canAccess?: typeof canAccessAuditLogs;
		getViewer?: typeof getViewerContext;
		findLogs?: (params: {
			where: Record<string, string>;
		}) => Promise<AuditLogRow[]>;
	},
) {
	const filters = parseFilters(request);
	const viewer = await (deps?.getViewer ?? getViewerContext)({ request });
	if (!viewer.authUser) {
		return {
			status: "unauthenticated" as const,
			authUser: null,
			viewerRole: "guest" as const,
			logs: [],
			filters,
		};
	}

	if (
		!(deps?.canAccess ?? canAccessAuditLogs)({ viewerRole: viewer.viewerRole })
			.allowed
	) {
		return {
			status: "forbidden" as const,
			authUser: viewer.authUser,
			viewerRole: viewer.viewerRole,
			logs: [],
			filters,
		};
	}

	const where = buildAuditWhere(filters);
	const logRows = await (
		deps?.findLogs ??
		(async ({ where: queryWhere }: { where: Record<string, string> }) => {
			const { getDb } = await import("~/server/db.server");
			return getDb().auditLog.findMany({
				where: queryWhere,
				orderBy: { createdAt: "desc" },
				take: 200,
				select: {
					id: true,
					createdAt: true,
					action: true,
					actorId: true,
					actorType: true,
					resourceType: true,
					resourceId: true,
					payload: true,
				},
			});
		})
	)({ where });

	return {
		status: "ok" as const,
		authUser: viewer.authUser,
		viewerRole: viewer.viewerRole,
		filters,
		logs: logRows.map((row) => ({
			...row,
			actorLabel: formatActorLabel(row),
			resourceLabel: formatResourceLabel(row),
			payloadText: row.payload ? JSON.stringify(row.payload) : "",
		})),
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		return await loadAuditLogs(request);
	} catch {
		return {
			status: "error" as const,
			authUser: null,
			viewerRole: "guest" as const,
			logs: [],
			filters: parseFilters(request),
		};
	}
}
