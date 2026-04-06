# Data Exports Plan

## Purpose

This document is the focused implementation plan for user data exports in `opengather`.

It turns the manifesto requirement around data ownership and leaving into a concrete delivery sequence.

This plan assumes:

- the current instance, group, profile, and notification foundations stay in place
- export work should ship before destructive leave or deletion flows
- V1 export is machine-readable and trustworthy before it is polished or highly customizable

## Product Goal

Any signed-in user should be able to request and download a complete export of the data they own or need in order to leave an OpenGather instance.

The export should be:

- self-service
- privacy-safe
- auditable
- asynchronous
- stable enough to support future import or migration work

## Why This Comes Next

The manifesto says:

- users should own their own data
- leaving should be possible, including exporting and transferring data

Today the codebase has most of the source data needed for export, but not the export workflow itself.

That makes exports the highest-priority ownership gap.

## Current Baseline

The codebase already has usable source primitives:

- `User`, `Account`, `Session`
- `InstanceMembership`
- `GroupMembership`
- `ProfilePreference`
- `NotificationPreference`
- `Notification`
- `Post`, `PostAttachment`, `PostAsset`, `PostAssetVariant`
- `AuditLog`
- `ProcessingJob`

The codebase does not yet have:

- an export request model
- an export artifact model
- a user-facing export page
- a download route
- an export worker path

## V1 Outcome

Ship a user-visible data export flow that supports:

1. request export from settings
2. process export asynchronously
3. show export status history
4. download a time-limited artifact
5. audit request and download events

## Export Scope For V1

Include:

- user account basics
- linked identity metadata that belongs to the user locally
- profile summary and visibility preference
- notification preferences
- notifications addressed to the user
- instance membership state
- group memberships and group roles
- posts and replies authored by the user
- authored moderation actions, if present
- attachment metadata for authored content
- locally stored asset metadata for authored content
- audit log entries where the actor is the user

Do not include in V1:

- other users' private content beyond minimal structural references
- raw auth sessions or tokens
- provider refresh tokens
- system secrets
- full internal diagnostics
- other users' notifications

## Export Format

Use a versioned archive with JSON files and an attachment manifest.

Recommended shape:

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

- timestamps use ISO 8601
- stable ids are preserved
- the archive includes export schema version
- the archive includes instance metadata and generation timestamp
- cross-user references are ids or minimal summaries, not copied private payloads

## Architecture

### Request Model

Add `DataExportRequest`:

- `id`
- `userId`
- `status`
- `format`
- `requestedAt`
- `startedAt`
- `completedAt`
- `expiresAt`
- `errorMessage`

Suggested statuses:

- `pending`
- `processing`
- `completed`
- `failed`
- `expired`

### Artifact Model

Add `DataExportArtifact`:

- `id`
- `exportRequestId`
- `storageType`
- `storagePath`
- `sha256`
- `sizeBytes`
- `createdAt`

### Processing Model

Reuse `ProcessingJob`.

Recommended flow:

1. user requests export
2. app creates `DataExportRequest`
3. app enqueues `ProcessingJob` with job type `user_data_export`
4. worker builds export payload snapshot
5. worker writes artifact to local storage
6. app exposes authenticated download

## Storage Strategy

For V1, keep export artifacts in instance-local storage.

Recommended location:

- under the same storage root used for other mutable instance data
- segregated by user id and export request id

Rules:

- never expose exports by guessable public URL
- require authenticated download by the owning user
- add expiration cleanup later, but store `expiresAt` from the start

## Service Layer

Add `app/server/export.service.server.ts` with:

- `requestUserExport`
- `listUserExports`
- `startPendingExport`
- `buildUserExportPayload`
- `writeUserExportArtifact`
- `completeUserExport`
- `failUserExport`
- `getDownloadableExport`

Extend `app/server/jobs.service.server.ts` or equivalent job runner branch with:

- `user_data_export` processing

Add a small serializer module if needed:

- `app/server/export-serializer.server.ts`

Purpose:

- keep query logic separate from archive/file-building logic

## Routes And UI

### New Routes

- `/settings/data`
- `/exports/:exportId/download`

### `/settings/data` Should Support

- request export
- list recent export requests
- show current status
- show completion time
- show expiration time
- show download action when ready

### UX Rules

- only signed-in users can access the page
- describe what is included in the export
- show async status clearly
- allow repeated requests
- keep the page useful even if earlier requests failed

## Privacy Rules

The export must be ownership-based, not readability-based.

That means:

- include the user's authored content even if the user later lost access
- do not include other private content just because it was once readable
- include private group membership metadata when it is the user's own membership
- filter all cross-user content down to the minimum required structure

## Audit Rules

Add audit actions:

- `user.export.request`
- `user.export.complete`
- `user.export.download`
- `user.export.fail`

Each event should capture:

- user id
- export request id
- request metadata
- artifact metadata where relevant

Do not log raw export contents.

## Delivery Order

### Milestone 1: Schema And Service Skeleton

- add `DataExportRequest`
- add `DataExportArtifact`
- add export service skeleton
- add audit action constants/usages

### Milestone 2: Request And Status UI

- add `/settings/data`
- add request action
- add request listing/status loader
- show pending, processing, completed, and failed states

### Milestone 3: Worker And Artifact Build

- add `user_data_export` job branch
- build JSON payload snapshot
- write archive metadata and artifact record
- mark request completed or failed

### Milestone 4: Secure Download

- add `/exports/:exportId/download`
- verify ownership
- add expiration behavior
- set safe response headers

### Milestone 5: Regression Coverage

- unit tests for payload builders
- service tests for request lifecycle
- route tests for auth and ownership checks
- end-to-end smoke test for request to download path

## Suggested Query Order For Export Builder

Build the payload in this order:

1. user record and local profile data
2. instance membership
3. group memberships
4. notification preferences and notifications
5. authored posts and replies
6. attachment and asset metadata for authored content
7. authored moderation actions
8. relevant audit log entries

Reason:

- it starts from identity and memberships
- it makes privacy review easier
- attachments can be derived from authored content after post selection

## Known Deferred Work

Do not block V1 on:

- full binary attachment bundling
- imports
- cross-instance migration tooling
- admin-triggered exports for other users
- event-specific exports
- selective export scopes in the UI

Those can follow once the ownership-safe base export exists.

## Acceptance Criteria

- a signed-in user can request an export without admin help
- export generation is asynchronous and survives normal request boundaries
- only the owning user can download the artifact
- downloads are not publicly cacheable
- audit logs record request and download lifecycle
- the archive contains the user's own core account, membership, content, and preference data
