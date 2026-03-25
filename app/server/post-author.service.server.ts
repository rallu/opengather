import { getDb } from "./db.server.ts";

export type PostAuthorSummary = {
	name: string;
	imageSrc?: string;
};

const FALLBACK_AUTHOR_NAME = "Member";

export async function loadPostAuthorSummaryMap(params: {
	authorIds: string[];
}): Promise<Map<string, PostAuthorSummary>> {
	const authorIds = [...new Set(params.authorIds.filter(Boolean))];
	const summaries = new Map<string, PostAuthorSummary>();

	if (authorIds.length === 0) {
		return summaries;
	}

	const users = await getDb().user.findMany({
		where: {
			OR: [
				{
					id: {
						in: authorIds,
					},
				},
				{
					accounts: {
						some: {
							providerId: "hub",
							accountId: {
								in: authorIds,
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
			accounts: {
				where: {
					providerId: "hub",
					accountId: {
						in: authorIds,
					},
				},
				select: {
					accountId: true,
				},
			},
		},
	});

	for (const user of users) {
		const summary = {
			name: user.name.trim() || FALLBACK_AUTHOR_NAME,
			imageSrc: user.image ?? undefined,
		} satisfies PostAuthorSummary;

		if (authorIds.includes(user.id)) {
			summaries.set(user.id, summary);
		}

		for (const account of user.accounts) {
			summaries.set(account.accountId, summary);
		}
	}

	for (const authorId of authorIds) {
		if (!summaries.has(authorId)) {
			summaries.set(authorId, {
				name: FALLBACK_AUTHOR_NAME,
			});
		}
	}

	return summaries;
}
