import { randomUUID } from "node:crypto";
import { getConfig } from "../config.service.server.ts";
import { getDb } from "../db.server.ts";
import {
	getAllowedProfileVisibilityModes,
	type InstanceVisibilityMode,
	type ProfileVisibilityMode,
	resolveEffectiveProfileVisibility,
} from "../permissions.server.ts";
import { sanitizeProfileSummary } from "./shared.ts";

export function parseProfileVisibilityMode(
	raw: string | null | undefined,
): ProfileVisibilityMode {
	if (raw === "public" || raw === "instance_members" || raw === "private") {
		return raw;
	}
	return "public";
}

export function parseProfileUpdateInput(params: {
	name: string | null | undefined;
	image: string | null | undefined;
	summary: string | null | undefined;
}):
	| {
			ok: true;
			value: {
				name: string;
				image: string | null;
				summary: string | null;
			};
	  }
	| { ok: false; error: string } {
	const name = (params.name ?? "").trim();
	if (name.length < 2 || name.length > 80) {
		return { ok: false, error: "Name must be between 2 and 80 characters." };
	}

	const rawImage = (params.image ?? "").trim();
	let image: string | null = null;
	if (rawImage) {
		if (rawImage.length > 1000) {
			return { ok: false, error: "Image URL is too long." };
		}
		try {
			const parsed = new URL(rawImage);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return {
					ok: false,
					error: "Image URL must start with http:// or https://.",
				};
			}
			image = parsed.toString();
		} catch {
			return { ok: false, error: "Image URL is invalid." };
		}
	}

	const summary = sanitizeProfileSummary(params.summary);
	return {
		ok: true,
		value: {
			name,
			image,
			summary,
		},
	};
}

export async function getProfileVisibility(params: {
	userId: string;
}): Promise<ProfileVisibilityMode> {
	const [preference, instanceVisibilityMode] = await Promise.all([
		getDb().profilePreference.findUnique({
			where: { userId: params.userId },
			select: { visibilityMode: true },
		}),
		getConfig("server_visibility_mode"),
	]);
	return resolveEffectiveProfileVisibility({
		instanceVisibilityMode,
		visibilityMode: parseProfileVisibilityMode(preference?.visibilityMode),
	});
}

export async function setProfileVisibility(params: {
	userId: string;
	visibilityMode: ProfileVisibilityMode;
}): Promise<void> {
	const now = new Date();
	const instanceVisibilityMode = await getConfig("server_visibility_mode");
	const visibilityMode = resolveEffectiveProfileVisibility({
		instanceVisibilityMode,
		visibilityMode: params.visibilityMode,
	});
	await getDb().profilePreference.upsert({
		where: { userId: params.userId },
		create: {
			id: randomUUID(),
			userId: params.userId,
			visibilityMode,
			summary: null,
			createdAt: now,
			updatedAt: now,
		},
		update: {
			visibilityMode,
			updatedAt: now,
		},
	});
}

export async function updateOwnProfile(params: {
	userId: string;
	name: string;
	image: string | null;
	summary: string | null;
}): Promise<void> {
	const now = new Date();
	await getDb().$transaction([
		getDb().user.update({
			where: { id: params.userId },
			data: {
				name: params.name,
				image: params.image,
				updatedAt: now,
			},
		}),
		getDb().profilePreference.upsert({
			where: { userId: params.userId },
			create: {
				id: randomUUID(),
				userId: params.userId,
				visibilityMode: "public",
				summary: params.summary,
				createdAt: now,
				updatedAt: now,
			},
			update: {
				summary: params.summary,
				updatedAt: now,
			},
		}),
	]);
}

export function listProfileVisibilityOptions(params: {
	instanceVisibilityMode: InstanceVisibilityMode;
}): Array<{ value: ProfileVisibilityMode; label: string }> {
	const allowedValues = getAllowedProfileVisibilityModes({
		instanceVisibilityMode: params.instanceVisibilityMode,
	});

	return allowedValues.map((value) => ({
		value,
		label:
			value === "public"
				? "Public"
				: value === "instance_members"
					? "Instance members"
					: "Private",
	}));
}
