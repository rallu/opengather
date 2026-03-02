import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { createHubAuthorizeUrl } from "~/server/hub.service.server";
import { isSetupCompleteForRequest } from "~/server/setup.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const isSetup = await isSetupCompleteForRequest({ request });
	if (!isSetup) {
		return redirect("/setup");
	}

	const state = crypto.randomUUID();
	const url = await createHubAuthorizeUrl({ state });
	return redirect(url);
}

export default function HubLogin() {
	return null;
}
