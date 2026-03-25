import "dotenv/config";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma-node/client.ts";

type SeedUser = {
	id: string;
	name: string;
	email: string;
	password: string;
};

const SEED_USERS: SeedUser[] = [
	{
		id: "seed-user-alex",
		name: "Alex Rivera",
		email: "alex@opengather.test",
		password: "OpenGather123!",
	},
	{
		id: "seed-user-jordan",
		name: "Jordan Kim",
		email: "jordan@opengather.test",
		password: "OpenGather123!",
	},
	{
		id: "seed-user-sam",
		name: "Sam Patel",
		email: "sam@opengather.test",
		password: "OpenGather123!",
	},
	{
		id: "seed-user-taylor",
		name: "Taylor Brooks",
		email: "taylor@opengather.test",
		password: "OpenGather123!",
	},
	{
		id: "seed-user-morgan",
		name: "Morgan Lee",
		email: "morgan@opengather.test",
		password: "OpenGather123!",
	},
];

const ROOT_REPLY_COUNTS = [0, 3, 6, 9, 12, 15, 18, 20, 5, 11];

const ROOT_POST_TEXT = [
	"Quick check-in: how's local testing going?",
	"Loving this build so far.",
	`I spun up a fresh local instance this morning and invited two non-technical friends to click around without any guidance.

They both found the feed immediately, posted replies without confusion, and said the overall pace felt calmer than big social apps.

For the next pass, I'd like to test if post composition still feels obvious when people switch between short status updates and longer threaded discussions.`,
	`One thing we should keep validating is how quickly a new member understands where to start.

When the first screen feels welcoming, people tend to post within minutes.

I'd love to gather feedback on whether inline reply actions are visible enough on smaller laptop screens where spacing gets tighter.`,
	`For moderation rehearsal, we should simulate a very active evening window with several overlapping discussions.

That gives us a better sense of whether community managers can spot meaningful posts quickly, hide problematic ones, and still keep context for legitimate replies.

If this remains readable at high volume, we'll be in a strong place for launch readiness.`,
	`I want to stress test profile discovery by encouraging participants to open author cards while browsing threads.

If profiles load quickly and feel informative, people are more likely to engage with unfamiliar members.

Let's note whether the profile path feels natural from both root posts and deep nested replies.`,
	`A useful QA scenario is a rotating conversation where each person answers the previous comment with one concrete example.

This gives us a realistic shape of conversation depth and lets us verify that nested replies remain easy to follow even when participants write multiple paragraphs.

We should also verify that timestamps continue to sort as expected during rapid posting.`,
	`I'd like to compare two onboarding styles: one with minimal explanation and one with a short guided prompt.

If we see stronger participation in one flow, we can prioritize that default for new communities.

Capturing this in seed data helps anyone demo the app and immediately evaluate the tone and structure of conversations.`,
	`For community events, we should test how discussion threads feel before and after an announcement post.

Announcement-first timelines often create a burst of quick replies followed by longer reflections, so mixed-length content is important for visual rhythm testing.

Let's keep this thread as a long-form example with clear paragraph spacing.`,
	`Before shipping, I want one final exploratory pass focused purely on perceived quality.

Can someone browse for ten minutes, open several threads, and leave with the impression that OpenGather feels warm, readable, and trustworthy?

If yes, this dataset is doing its job for demo and QA workflows.`,
];

const REPLY_TEXT = [
	"+1, this is great.",
	"Works for me.",
	`I like this scenario because it mirrors what a real community lead might do during the first week of rollout.

The thread stays practical while still feeling welcoming.`,
	`We should keep one or two deliberately long replies in every seeded thread.

That makes it much easier to validate spacing, readability, and scroll behavior before a public demo.`,
	`Great call.

I also noticed the conversation feels more natural when replies alternate between short acknowledgements and fuller thoughts with examples.`,
	`If we keep this data shape consistent, anyone can run the seed script and immediately evaluate the product tone without writing custom fixtures.`,
	"Agreed—this helps a lot.",
	`I tested this on a smaller display and the paragraph breaks really helped with scanability.

Let's keep that pattern in future test datasets too.`,
	`One more idea: include a few replies that mention onboarding, moderation, and events in the same thread.

That gives us richer content variety for future UI polishing.`,
	"Nice, let's keep this.",
];

function createDb() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not configured.");
	}

	const adapter = new PrismaPg({ connectionString: databaseUrl });
	return new PrismaClient({ adapter });
}

function rootPostId(index: number): string {
	return `seed-post-${index + 1}`;
}

function replyPostId(rootIndex: number, replyIndex: number): string {
	return `seed-reply-${rootIndex + 1}-${replyIndex + 1}`;
}

