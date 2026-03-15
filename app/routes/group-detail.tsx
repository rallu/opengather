import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import {
	PostComposer,
	PostComposerBody,
	PostComposerField,
	PostComposerFooter,
	PostComposerMedia,
	PostComposerSurface,
} from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import { FeedContainer } from "~/components/ui/feed-container";
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import {
	type CommunityUser,
	createPost,
	ensureInstanceMembershipForUser,
} from "~/server/community.service.server";
import {
	type GroupPost,
	loadGroup,
	removeGroupMember,
	requestGroupAccess,
	updateGroupMemberRole,
	updateGroupMembershipApproval,
	updateGroupVisibility,
} from "~/server/group.service.server";
import { parseGroupVisibilityMode } from "~/server/group-membership.service.server";
import { getInstanceViewerRole } from "~/server/permissions.server";
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

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function countReplies(post: GroupPost): number {
	return post.replies.reduce(
		(total, reply) => total + 1 + countReplies(reply),
		0,
	);
}

function GroupFeedItem(params: { post: GroupPost }) {
	const { post } = params;
	const replyCount = countReplies(post);
	const postRoute = `/posts/${post.id}`;

	return (
		<div
			className="space-y-3"
			data-testid={`group-post-${post.id}`}
			data-thread-depth={post.threadDepth}
		>
			<article
				id={`post-${post.id}`}
				className="rounded-lg border border-border p-4"
			>
				<PostContent
					createdAt={post.createdAt}
					moderationStatus={post.moderationStatus}
					isHidden={post.isHidden}
					isDeleted={post.isDeleted}
					actions={[
						{
							label: `Comments (${replyCount})`,
							to: postRoute,
							testId: `group-comment-action-${post.id}`,
						},
						{
							label: "Reply",
							to: postRoute,
							testId: `group-reply-action-${post.id}`,
						},
					]}
				>
					<p>{post.bodyText}</p>
				</PostContent>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Button variant="outline" asChild>
						<Link to={postRoute}>Open thread</Link>
					</Button>
				</div>
			</article>
		</div>
	);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	const groupId = params.groupId ?? "";
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return {
			status: "not_setup" as const,
			authUser,
			viewerRole: "guest" as const,
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
	});

	return {
		...result,
		authUser,
		viewerRole,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");
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
			ok: true,
			message:
				result.outcome === "joined"
					? "You joined the group."
					: result.outcome === "requested"
						? "Access request sent."
						: "Access request is already pending.",
		};
	}

	if (actionType === "post") {
		const text = String(formData.get("bodyText") ?? "");
		const parentPostId =
			String(formData.get("parentPostId") ?? "").trim() || undefined;
		const result = await createPost({
			user,
			text,
			parentPostId,
			groupId,
		});
		if (!result.ok) {
			return { error: result.error };
		}
		return { ok: true };
	}

	if (
		actionType === "approve-membership" ||
		actionType === "reject-membership"
	) {
		const targetUserId = String(formData.get("targetUserId") ?? "");
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
			ok: true,
			message:
				status === "approved" ? "Membership approved." : "Membership rejected.",
		};
	}

	if (actionType === "update-visibility") {
		const visibilityMode = parseGroupVisibilityMode(
			String(formData.get("visibilityMode") ?? "public"),
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
			ok: true,
			message: "Group visibility updated.",
		};
	}

	if (actionType === "update-member-role") {
		const targetUserId = String(formData.get("targetUserId") ?? "");
		const role = String(formData.get("role") ?? "");
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
			ok: true,
			message: "Member role updated.",
		};
	}

	if (actionType === "remove-member") {
		const targetUserId = String(formData.get("targetUserId") ?? "");
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
			ok: true,
			message: "Member removed from group.",
		};
	}

	return { error: "Unsupported action" };
}

