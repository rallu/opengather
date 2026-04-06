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

export async function loadAgentMe(params: {
	request: Request;
	authenticate?: (params: { request: Request }) => Promise<AgentAuthResult>;
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

	return agentJsonSuccess(
		{
			agent: {
				id: auth.agent.id,
				instanceId: auth.agent.instanceId,
				createdByUserId: auth.agent.createdByUserId,
				displayName: auth.agent.displayName,
				displayLabel: auth.agent.displayLabel,
				description: auth.agent.description,
				role: auth.agent.role,
				isEnabled: auth.agent.isEnabled,
				lastUsedAt: auth.agent.lastUsedAt,
			},
			subject: auth.subjectContext.subject,
			instanceRole: auth.instanceRole,
			groupRoles: Array.from(auth.groupRoles.entries()).map(
				([groupId, role]: [string, string]) => ({
					groupId,
					role,
				}),
			),
			scopes: Array.from(auth.subjectContext.scopes).sort(),
			grants: auth.agent.grants.map((grant: {
				id: string;
				resourceType: string;
				resourceId: string;
				scope: string;
			}) => ({
				id: grant.id,
				resourceType: grant.resourceType,
				resourceId: grant.resourceId,
				scope: grant.scope,
			})),
		},
		{
			requestId,
		},
	);
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
	return loadAgentMe({ request });
}
