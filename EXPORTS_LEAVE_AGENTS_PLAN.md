# Exports, Leave Flows, And Agent Permissions Plan

## Scope

This plan covers the next privacy and ownership work for `opengather` after the current group/profile privacy milestones:

- user data exports
- leave flows
- agent permission model

This plan intentionally excludes event-specific privacy and event exports for now.

## Why This Work Exists

The OpenGather manifesto creates three hard requirements:

1. users should own their data
2. leaving should be possible
3. agents must operate through permissioned and inspectable boundaries

The current codebase already has the core primitives needed to build this correctly:

- instance and group memberships
- profile visibility controls
- centralized human permission checks
- audit logs
- processing jobs
- an `Agent` table

What is missing is the next layer:

- exportable ownership state
- explicit leave and deletion workflows
- a first-class subject model for agents

## Guiding Rules

1. Privacy stays instance-local.
   The hub must not become the source of truth for group privacy, profile visibility, or private content access.

2. Export what the user owns and what the user needs to leave.
   Export should include authored data, memberships, preferences, and activity metadata relevant to that user.

3. Leaving must be reversible where possible, destructive only when explicit.
   Leaving a group and leaving an instance are different operations from deleting an account.

4. Agents are principals, not bypasses.
   Agent actions must go through the same permission layer as people, with their own identity and audit trail.

5. Secondary systems must obey privacy too.
   Notifications, embeddings, processing jobs, logs, and future search indexes must not leak private content.

## Current Baseline

The current schema and services already provide:

- `InstanceMembership`
- `GroupMembership`
- `ProfilePreference`
- `Agent`
- `ProcessingJob`
- `AuditLog`
- `permissions.server.ts`

That means the recommended direction is to extend the existing model, not replace it.

## Workstream 1: User Data Exports

### Goal

Let a signed-in user request and download a machine-readable export of the data they own or need in order to leave the instance.

### Export Scope For V1

Include:

- user account basics
- linked hub identity metadata, if present
- profile visibility preference
- notification preferences
- notifications addressed to the user
- instance membership state
- group memberships and group roles
- authored posts and replies
- authored moderation actions, if any
- attachments authored by the user or attached to authored posts
- audit log entries where the actor is the user

Do not include in V1:

- other users' private content
- raw session tokens
- provider refresh tokens
- full internal error logs
- system secrets

### Export Format

Use a versioned JSON export plus attachment manifest.

Recommended archive shape:

```text
opengather-export/
  manifest.json
  user.json
  memberships.json
  profile.json
  notifications.json
  posts.json
  moderation.json
  audit-log.json
  attachments/
    files.json
```

Rules:

- all timestamps in ISO 8601
- stable identifiers preserved
- include export schema version in `manifest.json`
- include instance metadata such as `server_name` and export generation time

### Architecture

Use asynchronous export generation backed by `ProcessingJob`.

Flow:

1. user requests export from settings
2. app creates an export request record and a processing job
3. worker generates export snapshot
4. app stores artifact metadata and offers a time-limited download
5. audit log records request and download

### Recommended Schema Additions

- `DataExportRequest`
  - `id`
  - `userId`
  - `status`
  - `format`
  - `requestedAt`
  - `completedAt`
  - `expiresAt`
  - `errorMessage`
- `DataExportArtifact`
  - `id`
  - `exportRequestId`
  - `storageType`
  - `storagePath`
  - `sha256`
  - `sizeBytes`
  - `createdAt`

### Service Layer

Add:

- `export.service.server.ts`
  - `requestUserExport`
  - `listUserExports`
  - `buildUserExportPayload`
  - `completeUserExport`
  - `getDownloadableExport`
- `jobs.service.server.ts`
  - export job processor branch

### Routes

Add:

- `/settings/data`
  - request export
  - list previous exports
  - show export readiness
- `/exports/:exportId/download`
  - authenticated download route

### Privacy Rules

- only the exporting user can request or download their export
- export generation must filter group content through ownership, not broad readability
- private group names may be included if they are part of the user's own memberships
- cross-user content should only appear where structurally required, and then only as identifiers or minimal context

