export type SeedUser = {
	id: string;
	name: string;
	email: string;
	password: string;
};

export const SEED_USERS: SeedUser[] = [
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

export const ROOT_REPLY_COUNTS = [0, 3, 6, 9, 12, 15, 18, 20, 5, 11];

export const ROOT_POST_TEXT = [
	"Quick check-in: how's local testing going? Tag @alex and drop notes in /feed.",
	"Loving this build so far. Added references in /groups and docs at https://opengather.dev/notes.",
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

export const REPLY_TEXT = [
	"+1, this is great. @jordan can you review /profile?",
	"Works for me. I linked details in https://example.com/demo-plan.",
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

export function rootPostId(index: number): string {
	return `seed-post-${index + 1}`;
}

export function replyPostId(rootIndex: number, replyIndex: number): string {
	return `seed-reply-${rootIndex + 1}-${replyIndex + 1}`;
}
