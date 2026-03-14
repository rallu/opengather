# Agent Permissions And API Plan

## Scope

This document is the dedicated implementation plan for agent permissions and the agent-facing API in `opengather`.

It assumes:

- human privacy controls for instance, groups, and profiles already exist
- event support remains deferred
- agents are instance-local capabilities, not hub-owned capabilities

## Objectives

The agent system must satisfy four goals:

1. agents can authenticate without browser sessions
2. agents can only perform explicitly granted actions
3. agent actions obey the same privacy model as human actions
4. every agent action is attributable, inspectable, and revocable

## Current Baseline

The current codebase already provides:

- `Agent` in [prisma/schema.prisma](/Users/rallu/ohjelmointi/opengather/opengather/prisma/schema.prisma)
- human permission helpers in [app/server/permissions.server.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/server/permissions.server.ts)
- audit logging in [app/server/audit-log.service.server.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/server/audit-log.service.server.ts)
- async work support through `ProcessingJob`
- browser-oriented auth in [app/routes/api-auth.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/routes/api-auth.ts)

What does not exist yet:

- agent authentication middleware
- agent-specific permission resolution
- agent grants
- agent management UI
- agent API routes

## Architectural Rules

1. Agents are principals.
   They are not `system` and they do not inherit admin power by default.

2. Agents are local to an instance.
   The hub should not authorize or proxy agent permissions.

3. Scopes are additive and narrow.
   An agent receives only the scopes it needs for its job.

4. Resource access is two-part.
   The agent must have both:
   - permission to act on the resource type
   - access to the specific resource instance

5. Agent writes must always be labeled.
   Users and admins should be able to tell when an agent created, edited, or moderated something.

## Principal Model

Move from the current user-centric permission shape to a shared principal model.

Recommended base type:

```ts
type Subject =
  | { kind: "anonymous" }
  | { kind: "user"; userId: string }
  | { kind: "agent"; agentId: string };
```

Recommended resolved context:

```ts
type SubjectContext = {
  subject: Subject;
  instanceId: string;
  instanceRole: "guest" | "member" | "moderator" | "admin";
  groupRoles: Map<string, "guest" | "member" | "moderator" | "admin" | "owner">;
  scopes: Set<string>;
  isAuthenticated: boolean;
};
```

This keeps one permission engine for:

- browser users
- API users
- agents

## Schema Plan

### Extend `Agent`

Add:

- `createdByUserId`
- `lastUsedAt`
- `deletedAt`
- `displayLabel`

Purpose:

- ownership
- last activity reporting
- soft disable/deletion support
- better user-facing labels

### Add `AgentGrant`

Recommended fields:

- `id`
- `agentId`
- `resourceType`
- `resourceId`
- `scope`
- `createdAt`
- `updatedAt`

Supported `resourceType` values for V1:

- `instance`
- `group`
- `profile`

### Reuse Membership Tables Where Role Semantics Matter

Keep using:

- `InstanceMembership`
- `GroupMembership`

by allowing `principalType = "agent"` where role-based access is needed.

Reason:

- avoids parallel role models
- preserves consistency with group moderation and posting logic

Use `AgentGrant` for scoped capabilities and membership rows for role-bearing access.

## Permission Model

### Separation Of Concerns

Use two checks:

1. structural access
   Can this subject see or act within this resource at all?

2. capability scope
   Is this action type explicitly allowed for this agent?

The final answer is `allowed` only if both checks pass.

### V1 Scope Catalog

Instance scopes:

- `instance.feed.read`
- `instance.feed.post`
- `instance.feed.reply`
- `instance.notifications.create`

Group scopes:

- `group.read`
- `group.post`
- `group.reply`
- `group.members.read`

Profile scopes:

- `profile.read.public`
- `profile.read.instance_members`

Moderation scopes:

- `moderation.review`
- `moderation.hide_post`

Do not include in V1:

- server settings mutation
- membership approval mutation
- auth provider changes
- instance deletion

### Permission Resolver API

Extend [app/server/permissions.server.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/server/permissions.server.ts) with subject-aware entry points:

- `getSubjectContext`
- `canSubjectViewInstanceFeed`
- `canSubjectPostToInstanceFeed`
- `canSubjectViewGroup`
- `canSubjectPostToGroup`
- `canSubjectReplyInGroup`
- `canSubjectViewProfile`
- `canSubjectCreateNotification`
- `hasSubjectScope`

Rules:

- humans continue using existing role logic
- agents resolve roles from memberships plus grants
- anonymous access remains unchanged

## Authentication Model

### Agent Credential Format

Use bearer tokens over HTTP:

```text
Authorization: Bearer oga_xxx
```

Store only a hash in the database, similar to current `apiKeyHash`.

Recommended token lifecycle:

1. admin creates agent
2. server returns plaintext token once
3. server stores hash only
4. admin can rotate token
5. old token becomes invalid immediately

### Authentication Service

Add [app/server/agent-auth.server.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/server/agent-auth.server.ts):

- parse bearer token
- hash candidate token
- load enabled agent by hash
- reject disabled or deleted agents
- update `lastUsedAt`
- return `SubjectContext`

### Rate Limiting

Add a separate rate limit bucket for agent endpoints.

Reason:

- browser auth and agent API traffic have different patterns
- compromised agent keys need independent throttling

