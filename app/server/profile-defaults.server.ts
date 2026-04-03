import { getDefaultProfileImageForUser } from "../lib/default-profile-images.ts";
import { getDb } from "./db.server.ts";

export async function ensureUserHasStoredProfileImage(params: {
	userId: string;
	email?: string | null;
	name?: string | null;
}): Promise<void> {
	const user = await getDb().user.findUnique({
		where: { id: params.userId },
		select: {
			id: true,
			name: true,
			email: true,
			image: true,
		},
	});
	if (!user || user.image?.trim()) {
		return;
	}

	await getDb().user.update({
		where: { id: user.id },
		data: {
			image: getDefaultProfileImageForUser({
				id: user.id,
				email: params.email ?? user.email,
				name: params.name ?? user.name,
			}),
		},
	});
}
