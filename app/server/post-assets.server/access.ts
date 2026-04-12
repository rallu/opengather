import { Readable } from "node:stream";

import { getAssetStorage } from "../asset-storage.server.ts";
import { ensureInstanceMembershipForUser } from "../community.service.server.ts";
import { getConfig } from "../config.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	getGroupMembership,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import {
	canViewGroup,
	canViewInstanceFeed,
	type GroupVisibilityMode,
	getInstanceViewerRole,
	type ViewerRole,
} from "../permissions.server.ts";
import { getAuthUserFromRequest } from "../session.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import { pickImageVariantFormat } from "./image-processing.ts";

async function resolveAssetAccess(params: {
	request: Request;
	post: {
		id: string;
		instanceId: string;
		groupId: string | null;
		moderationStatus: string;
		hiddenAt: Date | null;
		deletedAt: Date | null;
	};
}): Promise<{ allowed: boolean; isPublic: boolean }> {
	const authUser = await getAuthUserFromRequest({ request: params.request });
	const setup = await getSetupStatus();
	if (authUser && setup.isSetup && setup.instance) {
		await ensureInstanceMembershipForUser({
			instanceId: params.post.instanceId,
			approvalMode: setup.instance.approvalMode,
			user: {
				id: authUser.id,
				hubUserId: authUser.hubUserId,
				role: "member",
			} as const,
		});
	}

	const viewerRole: ViewerRole = authUser
		? await getInstanceViewerRole({
				instanceId: params.post.instanceId,
				userId: authUser.id,
			})
		: "guest";
	if (
		viewerRole !== "admin" &&
		(Boolean(params.post.hiddenAt) ||
			Boolean(params.post.deletedAt) ||
			params.post.moderationStatus === "rejected")
	) {
		return { allowed: false, isPublic: false };
	}

	if (!params.post.groupId) {
		const visibilityMode = await getConfig("server_visibility_mode");
		const result = canViewInstanceFeed({
			visibilityMode,
			viewerRole,
			isAuthenticated: Boolean(authUser),
		});
		return { allowed: result.allowed, isPublic: visibilityMode === "public" };
	}

	const group = await getDb().communityGroup.findUnique({
		where: { id: params.post.groupId },
		select: { visibilityMode: true },
	});
	if (!group) {
		return { allowed: false, isPublic: false };
	}

	const membership = authUser
		? await getGroupMembership({
				groupId: params.post.groupId,
				userId: authUser.id,
			})
		: null;
	const result = canViewGroup({
		isAuthenticated: Boolean(authUser),
		instanceViewerRole: viewerRole,
		groupRole: resolveGroupRole(membership),
		visibilityMode: group.visibilityMode as GroupVisibilityMode,
	});
	return {
		allowed: result.allowed,
		isPublic: group.visibilityMode === "public",
	};
}

export async function createMediaResponse(params: {
	request: Request;
	assetId: string;
	variantKey: string;
}): Promise<Response> {
	const asset = await getDb().postAsset.findUnique({
		where: { id: params.assetId },
		include: {
			post: {
				select: {
					id: true,
					instanceId: true,
					groupId: true,
					moderationStatus: true,
					hiddenAt: true,
					deletedAt: true,
				},
			},
			variants: {
				where: { variantKey: params.variantKey },
				orderBy: [{ format: "asc" }],
			},
		},
	});

	if (
		!asset ||
		asset.processingStatus !== "ready" ||
		asset.variants.length === 0
	) {
		return new Response("Not found", { status: 404 });
	}

	const access = await resolveAssetAccess({
		request: params.request,
		post: asset.post,
	});
	if (!access.allowed) {
		return new Response("Not found", { status: 404 });
	}

	const acceptHeader = params.request.headers.get("accept") ?? "*/*";
	const preferredFormat =
		params.variantKey === "video-playback"
			? "mp4"
			: pickImageVariantFormat(acceptHeader, asset.variants);
	const variant =
		asset.variants.find((item) => item.format === preferredFormat) ??
		asset.variants[0];
	if (!variant) {
		return new Response("Not found", { status: 404 });
	}

	const storage = await getAssetStorage();
	const byteSize = await storage.statObject({ key: variant.storageKey });
	if (!byteSize) {
		return new Response("Not found", { status: 404 });
	}
	const body = Readable.toWeb(
		await storage.createReadStream({ key: variant.storageKey }),
	) as ReadableStream;

	return new Response(body, {
		status: 200,
		headers: {
			"Cache-Control": access.isPublic
				? "public, max-age=3600"
				: "private, no-store",
			"Content-Length": String(byteSize.byteSize),
			"Content-Type": variant.mimeType,
			Vary: "Accept, Cookie",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