### Acceptance Criteria

- user can request an export without admin help
- export job survives async processing
- download is authenticated and time-limited
- audit log records `user.export.request` and `user.export.download`

## Workstream 2: Leave Flows

### Goal

Allow users to leave a group, leave an instance, and delete their account without corrupting community data or violating privacy expectations.

### Distinct Leave Operations

#### 1. Leave Group

The user exits one group but keeps their account and instance membership.

Expected behavior:

- remove or deactivate the user's `GroupMembership`
- revoke access to private group content immediately
- stop future group notifications
- preserve authored posts according to group retention policy
- write audit log entry

#### 2. Leave Instance

The user exits the whole instance but does not necessarily delete their account immediately.

Expected behavior:

- remove or deactivate `InstanceMembership`
- remove or deactivate all `GroupMembership` rows in that instance
- revoke access to instance-private content immediately
- stop notifications
- keep export available before final confirmation
- write audit log entry

#### 3. Delete Account

The user removes their local account and local preferences.

Expected behavior:

- sign out all sessions
- remove or anonymize personally identifying local profile fields
- remove notification preferences and profile preferences
- decide content retention behavior explicitly
- write audit log entry

### Recommended Content Policy

Start with a conservative policy:

- leaving a group or instance does not delete authored posts
- deleting an account does not hard-delete posts by default
- deleted-account authorship becomes a tombstoned local identity such as `Deleted user`

Reason:

- communities need continuity
- hard deletion is riskier and harder to undo
- portability works better when export happens before deletion

If hard-delete is added later, it should be an explicit destructive option with separate processing.

### Recommended Schema Additions

- `UserDepartureRequest`
  - `id`
  - `userId`
  - `scopeType` (`group`, `instance`, `account`)
  - `scopeId`
  - `status`
  - `requestedAt`
  - `completedAt`
  - `payload`

Optional later:

- soft-delete columns on `User`
  - `deletedAt`
  - `displayNameOverride`

### Service Layer

Add:

- `departure.service.server.ts`
  - `requestGroupLeave`
  - `requestInstanceLeave`
  - `requestAccountDeletion`
  - `completeDeparture`
  - `applyDeletedUserIdentity`

### Route Plan

Add or extend:

- `/settings/data`
  - export and account deletion entry point
- `/groups/:groupId`
  - leave group action
- `/settings`
  - link to data and leaving section

### Leave Flow UX

Require a two-step flow:

1. explain consequences and recommend export first
2. explicit confirmation action

For account deletion:

- show whether export exists
- warn about retained community posts
- confirm irreversible local account removal

### Acceptance Criteria

- leaving a private group removes access immediately
- leaving an instance removes access to instance and private groups immediately
- account deletion invalidates sessions
- all leave operations are audited

## Workstream 3: Agent Permission Model

### Goal

Make agents first-class principals that can act inside an instance without bypassing privacy controls.

Detailed design for this workstream lives in [AGENT_PERMISSIONS_API_PLAN.md](/Users/rallu/ohjelmointi/opengather/opengather/AGENT_PERMISSIONS_API_PLAN.md).

### Core Design

Agents should not be treated as `system`.
Agents should have:

- an identity
- explicit scopes
- optional group grants
- auditable actions
- visible labeling in UI when they act

### Subject Model

Move from a human-only viewer model toward a shared subject model:

- `anonymous`
- `user`
- `agent`

Recommended subject type:

```ts
type Subject =
  | { kind: "anonymous" }
  | { kind: "user"; userId: string }
  | { kind: "agent"; agentId: string };
```

Then resolve:

- instance role
- group role
- agent grants
- effective allowed actions

### Recommended Schema Additions

- extend `Agent`
  - `lastUsedAt`
  - `createdByUserId`
- `AgentGrant`
  - `id`
  - `agentId`
  - `resourceType` (`instance`, `group`, `profile`)
  - `resourceId`
  - `scope`
  - `createdAt`
  - `updatedAt`

