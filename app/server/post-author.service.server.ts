import { getDb } from "./db.server.ts";
import { resolveEffectiveProfileImage } from "./profile-image.server.ts";

export type PostAuthorSummary = {
	id: string;
	name: string;
	kind: "agent" | "user";
	imageSrc?: string;
	profilePath?: string;
};

const FALLBACK_AUTHOR_NAME = "Member";
const FALLBACK_AGENT_NAME = "Agent";

export async function loadPostAuthorSummaryMap(params: {
	authors: Array<{
		id: string;
		type: string;
	}>;
	db?: {
		user: {
			findMany: (args: {
				where: Record<string, unknown>;
				select: Record<string, unknown>;
			}) => Promise<
				Array<{
					id: string;
					name: string;
					image: string | null;
					imageOverride: string | null;
					accounts: Array<{ accountId: string }>;
				}>
			>;
		};
		agent: {
			findMany: (args: {
				where: Record<string, unknown>;
				select: Record<string, unknown>;
			}) => Promise<
				Array<{
					id: string;
					displayName: string;
					displayLabel: string | null;
				}>
			>;
		};
	};
}): Promise<Map<string, PostAuthorSummary>> {
	const authors = params.authors.filter((author) => author.id);
	const authorIds = [...new Set(authors.map((author) => author.id))];
	const userAuthorIds = [
		...new Set(
			authors
				.filter((author) => author.type !== "agent")
				.map((author) => author.id),
		),
	];
	const agentAuthorIds = [
		...new Set(
			authors
				.filter((author) => author.type === "agent")
				.map((author) => author.id),
		),
	];
	const summaries = new Map<string, PostAuthorSummary>();

	if (authorIds.length === 0) {
		return summaries;
	}

	const db = params.db ?? getDb();
	const [users, agents] = await Promise.all([
		userAuthorIds.length > 0
			? db.user.findMany({
					where: {
						OR: [
							{
								id: {
									in: userAuthorIds,
								},
							},
							{
								accounts: {
									some: {
										providerId: "hub",
										accountId: {
											in: userAuthorIds,
										},
									},
								},
							},
						],
					},
					select: {
						id: true,
						name: true,
						image: true,
						imageOverride: true,
						accounts: {
							where: {
								providerId: "hub",
								accountId: {
									in: userAuthorIds,
								},
							},
							select: {
								accountId: true,
							},
						},
					},
				})
			: Promise.resolve([]),
		agentAuthorIds.length > 0
			? db.agent.findMany({
					where: {
						id: {
							in: agentAuthorIds,
						},
					},
					select: {
						id: true,
						displayName: true,
						displayLabel: true,
					},
				})
			: Promise.resolve([]),
	]);

	for (const user of users) {
		const summary = {
			id: user.id,
			name: user.name.trim() || FALLBACK_AUTHOR_NAME,
			kind: "user",
			imageSrc: resolveEffectiveProfileImage(user),
			profilePath: `/profiles/${user.id}`,
		} satisfies PostAuthorSummary;

		if (authorIds.includes(user.id)) {
			summaries.set(user.id, summary);
		}

		for (const account of user.accounts) {
			summaries.set(account.accountId, summary);
		}
	}

	for (const agent of agents) {
		summaries.set(agent.id, {
			id: agent.id,
			name:
				agent.displayLabel?.trim() ||
				agent.displayName.trim() ||
				FALLBACK_AGENT_NAME,
			kind: "agent",
		});
	}

	for (const authorId of authorIds) {
		if (!summaries.has(authorId)) {
			summaries.set(authorId, {
				id: authorId,
				name:
					authors.find((author) => author.id === authorId)?.type === "agent"
						? FALLBACK_AGENT_NAME
						: FALLBACK_AUTHOR_NAME,
				kind:
					authors.find((author) => author.id === authorId)?.type === "agent"
						? "agent"
						: "user",
			});
		}
	}

	return summaries;
}
