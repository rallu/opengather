import type { SubjectResourceScopes } from "./permissions.server/shared.ts";

export type AgentGrantLike = {
	resourceType: string;
	resourceId: string;
	scope: string;
};

export function createAgentGrantIndex(params: {
	grants: Iterable<AgentGrantLike>;
}): SubjectResourceScopes {
	const resourceMaps = new Map<string, Map<string, Set<string>>>();

	for (const grant of params.grants) {
		const resourceType = grant.resourceType.trim();
		const resourceId = grant.resourceId.trim();
		const scope = grant.scope.trim();
		if (!resourceType || !resourceId || !scope) {
			continue;
		}

		const byResourceId =
			resourceMaps.get(resourceType) ?? new Map<string, Set<string>>();
		const scopes = byResourceId.get(resourceId) ?? new Set<string>();
		scopes.add(scope);
		byResourceId.set(resourceId, scopes);
		resourceMaps.set(resourceType, byResourceId);
	}

	return resourceMaps;
}

export function hasAgentGrantScope(params: {
	resourceScopes?: SubjectResourceScopes;
	resourceType: string;
	resourceId: string;
	scope: string;
}): boolean {
	const scopesForResource = params.resourceScopes
		?.get(params.resourceType)
		?.get(params.resourceId);
	return scopesForResource?.has(params.scope) ?? false;
}
