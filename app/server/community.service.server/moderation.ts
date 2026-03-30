import { randomUUID } from "node:crypto";
import { getDb } from "../db.server.ts";
import { processNotificationOutbox } from "../jobs.service.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import { isAdmin } from "./access.ts";
import type { CommunityUser } from "./shared.ts";

export async function moderatePost(params: {
	user: CommunityUser | null;
	postId: string;
	status: "approved" | "rejected" | "flagged";
	hide: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const admin = await isAdmin({
		instanceId: setup.instance.id,
		user: params.user,
	});
	if (!admin || !params.user) {
		return { ok: false, error: "Admin access required" };
	}

	const now = new Date();
	const updated = await getDb().post.updateMany({
		where: {
			id: params.postId,
			instanceId: setup.instance.id,
		},
		data: {
			moderationStatus: params.status,
			hiddenAt: params.hide ? now : null,
			updatedAt: now,
		},
	});

	if (updated.count === 0) {
		return { ok: false, error: "Post not found" };
	}

	await getDb().moderationDecision.create({
		data: {
			id: randomUUID(),
			postId: params.postId,
			status: params.status,
			reason: "manual-admin-moderation",
			actorType: "human",
			actorId: params.user.id,
			modelName: null,
			createdAt: now,
		},
	});

	await processNotificationOutbox({ limit: 10 });
	return { ok: true };
}

export async function softDeletePost(params: {
	user: CommunityUser | null;
	postId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const setup = await getSetupStatus();
	if (!setup.isSetup || !setup.instance) {
		return { ok: false, error: "Setup not completed" };
	}

	const admin = await isAdmin({
		instanceId: setup.instance.id,
		user: params.user,
	});
	if (!params.user) {
		return { ok: false, error: "Sign in required" };
	}

	const viewerAuthorIds = [params.user.id];
	if (params.user.hubUserId) {
		viewerAuthorIds.push(params.user.hubUserId);
	}

	const updated = await getDb().post.updateMany({
		where: {
			id: params.postId,
			instanceId: setup.instance.id,
			...(admin ? {} : { authorId: { in: viewerAuthorIds } }),
		},
		data: {
			deletedAt: new Date(),
			updatedAt: new Date(),
		},
	});

	if (updated.count === 0) {
		return {
			ok: false,
			error: admin ? "Post not found" : "Post not found or not owned by user",
		};
	}

	await processNotificationOutbox({ limit: 10 });
	return { ok: true };
}
