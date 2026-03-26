import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
	hasDatabaseConfig,
	hasHubBaseUrlConfigured,
} from "~/server/env.server";
import { captureMonitoredError } from "~/server/error-monitoring.server";
import { registerInstanceWithHub } from "~/server/hub.service.server";
import {
	buildRequestContext,
	getRequestId,
	logError,
} from "~/server/logger.server";
import { getPublicOrigin } from "~/server/request-origin.server.ts";
import { getSetupStatus, initializeSetup } from "~/server/setup.service.server";
import { resolveSetupAppOrigin } from "~/server/setup-origin.server.ts";

export type SetupLoaderData = {
	hubAvailable: boolean;
	appBaseUrl: string;
};

export type SetupActionData = { error: string } | undefined;

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<SetupLoaderData | Response> {
	if (!hasDatabaseConfig()) {
		return redirect("/database-required");
	}

	try {
		const status = await getSetupStatus();
		if (status.isSetup) {
			return redirect("/");
		}
	} catch {
		// Keep setup UI accessible when DB is not reachable.
	}

	return {
		hubAvailable: hasHubBaseUrlConfigured(),
		appBaseUrl: getPublicOrigin(request),
	};
}

export async function action({
	request,
}: ActionFunctionArgs): Promise<SetupActionData | Response> {
	const requestId = getRequestId(request);
	if (!hasDatabaseConfig()) {
		return redirect("/database-required");
	}

	const formData = await request.formData();
	const appOrigin = resolveSetupAppOrigin(request, formData);
	const name = String(formData.get("name") ?? "").trim();
	const description = String(formData.get("description") ?? "").trim();
	const adminName = String(formData.get("adminName") ?? "").trim();
	const adminEmail = String(formData.get("adminEmail") ?? "")
		.trim()
		.toLowerCase();
	const adminPassword = String(formData.get("adminPassword") ?? "");
	const visibilityMode = (formData.get("visibilityMode") ?? "public") as
		| "public"
		| "registered"
		| "approval";
	const approvalMode = (formData.get("approvalMode") ?? "automatic") as
		| "automatic"
		| "manual";
	const hubEnabled =
		hasHubBaseUrlConfigured() &&
		String(formData.get("hubEnabled") ?? "") === "on";

	if (!name || !adminName || !adminEmail || !adminPassword) {
		return { error: "Server and admin fields are required" };
	}

	if (adminPassword.length < 8) {
		return { error: "Admin password must be at least 8 characters" };
	}

	try {
		const hubRegistration = hubEnabled
			? await registerInstanceWithHub({
					instanceName: name,
					instanceBaseUrl: appOrigin,
					redirectUri: `${appOrigin}/api/auth/oauth2/callback/hub`,
				})
			: null;

		const result = await initializeSetup({
			name,
			description: description || undefined,
			visibilityMode,
			approvalMode,
			betterAuthUrl: appOrigin,
			adminName,
			adminEmail,
			adminPassword,
			hub: {
				enabled: hubEnabled,
				oidcDiscoveryUrl: hubRegistration?.hubOidcDiscoveryUrl ?? "",
				clientId: hubRegistration?.hubClientId ?? "",
				clientSecret: hubRegistration?.hubClientSecret ?? "",
				redirectUri: hubEnabled
					? `${appOrigin}/api/auth/oauth2/callback/hub`
					: "",
				instanceName: hubEnabled ? name : "",
				instanceBaseUrl: hubEnabled ? appOrigin : "",
			},
		});

		if (!result.ok) {
			return { error: result.error };
		}

		return redirect("/");
	} catch (error) {
		void captureMonitoredError({
			event: "setup.action.failed",
			error,
			request,
		});
		logError({
			event: "setup.action.failed",
			data: {
				...buildRequestContext({ request, requestId }),
				error: error instanceof Error ? error.message : "unknown error",
			},
		});
		return {
			error: `Setup failed: ${error instanceof Error ? error.message : "unknown error"}`,
		};
	}
}
