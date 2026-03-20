import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useLocation,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { PostActionItem, PostActions } from "~/components/post/post-actions";
import { PostAssetDisplay } from "~/components/post/post-asset-display";
import { PostAssetInput } from "~/components/post/post-asset-input";
import { PostComposer } from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import {
	PostListSortToggle,
	ThreadFeedList,
} from "~/components/post/thread-feed-list";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import { ContextBar } from "~/components/ui/context-bar";
import { FeedContainer } from "~/components/ui/feed-container";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	type CommunityUser,
	type CreatedPostSummary,
	createPost,
	ensureInstanceMembershipForUser,
} from "~/server/community.service.server";
import {
	loadGroup,
	removeGroupMember,
	requestGroupAccess,
	updateGroupMemberRole,
	updateGroupMembershipApproval,
	updateGroupVisibility,
} from "~/server/group.service.server";
import { parseGroupVisibilityMode } from "~/server/group-membership.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
import { extractPostUploadsFromMultipartRequest } from "~/server/post-assets.server";
import {
	type PostListItem,
	parsePostListSortMode,
} from "~/server/post-list.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

function toCommunityUser(params: {
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
}): CommunityUser | null {
	if (!params.authUser) {
		return null;
	}
	return {
		id: params.authUser.id,
		hubUserId: params.authUser.hubUserId,
		role: "member",
	};
}

function getDiscussionLabel(replyCount: number) {
	if (replyCount === 0) {
		return "Start discussion";
	}
	return replyCount === 1 ? "1 comment" : `${replyCount} comments`;
}

function toPriorityPostListItem(params: {
	post: CreatedPostSummary;
	sortMode: "activity" | "newest";
}): PostListItem {
	return {
		id: params.post.id,
		parentPostId: params.post.parentPostId,
		threadDepth: 0,
		bodyText: params.post.bodyText,
		assets: params.post.assets,
		group: params.post.group,
		moderationStatus: params.post.moderationStatus,
		isHidden: params.post.isHidden,
		isDeleted: params.post.isDeleted,
		createdAt: params.post.createdAt,
		commentCount: params.post.commentCount,
		latestActivityAt: params.post.latestActivityAt,
		sortMode: params.sortMode,
	};
}

function isSuccessfulPostAction(
	actionData: ReturnType<typeof useActionData<typeof action>>,
): actionData is { ok: true; actionType: "post"; createdPost: PostListItem } {
	return Boolean(
		actionData &&
			"ok" in actionData &&
			actionData.ok &&
			actionData.actionType === "post" &&
			"createdPost" in actionData &&
			actionData.createdPost,
	);
}

