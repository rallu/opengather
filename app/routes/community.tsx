import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import {
	type CommunityUser,
	createPost,
	loadCommunity,
	moderatePost,
	softDeletePost,
} from "~/server/community.service.server";
import { getAuthUserFromRequest } from "~/server/session.server";

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

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const q = url.searchParams.get("q") ?? undefined;

	try {
		const authUser = await getAuthUserFromRequest({ request });
		const user = toCommunityUser({ authUser });
		const data = await loadCommunity({ user, query: q });

		return {
			...data,
			q: q ?? "",
			authUser,
		};
	} catch {
		return {
			status: "not_setup" as const,
			viewerRole: "guest" as const,
			posts: [],
			search: [],
			q: q ?? "",
			authUser: null,
		};
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "");

	try {
		const authUser = await getAuthUserFromRequest({ request });
		const user = toCommunityUser({ authUser });

		if (actionType === "post") {
			const text = String(formData.get("bodyText") ?? "");
			const parentPostId =
				String(formData.get("parentPostId") ?? "").trim() || undefined;
			const result = await createPost({ user, text, parentPostId });
			if (!result.ok) {
				return { error: result.error };
			}
			return { ok: true };
		}

		if (actionType === "moderate") {
			const postId = String(formData.get("postId") ?? "");
			const status = String(formData.get("status") ?? "approved") as
				| "approved"
				| "rejected"
				| "flagged";
			const hide = status !== "approved";
			const result = await moderatePost({ user, postId, status, hide });
			if (!result.ok) {
				return { error: result.error };
			}
			return { ok: true };
		}

		if (actionType === "delete") {
			const postId = String(formData.get("postId") ?? "");
			const result = await softDeletePost({ user, postId });
			if (!result.ok) {
				return { error: result.error };
			}
			return { ok: true };
		}

		return { error: "Unsupported action" };
	} catch {
		return { error: "Request failed" };
	}
}

export default function CommunityPage() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	return (
		<AppShell
			authUser={data.authUser}
			showServerSettings={data.viewerRole === "admin"}
			searchQuery={data.q}
		>
			{data.status === "not_setup" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Setup is not completed.
				</div>
			) : null}

			{data.status === "forbidden" ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					Access denied.
				</div>
			) : null}

			{actionData && "error" in actionData ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{actionData.error}
				</div>
			) : null}

			<div className="rounded-md border border-border p-4">
				<Form method="post" className="space-y-3">
					<input type="hidden" name="_action" value="post" />
					<input type="hidden" name="parentPostId" value={""} />
					<textarea
						name="bodyText"
						className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						placeholder="What's on your mind?"
					/>
					<Button
						type="submit"
						disabled={loading || !data.authUser || data.status !== "ok"}
					>
						{loading ? "Saving..." : "Post"}
					</Button>
				</Form>
			</div>

			{data.q ? (
				<div className="rounded-md border border-border p-4">
					<p className="mb-3 text-sm text-muted-foreground">
						Results for{" "}
						<span className="font-medium text-foreground">{data.q}</span>
					</p>
					<div className="space-y-2">
						{data.search.map((item) => (
							<div
								key={item.post.id}
								className="rounded border border-border p-2 text-sm"
							>
								<p>{item.post.bodyText}</p>
								<p className="text-xs text-muted-foreground">
									score: {item.score.toFixed(4)}
								</p>
							</div>
						))}
						{data.search.length === 0 ? (
							<p className="text-sm text-muted-foreground">No matches.</p>
						) : null}
					</div>
				</div>
			) : null}

			<div className="space-y-2">
				{data.posts.length === 0 ? (
					<p className="text-sm text-muted-foreground">No posts yet.</p>
				) : null}
				{data.posts.map((post) => (
					<div
						key={post.id}
						id={`post-${post.id}`}
						className="rounded-md border border-border p-3"
					>
						<p className="text-sm">
							{post.parentPostId ? (
								<span className="text-muted-foreground">
									Reply to {post.parentPostId}:{" "}
								</span>
							) : null}
							{post.bodyText}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{post.moderationStatus} •{" "}
							{new Date(post.createdAt).toLocaleString()}
							{post.isHidden ? " • hidden" : ""}
							{post.isDeleted ? " • deleted" : ""}
						</p>
						<div className="mt-2 flex gap-2">
							<Form method="post" className="inline-flex">
								<input type="hidden" name="_action" value="post" />
								<input type="hidden" name="parentPostId" value={post.id} />
								<input
									name="bodyText"
									placeholder="Reply"
									className="rounded-l-md border border-input bg-background px-3 py-2 text-sm"
								/>
								<Button
									type="submit"
									className="rounded-l-none"
									disabled={!data.authUser || data.status !== "ok"}
								>
									Reply
								</Button>
							</Form>

							{data.viewerRole === "admin" ? (
								<>
									<Form method="post">
										<input type="hidden" name="_action" value="moderate" />
										<input type="hidden" name="postId" value={post.id} />
										<input type="hidden" name="status" value="approved" />
										<Button type="submit" variant="outline">
											Approve
										</Button>
									</Form>
									<Form method="post">
										<input type="hidden" name="_action" value="moderate" />
										<input type="hidden" name="postId" value={post.id} />
										<input type="hidden" name="status" value="rejected" />
										<Button type="submit" variant="outline">
											Hide
										</Button>
									</Form>
									<Form method="post">
										<input type="hidden" name="_action" value="delete" />
										<input type="hidden" name="postId" value={post.id} />
										<Button type="submit" variant="outline">
											Delete
										</Button>
									</Form>
								</>
							) : null}
						</div>
					</div>
				))}
			</div>
		</AppShell>
	);
}
