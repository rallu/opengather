import { randomUUID } from "node:crypto";
import { getBetterAuth } from "./auth.server";
import { getDb } from "./db.server";

export type SetupStatus = {
	isSetup: boolean;
	instance?: {
		id: string;
		name: string;
		slug: string;
		description?: string;
		visibilityMode: "public" | "registered" | "approval";
		approvalMode: "automatic" | "manual";
	};
};

export async function getSetupStatus(): Promise<SetupStatus> {
	const db = getDb();
	const config = await db.appConfig.findUnique({
		where: { id: "singleton" },
	});

	if (!config?.isSetup || !config.instanceId) {
		return { isSetup: false };
	}

	const instance = await db.instance.findUnique({
		where: { id: config.instanceId },
	});

	if (!instance) {
		return { isSetup: false };
	}

	return {
		isSetup: true,
		instance: {
			id: instance.id,
			name: instance.name,
			slug: instance.slug,
			description: instance.description ?? undefined,
			visibilityMode: instance.visibilityMode as
				| "public"
				| "registered"
				| "approval",
			approvalMode: instance.approvalMode as "automatic" | "manual",
		},
	};
}

export async function initializeSetup(params: {
	name: string;
	slug: string;
	description?: string;
	visibilityMode: "public" | "registered";
	approvalMode: "automatic" | "manual";
	adminName: string;
	adminEmail: string;
	adminPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const db = getDb();
	const existing = await db.appConfig.findUnique({
		where: { id: "singleton" },
		select: { isSetup: true },
	});

	if (existing?.isSetup) {
		return { ok: false, error: "Setup already completed" };
	}

	const existingInstance = await db.instance.findFirst({
		select: { id: true },
	});
	if (existingInstance) {
		return { ok: false, error: "Single-tenant instance already exists" };
	}

	const now = new Date();
	const instanceId = randomUUID();
	const auth = getBetterAuth();
	let adminResult:
		| {
				user?: {
					id: string;
					email: string;
					name: string;
					image?: string | null;
				};
		  }
		| undefined;
	try {
		adminResult = await auth.api.signUpEmail({
			body: {
				name: params.adminName,
				email: params.adminEmail,
				password: params.adminPassword,
			},
		});
	} catch (error) {
		console.error("initializeSetup: signUpEmail failed", error);
		const message = error instanceof Error ? error.message : "unknown error";
		return { ok: false, error: `Failed to create admin user: ${message}` };
	}

	if (!adminResult?.user?.id) {
		const maybeError =
			typeof adminResult === "object" && adminResult !== null
				? (adminResult as { error?: { message?: string } }).error?.message
				: undefined;
		return {
			ok: false,
			error: `Failed to create admin user${maybeError ? `: ${maybeError}` : ""}`,
		};
	}
	const adminUser = adminResult.user;

	try {
		await db.$transaction(async (trx) => {
			await trx.instance.create({
				data: {
					id: instanceId,
					slug: params.slug,
					name: params.name,
					description: params.description ?? null,
					visibilityMode: params.visibilityMode,
					approvalMode: params.approvalMode,
					aiSettings: {
						agentUsageEnabled: false,
						moderationEnabled: true,
					},
					createdAt: now,
					updatedAt: now,
				},
			});

			await trx.appConfig.upsert({
				where: { id: "singleton" },
				create: {
					id: "singleton",
					isSetup: true,
					instanceId,
					createdAt: now,
					updatedAt: now,
				},
				update: {
					isSetup: true,
					instanceId,
					updatedAt: now,
				},
			});

			await trx.instanceMembership.create({
				data: {
					id: randomUUID(),
					instanceId,
					principalId: adminUser.id,
					principalType: "user",
					role: "admin",
					approvalStatus: "approved",
					createdAt: now,
					updatedAt: now,
				},
			});
		});
	} catch (error) {
		console.error("initializeSetup: transaction failed", error);
		const message = error instanceof Error ? error.message : "unknown error";
		return { ok: false, error: `Failed to persist setup: ${message}` };
	}

	return { ok: true };
}

export async function getSetupInstanceId(): Promise<string | null> {
	const status = await getSetupStatus();
	return status.instance?.id ?? null;
}

export async function isSetupCompleteForRequest(_params: {
	request: Request;
}): Promise<boolean> {
	try {
		const status = await getSetupStatus();
		return status.isSetup;
	} catch {
		return false;
	}
}
