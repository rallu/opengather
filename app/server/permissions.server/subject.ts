import { hasAgentGrantScope } from "../agent-permissions.server.ts";
import {
	canPostToGroup,
	canReplyToGroup,
	canViewGroup,
} from "./group.ts";
import {
	canPostToInstanceFeed,
	canReplyToPost,
	canViewInstanceFeed,
} from "./instance.ts";
import { canViewProfile } from "./profile.ts";
import type {
	GroupRole,
	GroupVisibilityMode,
	InstanceVisibilityMode,
	ProfileVisibilityMode,
	SubjectContext,
	ViewerRole,
} from "./shared.ts";

type SubjectScopePermissionResult<TReason extends string> =
	| {
			allowed: true;
			reason: "allowed";
	  }
	| {
			allowed: false;
			reason: TReason | "missing_scope";
	  };

export function createAnonymousSubjectContext(): SubjectContext {
	return {
		subject: { kind: "anonymous" },
		isAuthenticated: false,
		instanceRole: "guest",
		groupRoles: new Map(),
		scopes: new Set(),
		resourceScopes: new Map(),
	};
}

export function createUserSubjectContext(params: {
	userId: string;
	instanceRole: ViewerRole;
	groupRoles?: Iterable<readonly [string, GroupRole]>;
}): SubjectContext {
	return {
		subject: { kind: "user", userId: params.userId },
		isAuthenticated: true,
		instanceRole: params.instanceRole,
		groupRoles: new Map(params.groupRoles ?? []),
		scopes: new Set(),
		resourceScopes: new Map(),
	};
}

export function createAgentSubjectContext(params: {
	agentId: string;
	instanceRole: ViewerRole;
	groupRoles?: Iterable<readonly [string, GroupRole]>;
	scopes?: Iterable<string>;
	resourceScopes?: SubjectContext["resourceScopes"];
}): SubjectContext {
	return {
		subject: { kind: "agent", agentId: params.agentId },
		isAuthenticated: true,
		instanceRole: params.instanceRole,
		groupRoles: new Map(params.groupRoles ?? []),
		scopes: new Set(params.scopes ?? []),
		resourceScopes: params.resourceScopes ?? new Map(),
	};
}

export function getSubjectGroupRole(params: {
	subjectContext: SubjectContext;
	groupId: string;
}): GroupRole {
	return params.subjectContext.groupRoles.get(params.groupId) ?? "guest";
}

export function hasSubjectScope(params: {
	subjectContext: SubjectContext;
	scope: string;
	resourceType?: string;
	resourceId?: string;
}): boolean {
	if (params.subjectContext.subject.kind !== "agent") {
		return true;
	}

	if (
		params.resourceType &&
		params.resourceId &&
		(params.subjectContext.resourceScopes?.size ?? 0) > 0
	) {
		return hasAgentGrantScope({
			resourceScopes: params.subjectContext.resourceScopes,
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			scope: params.scope,
		});
	}

	return params.subjectContext.scopes.has(params.scope);
}

export function canSubjectViewInstanceFeed(params: {
	subjectContext: SubjectContext;
	visibilityMode: InstanceVisibilityMode;
}): SubjectScopePermissionResult<
	"requires_authentication" | "membership_required" | "pending_membership"
> {
	const access = canViewInstanceFeed({
		visibilityMode: params.visibilityMode,
		viewerRole: params.subjectContext.instanceRole,
		isAuthenticated: params.subjectContext.isAuthenticated,
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "instance.feed.read",
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectPostToInstanceFeed(params: {
	subjectContext: SubjectContext;
}): SubjectScopePermissionResult<"membership_required"> {
	const access = canPostToInstanceFeed({
		viewerRole: params.subjectContext.instanceRole,
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "instance.feed.post",
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectReplyToPost(params: {
	subjectContext: SubjectContext;
}): SubjectScopePermissionResult<"membership_required"> {
	const access = canReplyToPost({
		viewerRole: params.subjectContext.instanceRole,
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "instance.feed.reply",
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectViewGroup(params: {
	subjectContext: SubjectContext;
	groupId: string;
	visibilityMode: GroupVisibilityMode;
}): SubjectScopePermissionResult<
	| "requires_authentication"
	| "instance_membership_required"
	| "group_membership_required"
	| "invite_required"
> {
	const access = canViewGroup({
		isAuthenticated: params.subjectContext.isAuthenticated,
		instanceViewerRole: params.subjectContext.instanceRole,
		groupRole: getSubjectGroupRole({
			subjectContext: params.subjectContext,
			groupId: params.groupId,
		}),
		visibilityMode: params.visibilityMode,
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "group.read",
		resourceType: "group",
		resourceId: params.groupId,
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectPostToGroup(params: {
	subjectContext: SubjectContext;
	groupId: string;
}): SubjectScopePermissionResult<"group_membership_required"> {
	const access = canPostToGroup({
		groupRole: getSubjectGroupRole({
			subjectContext: params.subjectContext,
			groupId: params.groupId,
		}),
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "group.post",
		resourceType: "group",
		resourceId: params.groupId,
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectReplyToGroup(params: {
	subjectContext: SubjectContext;
	groupId: string;
}): SubjectScopePermissionResult<"group_membership_required"> {
	const access = canReplyToGroup({
		groupRole: getSubjectGroupRole({
			subjectContext: params.subjectContext,
			groupId: params.groupId,
		}),
	});

	if (!access.allowed) {
		return access;
	}

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: "group.reply",
		resourceType: "group",
		resourceId: params.groupId,
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}

export function canSubjectViewProfile(params: {
	subjectContext: SubjectContext;
	targetUserId: string;
	visibilityMode: ProfileVisibilityMode;
}): SubjectScopePermissionResult<
	"requires_authentication" | "instance_membership_required" | "private_profile"
> {
	const access = canViewProfile({
		isAuthenticated: params.subjectContext.isAuthenticated,
		isSelf:
			params.subjectContext.subject.kind === "user" &&
			params.subjectContext.subject.userId === params.targetUserId,
		instanceViewerRole: params.subjectContext.instanceRole,
		visibilityMode: params.visibilityMode,
	});

	if (!access.allowed) {
		return access;
	}

	if (params.subjectContext.subject.kind !== "agent") {
		return access;
	}

	const requiredScope =
		params.visibilityMode === "instance_members"
			? "profile.read.instance_members"
			: "profile.read.public";

	return hasSubjectScope({
		subjectContext: params.subjectContext,
		scope: requiredScope,
		resourceType: "profile",
		resourceId: params.targetUserId,
	})
		? access
		: { allowed: false, reason: "missing_scope" };
}
