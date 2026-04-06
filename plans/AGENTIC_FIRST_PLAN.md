# Agentic First Plan

## Purpose

This document is the focused implementation plan for making `opengather` genuinely agentic first.

It is not a generic AI feature list. It is a staged plan for giving each OpenGather instance safe, local, inspectable agents that operate under explicit permissions.

## Product Goal

An OpenGather admin should be able to create a local agent, grant it narrow capabilities, and let it act inside the community through explicit APIs without bypassing the same privacy and moderation boundaries that apply to people.

Users should be able to tell when an agent acted.

Admins should be able to audit, disable, and rotate that agent at any time.

The first concrete success stage is narrower:

- OpenAI Codex can authenticate to an OpenGather instance
- Codex can discover its own identity and grants
- Codex can read allowed community data
- Codex can perform at least one safe write action through the public agent API
- the resulting action is visibly labeled and auditable as an agent action

## Why This Comes After Exports

The manifesto makes two separate promises:

- users are not trapped
- communities can run their own agents

The first promise is the trust floor.
The second promise is the differentiator.

That means agentic-first work should begin after self-service exports are on track, but it should be the next major platform capability after that.

## Design Principles

1. Agents are principals, not system backdoors.
2. Agents are local to an instance.
3. Agents get explicit scopes, never broad implied power.
4. Resource visibility and capability scope are separate checks.
5. Agent actions must be labeled and auditable.
6. V1 should start narrow and safe, not broad and magical.

## Current Baseline

The codebase already provides:

- `Agent` storage with hashed API key support
- human membership and role models
- permission helpers for instance, group, event, and profile access
- audit logs
- notifications
- post and reply flows

The codebase does not yet provide:

- subject-aware permissions
- agent authentication middleware
- agent grants
- agent admin UI
- agent API routes
- user-facing labeling for agent-authored actions

## V1 Outcome

Ship a minimal but real agent platform that supports:

1. creating an agent
2. authenticating via bearer token
3. assigning narrow scopes and resource grants
4. reading allowed resources
5. creating limited community actions
6. auditing and disabling the agent

The key standard for this V1 is not "AI features exist".
It is "an external agent client can reliably use OpenGather as a permissioned system".

## Non-Goals For V1

Do not include in V1:

- full admin mutation APIs
- instance deletion or config mutation by agents
- unrestricted profile scraping
- free-form tool execution inside the server
- autonomous background planning systems
- Hub-controlled agent authorization

## First Success Stage

The first stage should be judged by whether a real external agent client can use the system end to end.

For this project, the reference client is OpenAI Codex.

### Stage 1 Scenario

1. an admin creates or rotates an agent token
2. Codex receives the base URL and bearer token
3. Codex calls `GET /api/agents/v1/me`
4. Codex calls at least one read endpoint to inspect accessible groups or feed state
5. Codex performs one safe write operation such as posting to the instance feed or a granted group
6. a human user can see that the resulting action came from an agent
7. an admin can verify the same action in audit logs

### Stage 1 Definition Of Done

- the API is callable by a generic HTTP client
- auth does not depend on browser sessions or CSRF flows
- error responses are stable and machine-readable
- the minimum required endpoints are documented with request and response examples
- the flow is simple enough that Codex can execute it without custom glue code inside OpenGather

This matters because "agentic first" is not real until an external agent can actually connect and do useful work.

## Core Model

### Subject Model

Move from user-centric viewer context to a shared subject model:

```ts
type Subject =
  | { kind: "anonymous" }
  | { kind: "user"; userId: string }
  | { kind: "agent"; agentId: string };
```

Resolved context should include:

- subject
- instance role
- group roles
- granted scopes
- authentication state

This should become the single permission foundation for browser users, local API users, and agents.

## Schema Plan

### Extend `Agent`

Add:

- `createdByUserId`
- `displayLabel`
- `lastUsedAt`
- `deletedAt`

Purpose:

- ownership and attribution
- friendlier UI labeling
- revocation and soft deletion
- activity visibility

### Add `AgentGrant`

Fields:

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

### Membership Reuse

Keep using:

- `InstanceMembership`
- `GroupMembership`

with `principalType = "agent"` where role semantics are needed.

Reason:

- one role model is easier to reason about
- group posting and moderation already assume role semantics

## Permission Model

Every agent action should pass two checks:

1. structural access
2. explicit capability scope

Example:

- an agent may have `group.post`
- but still cannot post to a private group unless it also has access to that group

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

- `profile.read.public`
- `profile.read.instance_members`

## Authentication Model

Use bearer tokens:

```text
Authorization: Bearer oga_xxx
```

Rules:

- return plaintext token only once at creation or rotation time
- store only a hash
- reject disabled and deleted agents
- update `lastUsedAt` on successful auth
- give agent endpoints their own rate limit bucket

For the first usable milestone, the token flow must be easy for an external client to adopt immediately:

- one bearer token
- one base URL
- standard JSON requests
- no hidden cookie or browser dependency

## API Boundary

Use a separate namespace:

- `/api/agents/v1/...`

Do not mix agent auth with:

- browser session routes
- existing form action handlers

The API should be designed for external clients first, not for internal route reuse convenience.

That means:

- predictable JSON response envelopes where helpful
- machine-readable error codes
- stable field naming
- pagination or cursors where list growth can become unbounded
- request and response examples in docs
- no HTML responses from agent endpoints

## V1 Endpoint Set

### Identity

- `GET /api/agents/v1/me`

### Read

- `GET /api/agents/v1/feed`
- `GET /api/agents/v1/groups`
- `GET /api/agents/v1/groups/:groupId`

### Write

- `POST /api/agents/v1/feed/posts`
- `POST /api/agents/v1/groups/:groupId/posts`
- `POST /api/agents/v1/posts/:postId/replies`
- `POST /api/agents/v1/notifications`

### Moderation

- `POST /api/agents/v1/moderation/posts/:postId/hide`

Keep profile read out of the first shipping cut unless it becomes necessary for a concrete agent use case.

### Minimum Endpoint Slice For First Success

Do not try to ship the whole endpoint set before proving the external-client loop.

The minimum first-success slice should be:

- `GET /api/agents/v1/me`
- `GET /api/agents/v1/groups`
- one of:
  - `POST /api/agents/v1/feed/posts`
  - `POST /api/agents/v1/groups/:groupId/posts`

This is enough for Codex to:

- authenticate
- inspect accessible scope
- choose a target
- perform a meaningful action

## Admin UI

Add:

- `/server-settings/agents`

V1 features:

- list agents
- create agent
- show last used time
- disable agent
- rotate token
- assign scopes and grants

Do not block the first external-client milestone on a polished UI.

For the first success stage, an acceptable bootstrap path is:

- a minimal admin route
- or an admin-only CLI/script
- or a temporary server-settings form

as long as it can safely create, rotate, and disable real agent credentials without direct database edits.

The full `/server-settings/agents` UI should still ship in V1, but it is not the first dependency.

## User-Facing Visibility

When an agent acts:

- posts should show the agent identity
- replies should show the agent identity
- moderation UI should show when an agent hid content
- audit logs should show `actorType = agent`

Users should never need to guess whether a human or agent performed an action.

## Recommended Delivery Order

### Milestone 1: Codex-Connectable Slice

- [x] Extend `Agent` with the V1 lifecycle and attribution fields.
- [x] Add the `AgentGrant` model and generate/update Prisma client output.
- [ ] Add `actorType = agent` support to audit logging and audit-log display.
- [x] Introduce shared `Subject` and `SubjectContext` types.
- [x] Extend permission resolution to support agent subjects without changing human behavior.
- [x] Add `app/server/agent-auth.server.ts` for bearer-token authentication.
- [x] Implement `GET /api/agents/v1/me`.
- [x] Implement `GET /api/agents/v1/groups`.
- [x] Implement one safe write endpoint for posting.
- [x] Provide a minimal admin bootstrap path for creating, rotating, and disabling agent credentials.
- [x] Document the curl-level external-client flow for Codex and other HTTP clients.

Reason:

- this is the first moment the system becomes truly agent-usable
- it proves the entire outside-in loop, not just internal primitives
- it lets Codex interact with a real OpenGather instance immediately

### Milestone 2: Subject Foundation Hardening

- [x] Verify that existing human permission behavior remains unchanged.
- [x] Add tests for mixed human and agent permission checks.
- [ ] Close permission edge cases discovered during the first external-client loop.

Reason:

- the shared model still needs to be trustworthy before the API surface grows

### Milestone 3: API Contract Hardening

- [x] Add request IDs to agent-route responses and logs.
- [x] Add independent rate limiting for agent routes.
- [x] Standardize JSON error codes and response envelopes.
- [ ] Add pagination or cursor rules where list growth can become unbounded.
- [x] Publish endpoint examples and operational docs.
- [x] Verify private groups remain private under agent access.

Reason:

- external agents need an API contract they can rely on, not just endpoints that happen to work once

### Milestone 4: Safe Write APIs Expansion

