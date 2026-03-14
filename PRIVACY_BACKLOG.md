# OpenGather Privacy Backlog

This backlog is for `opengather` only. It defines the next implementation steps for moving from instance-wide visibility to container-aware privacy for groups, events, profiles, and their content.

## Goals

- support public and private grouping entities inside one instance
- ensure content inherits privacy from its container by default
- prevent unauthorized reads at the data and loader level, not only in the UI
- replace scattered access checks with one reusable permission layer

## Non-Goals For This Phase

- no generic ACL engine
- no per-post custom privacy controls
- no cross-instance federation rules
- no fully generalized "pages/groups/events/profiles all share one table" abstraction

## Product Model

### Subjects

- anonymous visitor
- authenticated user
- instance member
- group member
- group moderator
- group admin
- event participant
- instance admin

### Resources

- instance
- profile
- group
- event
- post
- attachment

### Actions

- view
- join
- request_access
- post
- reply
- participate
- moderate
- manage

## Privacy Rules

### Core Rules

- instance visibility controls access to the instance-level feed only
- group visibility controls access to group pages and group posts
- event visibility controls access to event pages and event participation data
- posts inside a group inherit the group privacy by default
- events inside a group inherit the group privacy by default unless explicitly overridden
- attachments inherit visibility from their parent post or event

### Visibility Modes

#### Group Visibility

- `public`
- `instance_members`
- `group_members`
- `private_invite_only`

#### Event Visibility

- `inherit`
- `public`
- `instance_members`
- `group_members`
- `participants`
- `private_invite_only`

#### Profile Visibility

- `public`
- `instance_members`
- `private`

## Milestones

## Milestone 1: Permission Foundation

Status: Completed on 2026-03-14

### Outcome

Create one permission service that can answer who can see or act on which resource.

### Tasks

- add `app/server/permissions.server.ts`
- define shared permission input and result types
- implement:
  - `canViewInstanceFeed`
  - `canViewGroup`
  - `canJoinGroup`
  - `canPostToGroup`
  - `canViewEvent`
  - `canParticipateInEvent`
  - `canViewProfile`
  - `canReplyToPost`
- add unit tests for each permission path
- stop placing new access logic directly in route files

### Acceptance Criteria

- all access decisions come from one server module
- route loaders/actions can ask a permission question without duplicating DB logic
- unit tests cover anonymous, signed-in, pending, approved, moderator, and admin cases

### Completed Work

- added `app/server/permissions.server.ts`
- added permission APIs for:
  - instance feed read/write
  - group read/join/post
  - event view/participate
  - profile view
  - reply permissions
  - instance admin and audit-log access
- added `app/server/permissions.server.test.ts`
- moved current viewer-role and audit-log access logic onto the permission module
- refactored current routes/services to use the permission layer:
  - `app/server/community.service.server.ts`
  - `app/routes/profile.tsx`
  - `app/routes/settings.tsx`
  - `app/routes/audit-logs.tsx`
  - `app/routes/debug-error-monitoring.tsx`
  - `app/routes/server-settings.tsx`
- left `app/server/viewer-role.service.server.ts` as a compatibility re-export layer while the rest of the codebase transitions

### Validation

- `npm run test:unit`
- `npm run lint`
- `npm run test:e2e`

## Milestone 2: Schema Upgrade For Group Privacy

Status: Completed on 2026-03-14

### Outcome

Introduce explicit group membership and usable group visibility semantics.

### Tasks

- add `GroupMembership` table
  - `id`
  - `groupId`
  - `principalId`
  - `principalType`
  - `role`
  - `approvalStatus`
  - `createdAt`
  - `updatedAt`
- constrain `CommunityGroup.visibilityMode` to supported values in application logic
- decide whether to keep string columns or add Prisma enums later
- add indexes and uniqueness:
  - unique `(groupId, principalId, principalType)`
  - index on `groupId`
- add server helpers:
  - `getGroupMembership`
  - `ensureGroupMembership`
  - `resolveGroupRole`

### Acceptance Criteria

- a group can have its own membership independent of instance membership
- a signed-in user does not automatically become a group member by visiting a page
- membership status supports approved and pending flows

### Completed Work

- added `GroupMembership` to `prisma/schema.prisma`
- linked `CommunityGroup` to `GroupMembership`
- added `app/server/group-membership.service.server.ts`
- implemented helpers for:
  - `parseGroupVisibilityMode`
  - `getGroupVisibility`
  - `getGroupMembership`
  - `ensureGroupMembership`
  - `resolveGroupRole`
- kept group membership creation explicit and separate from read helpers so group views do not auto-create membership records
- added `app/server/group-membership.service.server.test.ts`

### Validation

- `npm run prisma:generate`
- `npm run test:unit`
- `npm run lint`

## Milestone 3: Group Read/Write Enforcement

Status: Completed on 2026-03-14

### Outcome

Make group privacy real for reads and writes.

### Tasks

- add group routes:
  - `/groups`
  - `/groups/:groupId`
- add group loader that uses the permission service
- when a group is private:
  - non-members cannot see posts
  - non-members cannot see metadata that should be private
- add group join/request flow
- add group-scoped post creation
- update post queries so group posts are filtered by access
- update search so private group content never appears to unauthorized viewers
- add audit logging for:
  - group join requests
  - membership approval
  - membership rejection

### Acceptance Criteria

- unauthorized users cannot fetch private group content through the UI or direct route access
- private group posts do not leak into the main feed or search for non-members
- group posting is impossible without the correct membership

