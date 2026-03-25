import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
	type CommunityUser,
	createPost,
	loadCommunityPostThread,
} from "~/server/community.service.server";
import {
	extractPostUploadsFromMultipartRequest,
	loadUserAlbumTags,
} from "~/server/post-assets.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export type PostDetailLoaderData = Awaited<ReturnType<typeof loadLoaderData>>;
export type PostDetailActionData = { error: string } | Response;

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

async function loadLoaderData(params: {
	request: Request;
	postId: string;
}) {
	const authUser = await getAuthUserFromRequest({ request: params.request });
	const user = toCommunityUser({ authUser });
	const result = await loadCommunityPostThread({ user, postId: params.postId });
	const setup = await getSetupStatus();

	const previousAlbums =
		authUser && setup.isSetup && setup.instance
			? await loadUserAlbumTags({
					instanceId: setup.instance.id,
					userId: authUser.id,
					hubUserId: authUser.hubUserId ?? undefined,
				})
			: [];

	return {
		...result,
		authUser,
		previousAlbums,
	};
}

export async function loader({
	request,
	params,
}: LoaderFunctionArgs): Promise<PostDetailLoaderData | Response> {
	const postId = params.postId ?? "";
	const result = await loadLoaderData({ request, postId });

	if (result.status !== "requires_registration") {
		return result;
	}

	const nextPath = new URL(request.url).pathname;
	const search = new URLSearchParams({
		next: nextPath,
		reason: "members-only",
	});
	return redirect(`/register?${search.toString()}`);
}

export async function action({
	request,
	params,
}: ActionFunctionArgs): Promise<{ error: string } | Response> {
	const authUser = await getAuthUserFromRequest({ request });
	const user = toCommunityUser({ authUser });
	if (!user) {
		return { error: "Sign in required" };
	}

	let multipart: Awaited<
		ReturnType<typeof extractPostUploadsFromMultipartRequest>
	> | null = null;

	try {
		const isMultipart = (request.headers.get("content-type") ?? "")
			.toLowerCase()
			.includes("multipart/form-data");
		multipart = isMultipart
			? await extractPostUploadsFromMultipartRequest({ request })
			: null;
		const formData = multipart ? null : await request.formData();
		const actionType = multipart
			? multipart.actionType
			: String(formData?.get("_action") ?? "");

		if (actionType !== "post") {
			await multipart?.cleanup().catch(() => undefined);
			return { error: "Unsupported action" };
		}

		const text = multipart
			? multipart.bodyText
			: String(formData?.get("bodyText") ?? "");
		const parentPostId =
			multipart?.parentPostId ||
			String(formData?.get("parentPostId") ?? "").trim() ||
			params.postId ||
			undefined;
		const result = await createPost({
			user,
			text,
			albumTags: multipart?.albumTags ?? [],
			parentPostId,
			uploads: multipart?.uploads ?? [],
		});
		await multipart?.cleanup();

		if (!result.ok) {
			return { error: result.error };
		}

		return redirect(`/posts/${params.postId ?? ""}`);
	} catch (error) {
		await multipart?.cleanup().catch(() => undefined);
		return {
			error: error instanceof Error ? error.message : "Request failed",
		};
	}
}