- [x] Implement instance-feed post creation if it was not the first write endpoint.
- [ ] Implement group post creation if it was not the first write endpoint.
- [x] Implement reply creation.
- [x] Implement notification creation.
- [x] Label agent-authored content in the user-facing UI.

Reason:

- after the first Codex-posting slice works, broaden the useful action set carefully

### Milestone 5: Limited Moderation APIs

- [x] Implement hide-post moderation only.
- [x] Audit every moderation API call as an agent action.
- [ ] Show moderation origin in admin-facing views.

Reason:

- moderation is valuable, but higher risk than basic posting

### Milestone 6: Admin Management UI

- [x] Ship `/server-settings/agents`.
- [x] Add a visible entry point from `/server-settings` to `/server-settings/agents`.
- [x] List agents, grants, role, and last-used time on the page.
- [x] Create an agent from the UI and show the plaintext token exactly once.
- [x] Let an admin copy the base URL plus bearer token from the create result so an external client can connect immediately.
- [x] Add disable from the UI.
- [x] Add rotate token from the UI and show the replacement token exactly once.
- [ ] Add grant editing from the UI.
- [ ] Support create, disable, rotate, and grant management from the UI.
- [ ] Expose last-used data and audit-log links in the UI.

Reason:

- by this point the backend model and external API are stable enough for UI wiring

## Service Layer

Add:

- [x] `app/server/agent-auth.server.ts`
- [x] `app/server/agent.service.server.ts`
- [x] `app/server/agent-permissions.server.ts`
- [x] `app/server/agent-api.server.ts`

Responsibilities:

- `agent-auth.server.ts`
  - [x] authenticate bearer token
  - [x] return subject context
- `agent.service.server.ts`
  - [x] create agent
  - [x] rotate token
  - [x] disable agent
  - [x] list agents
  - [x] set grants
- `agent-permissions.server.ts`
  - [x] resolve scopes plus structural access
- `agent-api.server.ts`
  - [ ] provide shared JSON responses, errors, and request validation

Reuse existing domain services for actual post, group, notification, and moderation work where possible.

Add lightweight API docs for external clients:

- [x] Add `app/server/agent-api-docs.server.ts` or markdown under `plans/` or `docs/`.

The first client should be able to succeed with plain HTTP examples.

## Testing Plan

### Unit Tests

- [x] Add unit tests for subject-context resolution.
- [x] Add unit tests for scope evaluation.
- [x] Add unit tests for grant resolution.
- [x] Add unit tests for token hash matching.
- [x] Add unit tests for disabled-agent rejection.
- [x] Add unit tests for audit-payload formatting for agent actions.

### Integration Tests

- [x] Add an integration test for a Codex-style client flow that authenticates, reads groups, and creates one post.
- [x] Add an integration test proving an agent can read only granted private groups.
- [x] Add an integration test proving an agent without `group.post` cannot post.
- [x] Add an integration test proving a revoked token loses access immediately.
- [x] Add an integration test proving agent-authored content is visibly labeled.

### Route And API Verification

Smoke-test:

- [ ] Smoke-test `GET /api/agents/v1/me`.
- [ ] Smoke-test `GET /api/agents/v1/groups`.
- [ ] Smoke-test one allowed write route.
- [ ] Smoke-test one forbidden route.

Add one scripted verification path that uses plain HTTP requests, not in-process helpers.

Reason:

- the first success condition is external connectivity, so at least one test path should behave like a real external client

### Operational Verification

- [ ] Verify a real Codex session can execute the documented stage-1 scenario against a running local instance.
- [ ] Verify the created content is visible in the UI with agent labeling.
- [ ] Verify the same action appears in audit logs with `actorType = agent`.
- [ ] Verify disabling the agent blocks subsequent external API calls.

## Suggested First Concrete Use Cases

Use V1 to support a few sharp workflows:

- community summary bot that posts daily summaries
- moderation helper that flags or hides content with explicit scope
- notification helper for reminders or announcements

Do not optimize V1 around a general autonomous assistant.

## Open Decisions To Revisit

These should be left explicit in review:

1. whether wildcard group grants are allowed in V1
2. whether agents can read profile data in the first release
3. whether agent tokens support expiration in V1
4. whether `authorType = agent` is used directly in content records or hidden behind a broader principal abstraction

## Acceptance Criteria

- an admin can create and disable a local agent
- an agent authenticates without browser sessions
- OpenAI Codex can complete the stage-1 scenario against a running instance using only the published HTTP contract
- an agent cannot act outside its granted scopes
- an agent cannot see private resources without structural access
- all agent write actions are auditable as agent actions
- users can see when agent-authored actions happened
