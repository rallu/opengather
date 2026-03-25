import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getServerConfig } from "~/server/config.service.server";
import { isHubUiEnabled } from "~/server/hub-config.server";
import { getLoopbackOriginRedirect } from "~/server/request-origin.server";
import {
	getSetupStatus,
	isSetupCompleteForRequest,
} from "~/server/setup.service.server";

export type RegisterLoaderData = {
	hubAuthEnabled: boolean;
	googleAuthEnabled: boolean;
	nextPath: string;
	reason: string;
	serverName: string;
	serverDescription: string;
};

function normalizeNextPath(raw: string | null): string {
	if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
		return "/";
	}
	return raw;
}

export async function loader({
	request,
}: LoaderFunctionArgs): Promise<RegisterLoaderData | Response> {
	const isSetup = await isSetupCompleteForRequest({ request });
	if (!isSetup) {
		return redirect("/setup");
	}

	const url = new URL(request.url);
	const config = await getServerConfig();
	const authOriginRedirect = getLoopbackOriginRedirect(
		request,
		config.betterAuthUrl,
	);
	if (authOriginRedirect) {
		return redirect(authOriginRedirect);
	}

	const setup = await getSetupStatus();
	return {
		hubAuthEnabled: isHubUiEnabled({
			hubAvailable: config.hubAvailable,
			hubEnabled: config.hubEnabled,
			hubClientId: config.hubClientId,
			hubClientSecret: config.hubClientSecret,
		}),
		googleAuthEnabled: Boolean(
			config.googleClientId && config.googleClientSecret,
		),
		nextPath: normalizeNextPath(url.searchParams.get("next")),
		reason: url.searchParams.get("reason") ?? "",
		serverName: setup.instance?.name ?? "OpenGather",
		serverDescription: setup.instance?.description ?? "",
	};
}
