import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { parseRenderLocale, parseRenderTimeZone } from "~/lib/render-intl";
import { writeAuditLogSafely } from "~/server/audit-log.service.server";
import { getServerConfig, setConfig } from "~/server/config.service.server";
import { getAppEnv } from "~/server/env.server.ts";
import {
	getHubIdentityForLocalUser,
	linkHubInstanceForUser,
	registerInstanceWithHub,
	unregisterInstanceFromHub,
} from "~/server/hub.service.server";
import { isHubUiEnabled } from "~/server/hub-config.server.ts";
import {
	canManageInstance,
	getViewerContext as getPermissionsViewerContext,
} from "~/server/permissions.server";
import { getPublicOrigin } from "~/server/request-origin.server.ts";

type ViewerContext = Awaited<ReturnType<typeof getPermissionsViewerContext>>;

export type ServerSettingsLoaderData = {
	authUser: ViewerContext["authUser"];
	viewerRole: ViewerContext["viewerRole"];
	setup: ViewerContext["setup"];
	authProviders: {
		emailPassword: boolean;
		google: boolean;
		hub: boolean;
	};
	hubConfig: Awaited<ReturnType<typeof getServerConfig>> | null;
};

export type ServerSettingsActionData =
	| { ok: true; section: "hub" | "media" | "rendering" }
	| { error: string; section?: "hub" | "media" | "rendering" }
	| undefined;

async function resolveViewerRole(params: { request: Request }): Promise<{
	authUser: ViewerContext["authUser"];
	setup: ViewerContext["setup"];
	viewerRole: ViewerContext["viewerRole"];
}> {
	return getPermissionsViewerContext({ request: params.request });
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<ServerSettingsActionData> {
	let actionSection: ServerSettingsActionData["section"] | undefined;

	try {
		const { authUser, viewerRole, setup } = await resolveViewerRole({ request });
		if (!authUser) {
			return { error: "Sign in required." };
		}
		if (!canManageInstance({ viewerRole }).allowed) {
			return { error: "Admin access required." };
		}

		const formData = await request.formData();
		const actionType = String(formData.get("_action") ?? "save-hub");
		actionSection =
			actionType === "save-rendering"
				? "rendering"
				: actionType === "save-media"
					? "media"
					: "hub";
		const hubEnabled = String(formData.get("hubEnabled") ?? "") === "on";
		const appOrigin = getPublicOrigin(request);
		const currentConfig = await getServerConfig();

		if (actionType === "save-rendering") {
			const renderLocale = parseRenderLocale(formData.get("renderLocale"));
			const renderTimeZone = parseRenderTimeZone(
				formData.get("renderTimeZone"),
			);

			if (!renderLocale) {
				return {
					error: "Enter a valid locale like en-US or fi-FI.",
					section: "rendering",
				};
			}

			if (!renderTimeZone) {
				return {
					error: "Enter a valid IANA time zone like UTC or Europe/Helsinki.",
					section: "rendering",
				};
			}

			await Promise.all([
				setConfig("render_locale", renderLocale),
				setConfig("render_time_zone", renderTimeZone),
			]);
			await writeAuditLogSafely({
				action: "server_settings.rendering_updated",
				actor: { type: "user", id: authUser.id },
				resourceType: "server_settings",
				resourceId: "rendering",
				request,
				payload: { renderLocale, renderTimeZone },
			});
			return { ok: true, section: "rendering" };
		}

		if (actionType === "save-media") {
			const mediaStorageDriver =
				String(formData.get("mediaStorageDriver") ?? "local") === "local"
					? "local"
					: "local";
			const mediaLocalRoot =
				String(formData.get("mediaLocalRoot") ?? "").trim() ||
				getAppEnv().MEDIA_LOCAL_ROOT;
			await Promise.all([
				setConfig("media_storage_driver", mediaStorageDriver),
				setConfig("media_local_root", mediaLocalRoot),
			]);
			await writeAuditLogSafely({
				action: "server_settings.media_updated",
				actor: { type: "user", id: authUser.id },
				resourceType: "server_settings",
				resourceId: "media",
				request,
				payload: { mediaStorageDriver, mediaLocalRoot },
			});
			return { ok: true, section: "media" };
		}

		if (hubEnabled) {
			const instanceName =
				currentConfig.hubInstanceName ||
				setup.instance?.name ||
				"OpenGather Instance";
			const registration = await registerInstanceWithHub({
				instanceName,
				instanceBaseUrl: appOrigin,
				redirectUri: `${appOrigin}/api/auth/oauth2/callback/hub`,
			});
			await Promise.all([
				setConfig("hub_enabled", true),
				setConfig("hub_oidc_discovery_url", registration.hubOidcDiscoveryUrl),
				setConfig("hub_client_id", registration.hubClientId),
				setConfig("hub_client_secret", registration.hubClientSecret),
				setConfig("hub_redirect_uri", `${appOrigin}/api/auth/oauth2/callback/hub`),
				setConfig("hub_instance_name", instanceName),
				setConfig("hub_instance_base_url", appOrigin),
			]);
			await writeAuditLogSafely({
				action: "server_settings.hub_connection_updated",
				actor: { type: "user", id: authUser.id },
				resourceType: "server_settings",
				resourceId: "hub_connection",
				request,
				payload: {
					hubEnabled: true,
					instanceName,
					instanceBaseUrl: appOrigin,
					outcome: "success",
				},
			});
		} else {
			await unregisterInstanceFromHub({
				instanceBaseUrl: currentConfig.hubInstanceBaseUrl || appOrigin,
			});
			await Promise.all([
				setConfig("hub_enabled", false),
				setConfig("hub_oidc_discovery_url", ""),
				setConfig("hub_client_id", ""),
				setConfig("hub_client_secret", ""),
				setConfig("hub_redirect_uri", ""),
				setConfig("hub_instance_base_url", ""),
			]);
			await writeAuditLogSafely({
				action: "server_settings.hub_connection_updated",
				actor: { type: "user", id: authUser.id },
				resourceType: "server_settings",
				resourceId: "hub_connection",
				request,
				payload: {
					hubEnabled: false,
					instanceBaseUrl: currentConfig.hubInstanceBaseUrl || appOrigin,
					outcome: "success",
				},
			});
		}

		if (hubEnabled) {
			const identity = await getHubIdentityForLocalUser({
				localUserId: authUser.id,
			});
			await linkHubInstanceForUser({
				hubUserId: identity?.hubUserId ?? authUser.id,
				hubAccessToken: identity?.hubAccessToken,
			});
		}

		return { ok: true, section: "hub" };
	} catch (error) {
		return {
			error: `Failed to save server settings: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
			section: actionSection,
		};
	}
}

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<ServerSettingsLoaderData> {
	try {
		const { authUser, setup, viewerRole } = await resolveViewerRole({ request });
		const config = await getServerConfig();

		return {
			authUser,
			viewerRole,
			setup,
			authProviders: {
				emailPassword: true,
				google: Boolean(config.googleClientId && config.googleClientSecret),
				hub: isHubUiEnabled({
					hubAvailable: config.hubAvailable,
					hubEnabled: config.hubEnabled,
					hubClientId: config.hubClientId,
					hubClientSecret: config.hubClientSecret,
				}),
			},
			hubConfig: config,
		};
	} catch {
		return {
			authUser: null,
			viewerRole: "guest",
			setup: { isSetup: false },
			authProviders: {
				emailPassword: true,
				google: false,
				hub: false,
			},
			hubConfig: null,
		};
	}
}