function GroupFeedItem(params: { post: PostListItem }) {
	const { post } = params;
	const postRoute = `/posts/${post.id}`;

	return (
		<div
			className="space-y-3"
			data-testid={`group-post-${post.id}`}
			data-thread-depth={post.threadDepth}
		>
			<Container
				id={`post-${post.id}`}
				className="rounded-lg border-border/50 bg-card p-4 transition-colors hover:border-primary/12 sm:p-5"
			>
				<Link
					to={postRoute}
					className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
					data-testid={`group-thread-link-${post.id}`}
				>
					<PostContent
						createdAt={post.createdAt}
						moderationStatus={post.moderationStatus}
						isHidden={post.isHidden}
						isDeleted={post.isDeleted}
						className="space-y-4"
					>
						<p className="text-[15px] leading-8">{post.bodyText}</p>
						<PostAssetDisplay assets={post.assets} playableVideo={false} />
					</PostContent>
				</Link>
				<div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
					<PostActions className="gap-2">
						<PostActionItem
							asChild
							data-testid={`group-comment-action-${post.id}`}
						>
							<Link to={postRoute}>
								{getDiscussionLabel(post.commentCount)}
							</Link>
						</PostActionItem>
					</PostActions>
				</div>
			</Container>
		</div>
	);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	const url = new URL(request.url);
	const sortMode = parsePostListSortMode(url.searchParams.get("sort"));
	const groupId = params.groupId ?? "";
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return {
			status: "not_setup" as const,
			authUser,
			viewerRole: "guest" as const,
			sortMode,
			apiPath: `/api/post-list?scope=group&groupId=${groupId}&sort=${sortMode}`,
		};
	}

	if (user) {
		await ensureInstanceMembershipForUser({
			instanceId: setup.instance.id,
			approvalMode: setup.instance.approvalMode,
			user,
		});
	}

	const viewerRole = user
		? await getInstanceViewerRole({
				instanceId: setup.instance.id,
				userId: user.id,
			})
		: "guest";
	const result = await loadGroup({
		groupId,
		authUser,
		instanceViewerRole: viewerRole,
		sortMode,
	});

	return {
		...result,
		authUser,
		viewerRole,
		sortMode,
		apiPath: `/api/post-list?scope=group&groupId=${groupId}&sort=${sortMode}`,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const sortMode = parsePostListSortMode(
		new URL(request.url).searchParams.get("sort"),
	);
	let multipart: Awaited<
		ReturnType<typeof extractPostUploadsFromMultipartRequest>
	> | null = null;
	let formData: FormData | null = null;
	let actionType = "";
	try {
		const isMultipart = (request.headers.get("content-type") ?? "")
			.toLowerCase()
			.includes("multipart/form-data");
		multipart = isMultipart
			? await extractPostUploadsFromMultipartRequest({ request })
			: null;
		formData = multipart ? null : await request.formData();
		actionType = multipart
			? multipart.actionType
			: String(formData?.get("_action") ?? "");
		const authUser = await getAuthUserFromRequest({ request });
		const groupId = params.groupId ?? "";

		if (!authUser) {
			return { error: "Sign in required" };
		}

		const setup = await getSetupStatus();
		if (!setup.isSetup || !setup.instance) {
			return { error: "Setup not completed" };
		}

		const user = toCommunityUser({ authUser });
		await ensureInstanceMembershipForUser({
			instanceId: setup.instance.id,
			approvalMode: setup.instance.approvalMode,
			user,
		});

		const viewerRole = await getInstanceViewerRole({
			instanceId: setup.instance.id,
			userId: authUser.id,
		});

		if (actionType === "request-access") {
			const result = await requestGroupAccess({
				groupId,
				authUser,
				instanceViewerRole: viewerRole,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action:
					result.outcome === "joined" ? "group.join" : "group.request_access",
				actor: {
					type: "user",
					id: authUser.id,
				},
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					outcome: result.outcome,
				},
			});

			return {
				ok: true as const,
				actionType,
				message:
					result.outcome === "joined"
						? "You joined the group."
						: result.outcome === "requested"
							? "Access request sent."
							: "Access request is already pending.",
			};
		}

		if (actionType === "post") {
			const text = multipart
				? multipart.bodyText
				: String(formData?.get("bodyText") ?? "");
			const parentPostId = multipart
				? multipart.parentPostId
				: String(formData?.get("parentPostId") ?? "").trim() || undefined;
			const result = await createPost({
				user,
				text,
				parentPostId,
				groupId,
				uploads: multipart?.uploads ?? [],
			});
			await multipart?.cleanup();
			if (!result.ok) {
				return { error: result.error };
			}
			return {
				ok: true as const,
				actionType,
				createdPost: toPriorityPostListItem({
					post: result.createdPost,
					sortMode,
				}),
			};
		}

		if (
			actionType === "approve-membership" ||
			actionType === "reject-membership"
		) {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const status =
				actionType === "approve-membership" ? "approved" : "rejected";
			const result = await updateGroupMembershipApproval({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
				status,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action:
					status === "approved"
						? "group.membership.approve"
						: "group.membership.reject",
				actor: {
					type: "user",
					id: authUser.id,
				},
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					targetUserId,
					status,
				},
			});

			return {
				ok: true as const,
				actionType,
				message:
					status === "approved"
						? "Membership approved."
						: "Membership rejected.",
			};
		}

		if (actionType === "update-visibility") {
			const visibilityMode = parseGroupVisibilityMode(
				String(formData?.get("visibilityMode") ?? "public"),
			);
			const result = await updateGroupVisibility({
				groupId,
				managerUserId: authUser.id,
				visibilityMode,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.visibility.update",
				actor: {
					type: "user",
					id: authUser.id,
				},
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					previousVisibilityMode: result.previousVisibilityMode,
					visibilityMode,
				},
			});

			return {
				ok: true as const,
				actionType,
				message: "Group visibility updated.",
			};
		}

		if (actionType === "update-member-role") {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const role = String(formData?.get("role") ?? "");
			const result = await updateGroupMemberRole({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
				role,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.member.role_update",
				actor: {
					type: "user",
					id: authUser.id,
				},
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					targetUserId,
					role: result.role,
				},
			});

			return {
				ok: true as const,
				actionType,
				message: "Member role updated.",
			};
		}

		if (actionType === "remove-member") {
			const targetUserId = String(formData?.get("targetUserId") ?? "");
			const result = await removeGroupMember({
				groupId,
				managerUserId: authUser.id,
				targetUserId,
			});
			if (!result.ok) {
				return { error: result.error };
			}

			await writeAuditLogSafely({
				action: "group.member.remove",
				actor: {
					type: "user",
					id: authUser.id,
				},
				resourceType: "group",
				resourceId: groupId,
				request,
				payload: {
					targetUserId,
				},
			});

			return {
				ok: true as const,
				actionType,
				message: "Member removed from group.",
			};
		}

		await multipart?.cleanup().catch(() => undefined);
		return { error: "Unsupported action" };
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
		return {
			error: error instanceof Error ? error.message : "Request failed",
		};
	}
}

