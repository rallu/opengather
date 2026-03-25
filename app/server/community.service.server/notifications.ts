import { Prisma } from "@prisma/client";
import { getDb } from "../db.server.ts";
import { processNotificationOutbox } from "../jobs.service.server.ts";
import { extractMentionEmails } from "../mentions.server.ts";
import { createNotification } from "../notification.service.server.ts";
import { canUserAccessPostAudience } from "./access.ts";
import type { CommunityUser } from "./shared.ts";

export async function sendPostNotifications(params: {
	postId: string;
	text: string;
	user: CommunityUser;
	parentPostId?: string;
	targetUrl: string;
	instanceId: string;
	instanceVisibilityMode: "public" | "registered" | "approval";
	group?: {
		id: string;
		visibilityMode: string;
	} | null;
}): Promise<void> {
	const db = getDb();
	const mentionEmails = extractMentionEmails({ text: params.text });
	const notifiedLocalUsers = new Set<string>();
	if (mentionEmails.length > 0) {
		const mentionedUsers = await db.$queryRaw<
			Array<{ local_id: string; hub_user_id: string | null; email: string }>
		>(
			Prisma.sql`SELECT u.id AS local_id,
				a."accountId" AS hub_user_id,
				u.email
			FROM "user" u
			LEFT JOIN "account" a ON a."userId" = u.id AND a."providerId" = 'hub'
			WHERE u.email IN (${Prisma.join(mentionEmails)})`,
		);

		for (const user of mentionedUsers) {
			if (user.local_id === params.user.id) {
				continue;
			}
			if (
				!(await canUserAccessPostAudience({
					instanceId: params.instanceId,
					userId: user.local_id,
					instanceVisibilityMode: params.instanceVisibilityMode,
					group: params.group,
				}))
			) {
				continue;
			}
			notifiedLocalUsers.add(user.local_id);
			await createNotification({
				userId: user.local_id,
				kind: "mention",
				title: "You were mentioned in a post",
				body: params.text,
				targetUrl: `${params.targetUrl}#post-${params.postId}`,
				relatedEntityId: params.postId,
				payload: {
					actorUserId: params.user.id,
					postId: params.postId,
				},
			});
		}
	}

	if (!params.parentPostId) {
		return;
	}

	const parent = await db.post.findUnique({
		where: { id: params.parentPostId },
		select: { authorId: true },
	});

	const postingAuthorId = params.user.hubUserId ?? params.user.id;
	if (!parent || parent.authorId === postingAuthorId) {
		return;
	}

	const localParentAuthor = await db.user.findFirst({
		where: {
			OR: [
				{ id: parent.authorId },
				{
					accounts: {
						some: {
							providerId: "hub",
							accountId: parent.authorId,
						},
					},
				},
			],
		},
		select: { id: true },
	});

	if (
		localParentAuthor &&
		localParentAuthor.id !== params.user.id &&
		!notifiedLocalUsers.has(localParentAuthor.id) &&
		(await canUserAccessPostAudience({
			instanceId: params.instanceId,
			userId: localParentAuthor.id,
			instanceVisibilityMode: params.instanceVisibilityMode,
			group: params.group,
		}))
	) {
		await createNotification({
			userId: localParentAuthor.id,
			kind: "reply_to_post",
			title: "New reply to your post",
			body: params.text,
			targetUrl: `${params.targetUrl}#post-${params.postId}`,
			relatedEntityId: params.postId,
			payload: {
				actorUserId: params.user.id,
				postId: params.postId,
				parentPostId: params.parentPostId,
			},
		});
	}

	await processNotificationOutbox({ limit: 10 });
}