Keep `InstanceMembership` and `GroupMembership` usable for agents by allowing `principalType = "agent"` where role semantics are needed.

### Recommended Scope Set For V1

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

Moderation scopes:

- `moderation.review`
- `moderation.hide_post`

Profile scopes:

- `profile.read_public`
- `profile.read_instance_members`

Do not add admin/config mutation scopes in V1.

### Permission Engine Changes

Extend `permissions.server.ts` so it can answer permissions for both users and agents.

Recommended additions:

- `getSubjectContext`
- `canSubjectViewInstanceFeed`
- `canSubjectViewGroup`
- `canSubjectPostToGroup`
- `canSubjectReadProfile`
- `canSubjectCreateNotification`

Rule:

Agents only get access if both conditions are true:

1. the target resource would be visible to the equivalent agent role or grant
2. the agent has the explicit scope required for the action

### Authentication And API Model

Add agent API authentication with hashed bearer tokens.

Recommended server pieces:

- `agent-auth.server.ts`
  - authenticate API key
  - load enabled agent
  - reject disabled agents
- `agent.service.server.ts`
  - create agent
  - rotate secret
  - list grants
  - set grants

### Audit Model

Extend audit actors beyond `user` and `system`.

Recommended change:

- add `actor.type = "agent"`

Every agent write action should record:

- agent id
- agent display name
- scope used
- target resource
- request metadata

### UI And Visibility Rules

When an agent posts, replies, moderates, or notifies:

- the user-facing UI should label the actor as an agent
- admin views should show the exact agent identity
- audit logs should expose the action source

### Acceptance Criteria

- an agent cannot read a private group without grant or membership
- an agent cannot post without explicit scope
- agent actions are auditable as agent actions, not system actions
- disabling an agent blocks future API use immediately

## Cross-Cutting Hardening

These items apply to all three workstreams.

### Notifications

- do not queue notifications for users who have already left the scope
- prevent stale notification targets from exposing private URLs after departure

### Embeddings And Search

- embeddings for private content must remain permission-scoped
- export generation must not use broad search tables that bypass privacy filters
- future search indexes must partition by instance and group visibility

### Audit Logs

- audit all export requests, downloads, leave operations, and agent grant changes
- avoid logging raw private content bodies where not necessary

### Caching

- do not cache authenticated export downloads publicly
- invalidate cached private group/profile views on departure or role changes

## Delivery Order

### Phase 1

- add export request schema
- add export service and processing flow
- add `/settings/data`
- ship self-service user export

### Phase 2

- add group leave flow
- add instance leave flow
- add account deletion flow
- wire audit logging and session invalidation

### Phase 3

- extend permission engine to shared subject model
- add agent auth and grants
- add agent-scoped APIs for safe actions only

### Phase 4

- review notifications, embeddings, and logs for privacy leaks
- add export and departure regression coverage
- add admin tooling for agent management

## First Implementation Sprint

The strongest next slice is:

1. create `/settings/data`
2. implement `DataExportRequest`
3. build JSON export generation through `ProcessingJob`
4. add export request and download audit logging

Why this first:

- it satisfies the manifesto directly
- it does not force irreversible account-deletion choices yet
- it creates the foundation needed before leave flows

## Test Plan

### Unit Tests

- export payload assembly
- leave-flow state transitions
- agent permission resolution
- audit actor serialization

### Integration Tests

- export request to completed artifact
- group leave revokes private content access
- instance leave revokes feed and group access
- disabled agent tokens fail

### Route Smoke Tests

Per local agent rules, every visible route touched by this work must be smoke-tested at minimum.

Expected route coverage as this plan ships:

- `/settings`
- `/settings/data`
- `/groups/:groupId`
- any new agent/admin routes added later

## Open Decisions To Resolve During Implementation

1. Where export artifacts are stored in development and production.
2. Whether account deletion keeps a tombstoned local user row or copies author labels onto posts first.
3. Whether agent membership should be represented only by grants, or by both grants and membership rows depending on resource type.
4. Whether admins can trigger exports for other users in a later phase.