export default function GroupDetailPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";
	const group =
		data.status === "ok" ||
		data.status === "pending_membership" ||
		data.status === "forbidden"
			? data.group
			: null;

	return (
		<AppShell
			authUser={data.authUser}
			title={group?.name ?? "Group"}
			subtitle={group?.description}
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
				<div className="rounded-lg border border-border p-4 text-sm">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="space-y-1">
							<p className="font-medium" data-testid="group-visibility-mode">
								{group.visibilityMode}
							</p>
							<p className="text-muted-foreground">
								Group privacy is enforced for posts and search results.
							</p>
						</div>
						<Button variant="outline" asChild>
							<Link to="/groups">Back to groups</Link>
						</Button>
					</div>
				</div>
			) : null}

			{data.status === "requires_authentication" ? (
				<div
					className="rounded-lg border border-border p-5"
					data-testid="group-requires-auth-state"
				>
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
				</div>
			) : null}

			{data.status === "forbidden" || data.status === "pending_membership" ? (
				<div
					className="rounded-lg border border-border p-5"
					data-testid="group-membership-state"
				>
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
				</div>
			) : null}

			{data.status === "ok" ? (
				<>
					{!data.canPost &&
					(data.joinState === "join" || data.joinState === "request") ? (
						<section className="rounded-lg border border-border p-4">
							<h2 className="text-lg font-semibold">Membership</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								Join this group to post and participate in member-only
								discussions.
							</p>
							<Form method="post" className="mt-4">
								<input type="hidden" name="_action" value="request-access" />
								<Button
									type="submit"
									disabled={loading}
									data-testid="group-join-visible"
								>
									{data.joinState === "join" ? "Join group" : "Request access"}
								</Button>
							</Form>
						</section>
					) : null}

					{data.canManage ? (
						<section className="rounded-lg border border-border p-4">
							<h2 className="text-lg font-semibold">Group settings</h2>
							<Form method="post" className="mt-4 flex flex-wrap gap-3">
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
						</section>
					) : null}

					{data.canPost ? (
						<section className="rounded-lg border border-border p-4">
							<h2 className="text-lg font-semibold">Post to group</h2>
							<Form method="post" className="mt-4">
								<input type="hidden" name="_action" value="post" />
								<PostComposer className="items-start">
									{data.authUser ? (
										<PostComposerMedia>
											<ProfileImage
												alt={data.authUser.name}
												fallback={getInitials(data.authUser.name)}
												size="sm"
											/>
										</PostComposerMedia>
									) : null}
									<PostComposerBody>
										<PostComposerSurface>
											<PostComposerField
												name="bodyText"
												rows={4}
												data-testid="group-post-body"
												placeholder="Share something with the group"
											/>
											<PostComposerFooter className="gap-1 px-2 py-1.5">
												<div className="flex items-center gap-1">
													<IconButton
														type="button"
														variant="ghost"
														label="Add image"
														disabled
													>
														<Icon name="imagePlus" />
													</IconButton>
													<IconButton
														type="button"
														variant="ghost"
														label="Attach file"
														disabled
													>
														<Icon name="paperclip" />
													</IconButton>
												</div>
												<IconButton
													type="submit"
													label={loading ? "Posting" : "Post"}
													disabled={loading}
													data-testid="group-post-submit"
												>
													{loading ? (
														<Icon
															name="loaderCircle"
															className="animate-spin"
														/>
													) : (
														<Icon name="sendHorizontal" />
													)}
												</IconButton>
											</PostComposerFooter>
										</PostComposerSurface>
									</PostComposerBody>
								</PostComposer>
							</Form>
						</section>
					) : null}

					{data.pendingRequests.length > 0 ? (
						<section className="rounded-lg border border-border p-4">
							<h2 className="text-lg font-semibold">Pending requests</h2>
							<div className="mt-4 space-y-3" data-testid="group-pending-list">
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
											<Form method="post">
												<input
													type="hidden"
													name="_action"
													value="approve-membership"
												/>
												<input
													type="hidden"
													name="targetUserId"
													value={request.userId}
												/>
												<Button
													type="submit"
													size="sm"
													disabled={loading}
													data-testid={`group-pending-approve-${request.userId}`}
												>
													Approve
												</Button>
											</Form>
											<Form method="post">
												<input
													type="hidden"
													name="_action"
													value="reject-membership"
												/>
												<input
													type="hidden"
													name="targetUserId"
													value={request.userId}
												/>
												<Button
													type="submit"
													size="sm"
													variant="outline"
													disabled={loading}
													data-testid={`group-pending-reject-${request.userId}`}
												>
													Reject
												</Button>
											</Form>
										</div>
									</div>
								))}
							</div>
						</section>
					) : null}

					{data.canManage ? (
						<section className="rounded-lg border border-border p-4">
							<h2 className="text-lg font-semibold">Members</h2>
							<div className="mt-4 space-y-3" data-testid="group-member-list">
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
						</section>
					) : null}

					<FeedContainer>
						<section className="space-y-4" data-testid="group-post-list">
							{data.posts.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
									No posts in this group yet.
								</div>
							) : (
								data.posts.map((post) => (
									<GroupFeedItem key={post.id} post={post} />
								))
							)}
						</section>
					</FeedContainer>
				</>
			) : null}
		</AppShell>
	);
}
