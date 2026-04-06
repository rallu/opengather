import type { LoaderFunctionArgs } from "react-router";
import {
	type AgentAuthResult,
	authenticateAgentRequest,
} from "../server/agent-auth.server.ts";
import {
	agentAuthErrorResponse,
	agentJsonSuccess,
	agentRateLimitedResponse,
	checkAgentRouteRateLimit,
	resolveAgentRequestId,
} from "../server/agent-api.server.ts";
import {
	canSubjectPostToGroup,
	canSubjectViewGroup,
	getSubjectGroupRole,
} from "../server/permissions.server.ts";

type GroupsDb = {
	communityGroup: {
		findMany: (args: {
			where: { instanceId: string };
			orderBy: { createdAt: "asc" | "desc" };
			select: {
				id: true;
				name: true;
				description: true;
				visibilityMode: true;
			};
		}) => Promise<
			Array<{
				id: string;
				name: string;
				description: string | null;
				visibilityMode: string;
			}>
		>;
	};
};

export async function loadAgentGroups(params: {
	request: Request;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
	db?: GroupsDb;
	rateLimit?: (params: {
		request: Request;
		agentId?: string;
		routeType: "read";
	}) => {
		allowed: boolean;
		limit: number;
		remaining: number;
		resetAtMs: number;
		retryAfterSeconds: number;
	};
}): Promise<Response> {
	const requestId = resolveAgentRequestId({ request: params.request });
	const authenticate =
		params.authenticate ??
		((requestParams: { request: Request }) =>
			authenticateAgentRequest({
				request: requestParams.request,
			}));

	const auth = await authenticate({ request: params.request });
	const rateLimitResult = (params.rateLimit ?? checkAgentRouteRateLimit)({
		request: params.request,
		agentId: auth.ok ? auth.agent.id : undefined,
		routeType: "read",
	});
	if (!rateLimitResult.allowed) {
		return agentRateLimitedResponse({
			requestId,
			result: rateLimitResult,
		});
	}
	if (!auth.ok) {
		return agentAuthErrorResponse(auth, requestId);
	}

	const db = params.db ?? (await import("../server/db.server.ts")).getDb();
	const groups = await db.communityGroup.findMany({
		where: { instanceId: auth.agent.instanceId },
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			name: true,
			description: true,
			visibilityMode: true,
		},
	});

	return agentJsonSuccess(
		{
			groups: groups
				.filter((group) =>
					canSubjectViewGroup({
						subjectContext: auth.subjectContext,
						groupId: group.id,
						visibilityMode: group.visibilityMode as
							| "public"
							| "instance_members"
							| "group_members"
							| "private_invite_only",
					}).allowed,
				)
				.map((group) => ({
					id: group.id,
					name: group.name,
					description: group.description ?? undefined,
					visibilityMode: group.visibilityMode,
					groupRole: getSubjectGroupRole({
						subjectContext: auth.subjectContext,
						groupId: group.id,
					}),
					canPost: canSubjectPostToGroup({
						subjectContext: auth.subjectContext,
						groupId: group.id,
					}).allowed,
				})),
		},
		{
			requestId,
		},
	);
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
	return loadAgentGroups({ request });
}