async function resolveSetupInstanceId(db: PrismaClient): Promise<string> {
	const rows = await db.config.findMany({
		where: {
			key: {
				in: ["setup_completed", "setup_instance_id"],
			},
		},
	});

	const completedRow = rows.find((row) => row.key === "setup_completed");
	const instanceRow = rows.find((row) => row.key === "setup_instance_id");

	if (!completedRow || completedRow.value !== true || !instanceRow) {
		throw new Error(
			"OpenGather setup is incomplete. Complete /setup first, then run this seed script.",
		);
	}

	if (typeof instanceRow.value !== "string" || instanceRow.value.length === 0) {
		throw new Error("Invalid setup_instance_id config value.");
	}

	return instanceRow.value;
}

async function ensureSeedUsers(db: PrismaClient) {
	const now = new Date();

	for (const seedUser of SEED_USERS) {
		await db.user.upsert({
			where: { email: seedUser.email },
			create: {
				id: seedUser.id,
				name: seedUser.name,
				email: seedUser.email,
				emailVerified: true,
				image: null,
				createdAt: now,
				updatedAt: now,
			},
			update: {
				name: seedUser.name,
				emailVerified: true,
				updatedAt: now,
			},
		});
	}
}

async function ensureMemberships(db: PrismaClient, instanceId: string) {
	const now = new Date();

	await Promise.all(
		SEED_USERS.map((seedUser) =>
			db.instanceMembership.upsert({
				where: {
					instanceId_principalId_principalType: {
						instanceId,
						principalId: seedUser.id,
						principalType: "user",
					},
				},
				create: {
					id: randomUUID(),
					instanceId,
					principalId: seedUser.id,
					principalType: "user",
					role: "member",
					approvalStatus: "approved",
					createdAt: now,
					updatedAt: now,
				},
				update: {
					role: "member",
					approvalStatus: "approved",
					updatedAt: now,
				},
			}),
		),
	);
}

async function seedPosts(db: PrismaClient, instanceId: string) {
	const now = Date.now();

	await db.$transaction(async (trx) => {
		for (let rootIndex = 0; rootIndex < ROOT_POST_TEXT.length; rootIndex += 1) {
			const rootId = rootPostId(rootIndex);
			await trx.post.deleteMany({
				where: {
					id: {
						startsWith: `seed-reply-${rootIndex + 1}-`,
					},
				},
			});
			await trx.post.deleteMany({
				where: {
					id: rootId,
				},
			});

			const rootAuthor = SEED_USERS[rootIndex % SEED_USERS.length];
			if (!rootAuthor) {
				throw new Error("Missing root author while seeding posts");
			}
			const rootCreatedAt = new Date(
				now - (ROOT_POST_TEXT.length - rootIndex) * 60_000,
			);

			await trx.post.create({
				data: {
					id: rootId,
					instanceId,
					authorId: rootAuthor.id,
					authorType: "user",
					groupId: null,
					rootPostId: rootId,
					parentPostId: null,
					contentType: "text",
					bodyText: ROOT_POST_TEXT[rootIndex],
					moderationStatus: "approved",
					hiddenAt: null,
					deletedAt: null,
					createdAt: rootCreatedAt,
					updatedAt: rootCreatedAt,
				},
			});

			const replyCount = ROOT_REPLY_COUNTS[rootIndex] ?? 0;
			let parentId = rootId;
			for (let replyIndex = 0; replyIndex < replyCount; replyIndex += 1) {
				const replyId = replyPostId(rootIndex, replyIndex);
				const replyAuthor =
					SEED_USERS[(rootIndex + replyIndex + 1) % SEED_USERS.length];
				if (!replyAuthor) {
					throw new Error("Missing reply author while seeding replies");
				}
				const replyCreatedAt = new Date(
					rootCreatedAt.getTime() + (replyIndex + 1) * 45_000,
				);

				await trx.post.create({
					data: {
						id: replyId,
						instanceId,
						authorId: replyAuthor.id,
						authorType: "user",
						groupId: null,
						rootPostId: rootId,
						parentPostId: parentId,
						contentType: "text",
						bodyText: REPLY_TEXT[replyIndex % REPLY_TEXT.length],
						moderationStatus: "approved",
						hiddenAt: null,
						deletedAt: null,
						createdAt: replyCreatedAt,
						updatedAt: replyCreatedAt,
					},
				});

				parentId = replyId;
			}
		}
	});
}

async function main() {
	const db = createDb();
	try {
		const instanceId = await resolveSetupInstanceId(db);
		await ensureSeedUsers(db);
		await ensureMemberships(db, instanceId);
		await seedPosts(db, instanceId);

		console.log("Seeded test environment successfully.");
		console.log("Users:");
		for (const user of SEED_USERS) {
			console.log(`- ${user.email} / ${user.password}`);
		}
	} finally {
		await db.$disconnect();
	}
}

main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to seed test environment",
	);
	process.exitCode = 1;
});