### Completed Work

- added group routes:
  - `app/routes/groups.tsx`
  - `app/routes/group-detail.tsx`
- wired route entries in `app/routes.ts`
- added `app/server/group.service.server.ts` for:
  - group discovery lists
  - readable group resolution for feed/search filtering
  - group creation
  - group loading with access-state handling
  - join/request flow
  - membership approval and rejection
- enforced stricter direct-route privacy:
  - `private_invite_only` groups now return `not_found` for unauthorized viewers
  - unauthenticated access to non-public groups no longer serializes group metadata
- updated `app/server/community.service.server.ts` to:
  - filter main feed posts by readable group IDs
  - filter semantic search by readable group IDs
  - include group metadata on readable group posts
  - support group-scoped post creation and replies
  - reject replies that cross group boundaries
  - reject group posting for non-members
- updated `app/routes/community.tsx` to:
  - render readable group posts with group links
  - send users into the group route for group replies
  - avoid showing the instance-feed reply form on grouped posts
- updated `app/components/app-shell.tsx` so signed-in members can reach `/groups`
- added audit logging for:
  - `group.create`
  - `group.join`
  - `group.request_access`
  - `group.membership.approve`
  - `group.membership.reject`
- added Playwright coverage in `e2e/groups-privacy.spec.ts` for:
  - admin group creation
  - guest visibility and direct-route enforcement
  - private-group request/approval flow
  - member-only posting after approval

### Validation

- `npm run test:unit`
- `npm run lint`
- `npx playwright test e2e/groups-privacy.spec.ts e2e/community-studio.spec.ts`

## Milestone 4: Event Privacy

### Outcome

Make events privacy-aware and capable of inheriting privacy from groups.

### Tasks

- define event privacy resolution:
  - if `visibilityMode === inherit` and event has a group, use group visibility
  - otherwise use event visibility directly
- add event routes:
  - `/events`
  - `/events/:eventId`
- update `EventParticipation` logic to support:
  - open participation
  - request-based participation
  - participant-only visibility when needed
- ensure participant lists are hidden when event visibility does not permit viewing them
- add permission checks for:
  - viewing event details
  - participating
  - viewing participants
  - managing event

### Acceptance Criteria

- events inside private groups are private by default
- participant-only events do not expose content to non-participants
- event visibility is enforced in loaders and not just hidden in the UI

## Milestone 5: Public Visitor vs Member Views

### Outcome

Separate visitor UX from member UX throughout the app.

### Tasks

- implement anonymous read-only feed state for public instances
- remove composer and reply inputs for visitors
- redirect signed-out users to register when content requires membership
- add pending-access states for signed-in users awaiting approval
- simplify signed-out shell navigation
- add group/event-specific visitor states

### Acceptance Criteria

- visitors never see fake disabled posting controls
- restricted resources route users to the correct join/register path
- pending users see clear next-step messaging

## Milestone 6: Profile Privacy

### Outcome

Support profile-level privacy independently from instance or group visibility.

### Tasks

- add profile visibility config per user
- add profile permission checks
- restrict profile activity feeds based on profile privacy
- hide sensitive profile details from unauthorized viewers

### Acceptance Criteria

- profiles can be public, members-only, or private
- private profile activity does not leak through direct routes or notifications

## Milestone 7: Admin And Moderation Controls

### Outcome

Give admins and moderators tools to operate the new privacy model.

### Tasks

- add group membership management UI
- add event participation management UI
- add visibility controls in group and event settings
- add moderation role assignment for groups
- expand audit logging for privacy-sensitive changes

### Acceptance Criteria

- admins can approve or reject group membership requests
- admins and moderators can manage visibility without manual DB edits
- all privacy changes are auditable

## Cross-Cutting Work

## Search

- exclude unauthorized content from semantic search
- exclude unauthorized content from search result counts and snippets

## Notifications

- never send notifications that reveal private content to unauthorized users
- ensure target URLs land on pages that still pass access checks

## Caching

- avoid shared caching for authenticated/private content without viewer scoping

## Observability

- add structured logs for permission denials
- add metrics for denied reads, denied writes, join requests, approvals, and rejections

## Testing Backlog

### Unit Tests

- permission resolver cases for every subject/resource/action combination
- inheritance rules for groups, events, and attachments

### Integration Tests

- private group content is inaccessible to non-members
- private event content is inaccessible to non-participants
- group posts do not leak into public feed/search
- profile privacy hides profile activity correctly

### E2E Tests

- visitor public feed is read-only
- visitor hitting private group is redirected to join/register
- signed-in non-member sees group join/request state
- pending member sees pending state
- approved member can view and post
- admin can manage memberships and privacy settings

## Suggested Delivery Order

1. Milestone 1: Permission Foundation
2. Milestone 2: Schema Upgrade For Group Privacy
3. Milestone 3: Group Read/Write Enforcement
4. Milestone 5: Public Visitor vs Member Views
5. Milestone 4: Event Privacy
6. Milestone 6: Profile Privacy
7. Milestone 7: Admin And Moderation Controls

## Immediate Next Sprint

These are the highest-value next tasks:

1. Create `permissions.server.ts` with instance/group/event/profile permission APIs.
2. Add `GroupMembership` to the Prisma schema.
3. Update feed loading so private group posts cannot appear to unauthorized users.
4. Implement the public visitor view and remove guest composer/reply controls.
5. Add Playwright coverage for public visitor, private resource denial, and pending membership states.