export default function GroupDetailPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const location = useLocation();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";
	const successfulPostAction = isSuccessfulPostAction(actionData)
		? actionData
		: null;
	const composerResetKey = successfulPostAction?.createdPost.id;
	const priorityPost =
		successfulPostAction &&
		successfulPostAction.createdPost.parentPostId === undefined
			? successfulPostAction.createdPost
			: undefined;
	const buildSortHref = (sortMode: "activity" | "newest") =>
		`${location.pathname}?sort=${sortMode}`;
	const group =
		data.status === "ok" ||
		data.status === "pending_membership" ||
		data.status === "forbidden"
			? data.group
			: null;

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
		>
			{actionData && "error" in actionData ? (
				<div
					className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
					data-testid="group-action-error"
				>
					{actionData.error}
				</div>
			) : null}

			{actionData && "message" in actionData ? (
				<div
					className="rounded-md border border-border bg-muted/40 p-3 text-sm"
					data-testid="group-action-message"
				>
					{actionData.message}
				</div>
			) : null}

			{data.status === "not_setup" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			) : null}

			{data.status === "not_found" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Group not found.
				</div>
			) : null}

			{group ? (
				<ContextBar
					backTo="/groups"
					breadcrumbs={[
						{ label: "Groups", to: "/groups" },
						{ label: group.name },
					]}
					actions={
						<Badge variant="neutral" data-testid="group-visibility-mode">
							{group.visibilityMode}
						</Badge>
					}
				/>
			) : null}

			{data.status === "requires_authentication" ? (
				<Container className="p-5" data-testid="group-requires-auth-state">
					<p className="text-sm text-muted-foreground">
						Sign in to view or request access to this group.
					</p>
					<div className="mt-4 flex gap-3">
						<Button asChild>
							<Link to="/login">Sign In</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/register">Register</Link>
						</Button>
					</div>
				</Container>
			) : null}

			{data.status === "forbidden" || data.status === "pending_membership" ? (
				<Container className="p-5" data-testid="group-membership-state">
					<p className="text-sm text-muted-foreground">
						{data.status === "pending_membership"
							? "Your membership request is still pending approval."
							: "You do not have access to this group yet."}
					</p>
					{data.joinState === "join" || data.joinState === "request" ? (
						<Form method="post" className="mt-4">
							<input type="hidden" name="_action" value="request-access" />
							<Button
								type="submit"
								disabled={loading}
								data-testid="group-request-access"
							>
								{data.joinState === "join" ? "Join group" : "Request access"}
							</Button>
						</Form>
					) : null}
				</Container>
			) : null}

			{data.status === "ok" ? (
				<>
					{!data.canPost &&
					(data.joinState === "join" || data.joinState === "request") ? (
						<Container className="space-y-4 p-4">
							<p className="text-sm text-muted-foreground">
								Join this group to post and participate in member-only
								discussions.
							</p>
							<Form method="post">
								<input type="hidden" name="_action" value="request-access" />
								<Button
									type="submit"
									disabled={loading}
									data-testid="group-join-visible"
								>
									{data.joinState === "join" ? "Join group" : "Request access"}
								</Button>
							</Form>
						</Container>
					) : null}

					{data.canManage ? (
						<Container className="space-y-4 p-4">
							<p className="text-sm text-muted-foreground">
								Choose who can see this group and who needs explicit access.
							</p>
							<Form method="post" className="flex flex-wrap gap-3">
								<input type="hidden" name="_action" value="update-visibility" />
								<select
									name="visibilityMode"
									defaultValue={data.group.visibilityMode}
									data-testid="group-settings-visibility"
									className="rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									<option value="public">Public</option>
									<option value="instance_members">Instance members</option>
									<option value="group_members">Group members</option>
									<option value="private_invite_only">
										Private invite only
									</option>
								</select>
								<Button
									type="submit"
									variant="outline"
									disabled={loading}
									data-testid="group-settings-save"
								>
									Save visibility
								</Button>
							</Form>
						</Container>
					) : null}

					{data.canPost ? (
						<Form method="post" encType="multipart/form-data">
							<input type="hidden" name="_action" value="post" />
							<PostComposer
								name="bodyText"
								rows={4}
								textareaTestId="group-post-body"
								placeholder="Share something with the group"
								loading={loading}
								disabled={loading}
								submitTestId="group-post-submit"
								resetKey={composerResetKey}
								footer={
									<PostAssetInput
										inputTestId="group-assets-input"
										videoInputTestId="group-video-input"
										imageButtonTestId="group-image-button"
										videoButtonTestId="group-video-button"
										resetKey={composerResetKey}
									/>
								}
							/>
						</Form>
					) : null}

					{data.pendingRequests.length > 0 ? (
						<Container className="p-4">
							<div className="space-y-3" data-testid="group-pending-list">
								{data.pendingRequests.map((request) => (
									<div
										key={request.userId}
										className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
										data-testid={`group-pending-request-${request.userId}`}
									>
										<div className="text-sm">
											<p className="font-medium">{request.label}</p>
											<p className="text-muted-foreground">
												{request.role} • {request.approvalStatus}
											</p>
										</div>
										<div className="flex gap-2">
											<Button asChild size="sm" variant="outline">
												<Link
													to={`/approvals?request=${encodeURIComponent(request.requestKey)}`}
													data-testid={`group-pending-open-${request.userId}`}
												>
													Review in approvals
												</Link>
											</Button>
										</div>
									</div>
								))}
							</div>
						</Container>
					) : null}

					{data.canManage ? (
						<Container className="p-4">
							<div className="space-y-3" data-testid="group-member-list">
								{data.members.map((member) => (
									<div
										key={member.userId}
										className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
										data-testid={`group-member-${member.userId}`}
									>
										<div className="text-sm">
											<p className="font-medium">{member.label}</p>
											<p className="text-muted-foreground">{member.role}</p>
										</div>
										{member.role === "owner" ? (
											<p className="text-xs uppercase tracking-wide text-muted-foreground">
												Owner
											</p>
										) : (
											<div className="flex flex-wrap items-center gap-2">
												<Form method="post" className="flex gap-2">
													<input
														type="hidden"
														name="_action"
														value="update-member-role"
													/>
													<input
														type="hidden"
														name="targetUserId"
														value={member.userId}
													/>
													<select
														name="role"
														defaultValue={member.role}
														data-testid={`group-member-role-${member.userId}`}
														className="rounded-md border border-input bg-background px-3 py-2 text-sm"
													>
														<option value="member">Member</option>
														<option value="moderator">Moderator</option>
														<option value="admin">Admin</option>
													</select>
													<Button
														type="submit"
														size="sm"
														disabled={loading}
														data-testid={`group-member-role-submit-${member.userId}`}
													>
														Update role
													</Button>
												</Form>
												<Form method="post">
													<input
														type="hidden"
														name="_action"
														value="remove-member"
													/>
													<input
														type="hidden"
														name="targetUserId"
														value={member.userId}
													/>
													<Button
														type="submit"
														size="sm"
														variant="outline"
														disabled={loading}
														data-testid={`group-member-remove-${member.userId}`}
													>
														Remove
													</Button>
												</Form>
											</div>
										)}
									</div>
								))}
							</div>
						</Container>
					) : null}

					<FeedContainer>
						<div className="mb-4 flex justify-end">
							<PostListSortToggle
								sortMode={data.sortMode}
								buildHref={buildSortHref}
								prefix="group"
							/>
						</div>
						<ThreadFeedList
							key={`${location.pathname}-${data.sortMode}`}
							initialPage={data.page}
							apiPath={data.apiPath}
							listTestId="group-post-list"
							sentinelTestId="group-post-list-sentinel"
							loadingTestId="group-post-list-loading"
							priorityItem={priorityPost}
							emptyState={
								<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
									No posts in this group yet.
								</div>
							}
							renderItem={(post) => <GroupFeedItem key={post.id} post={post} />}
						/>
					</FeedContainer>
				</>
			) : null}
		</AppShell>
	);
}