## API Design

### API Boundary

Create a distinct namespace for agent operations:

- `/api/agents/v1/...`

Do not mix this with:

- `/api/auth/*`
- browser form actions

That keeps session-auth flows and bearer-auth flows separate.

### V1 Endpoint Set

#### Health And Identity

- `GET /api/agents/v1/me`
  - returns agent identity, enabled state, and granted scopes

#### Read Endpoints

- `GET /api/agents/v1/feed`
  - readable feed items within granted scope
- `GET /api/agents/v1/groups`
  - groups visible to the agent
- `GET /api/agents/v1/groups/:groupId`
  - group metadata if allowed
- `GET /api/agents/v1/profiles/:userId`
  - profile summary if allowed

#### Write Endpoints

- `POST /api/agents/v1/feed/posts`
  - create instance feed post if allowed
- `POST /api/agents/v1/groups/:groupId/posts`
  - create group post if allowed
- `POST /api/agents/v1/posts/:postId/replies`
  - create reply if allowed
- `POST /api/agents/v1/notifications`
  - create notification if allowed

#### Moderation Endpoints

- `POST /api/agents/v1/moderation/posts/:postId/hide`
  - hide post if allowed

Keep V1 intentionally small. Do not expose full admin mutation APIs yet.

## Response And Error Model

Use predictable JSON errors:

```json
{
  "error": {
    "code": "forbidden",
    "message": "Agent lacks group.post scope for this group."
  }
}
```

Recommended error codes:

- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `rate_limited`
- `disabled_agent`

Include request IDs in responses for debugging.

## Service Layer

### New Services

- `agent-auth.server.ts`
- `agent.service.server.ts`
- `agent-permissions.server.ts`
- `agent-api.server.ts`

Suggested responsibilities:

- `agent.service.server.ts`
  - create agent
  - rotate secret
  - disable agent
  - list agents
  - set grants
- `agent-permissions.server.ts`
  - translate memberships + grants into effective capabilities
- `agent-api.server.ts`
  - shared endpoint helpers for auth, JSON responses, and request validation

### Reuse Existing Services

Reuse existing domain services wherever possible:

- `community.service.server.ts`
- `group.service.server.ts`
- `profile.service.server.ts`
- `notification.service.server.ts`

But route them through subject-aware permission checks first.

## Audit Model

Extend [app/server/audit-log.service.server.ts](/Users/rallu/ohjelmointi/opengather/opengather/app/server/audit-log.service.server.ts):

- add `actor.type = "agent"`

Agent audit payloads should include:

- `agentId`
- `agentDisplayName`
- `scope`
- `resourceType`
- `resourceId`
- request metadata

Audit actions to add:

- `agent.create`
- `agent.rotate_secret`
- `agent.disable`
- `agent.grant.create`
- `agent.grant.remove`
- `agent.post.create`
- `agent.reply.create`
- `agent.notification.create`
- `agent.moderation.hide_post`

## UI Plan

### Admin UI

Add an admin route:

- `/server-settings/agents`

Features for V1:

- list agents
- create agent
- disable agent
- rotate token
- assign scopes and resource grants
- inspect last used time

### User-Facing Labeling

When an agent acts in the community:

- posts show agent identity
- replies show agent identity
- moderation states show agent source where relevant

Users should not have to infer whether a bot acted.

## Delivery Milestones

### Milestone A: Subject Foundation

- add subject-aware permission context
- extend audit actor types
- add unit tests for mixed human/agent resolution

### Milestone B: Agent Storage And Auth

- extend `Agent`
- add `AgentGrant`
- add bearer-token authentication
- add rate limiting and request ID support

### Milestone C: Read APIs

- ship `/api/agents/v1/me`
- ship read-only feed, group, and profile endpoints
- verify private groups stay private

### Milestone D: Write APIs

- ship post and reply creation
- ship notification creation
- label agent-authored content in UI

### Milestone E: Moderation APIs

- ship limited hide-post moderation
- audit all moderation actions
- add admin visibility for agent actions

## Testing Plan

### Unit Tests

- token authentication and hash matching
- disabled-agent rejection
- scope evaluation
- grant resolution
- audit actor formatting for agent actions

### Integration Tests

- agent with `group.read` can read only granted private group
- agent without `group.post` cannot post
- agent with revoked token immediately loses access
- agent cannot read profile data beyond granted visibility level

### Route And Endpoint Verification

Visible routes added by this work must be smoke-tested:

- `/server-settings/agents`

API verification should cover:

- `/api/agents/v1/me`
- at least one read endpoint
- at least one write endpoint
- one forbidden path

## Recommended First Build

Start with:

1. `actor.type = "agent"` support in audit logs
2. `AgentGrant` schema
3. `agent-auth.server.ts`
4. `GET /api/agents/v1/me`
5. subject-aware permission resolver

Reason:

- it gives a secure skeleton first
- it proves authentication and authorization before content mutation
- it avoids shipping write-capable agents before auditability exists

## Open Decisions

1. Whether agent resource grants should support wildcard instance-wide group access in V1.
2. Whether agent-created posts should use `authorType = "agent"` or continue using a principal abstraction above the post table first.
3. Whether agent tokens should have optional expirations in V1 or only manual rotation.
4. Whether profile reads should be allowed at all for agents in the first release.
