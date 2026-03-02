import { randomUUID } from "node:crypto";
import { getBetterAuth } from "./auth.server";
import {
	getConfig,
	hasAnyConfig,
	initializeConfigDefaults,
	setConfig,
} from "./config.service.server";
import { getDb } from "./db.server";
import { linkHubInstanceForUser } from "./hub.service.server";

export const SINGLETON_INSTANCE_ID = "singleton";

export type SetupStatus = {
	isSetup: boolean;
	instance?: {
		id: string;
		name: string;
		description?: string;
		visibilityMode: "public" | "registered" | "approval";
		approvalMode: "automatic" | "manual";
	};
};

export async function getSetupStatus(): Promise<SetupStatus> {
	if (!(await hasAnyConfig())) {
		return { isSetup: false };
	}

	let isSetup = false;
	let setupInstanceId = "";
	let name = "";
	let description = "";
	let visibilityMode: "public" | "registered" | "approval" = "public";
	let approvalMode: "automatic" | "manual" = "automatic";
	try {
		[isSetup, setupInstanceId, name, description, visibilityMode, approvalMode] =
			await Promise.all([
				getConfig("setup_completed"),
				getConfig("setup_instance_id"),
				getConfig("server_name"),
				getConfig("server_description"),
				getConfig("server_visibility_mode"),
				getConfig("server_approval_mode"),
			]);
	} catch {
		return { isSetup: false };
	}

	if (!isSetup || !setupInstanceId) {
		return { isSetup: false };
	}

	return {
		isSetup: true,
		instance: {
			id: setupInstanceId,
			name,
			description: description || undefined,
			visibilityMode,
			approvalMode,
		},
	};
}

export async function initializeSetup(params: {
	name: string;
	description?: string;
	visibilityMode: "public" | "registered" | "approval";
	approvalMode: "automatic" | "manual";
	betterAuthUrl: string;
	adminName: string;
	adminEmail: string;
	adminPassword: string;
	hub: {
		enabled: boolean;
		oidcDiscoveryUrl: string;
		clientId: string;
		clientSecret: string;
		redirectUri: string;
		instanceName: string;
		instanceBaseUrl: string;
	};
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const db = getDb();
	await initializeConfigDefaults();
	const existingSetup = await getConfig("setup_completed");
	if (existingSetup) {
		return { ok: false, error: "Setup already completed" };
	}

	await Promise.all([
		setConfig("better_auth_url", params.betterAuthUrl),
		setConfig("hub_enabled", params.hub.enabled),
		setConfig("hub_oidc_discovery_url", params.hub.oidcDiscoveryUrl),
		setConfig("hub_client_id", params.hub.clientId),
		setConfig("hub_client_secret", params.hub.clientSecret),
		setConfig("hub_redirect_uri", params.hub.redirectUri),
		setConfig("hub_instance_name", params.hub.instanceName),
		setConfig("hub_instance_base_url", params.hub.instanceBaseUrl),
	]);

	const now = new Date();
	const auth = await getBetterAuth();
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
			await trx.instanceMembership.create({
				data: {
					id: randomUUID(),
					instanceId: SINGLETON_INSTANCE_ID,
					principalId: adminUser.id,
					principalType: "user",
					role: "admin",
					approvalStatus: "approved",
					createdAt: now,
					updatedAt: now,
				},
			});
		});

		await Promise.all([
			setConfig("setup_completed", true),
			setConfig("setup_instance_id", SINGLETON_INSTANCE_ID),
			setConfig("server_name", params.name),
			setConfig("server_description", params.description ?? ""),
			setConfig("server_visibility_mode", params.visibilityMode),
			setConfig("server_approval_mode", params.approvalMode),
		]);

		if (params.hub.enabled) {
			await linkHubInstanceForUser({
				hubUserId: adminUser.id,
			});
		}
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
