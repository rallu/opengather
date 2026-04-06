import { useActionData, useLoaderData } from "react-router";
import { ServerSettingsAgentsPage } from "./server-settings-agents/agents-page";
import type {
	action,
	loader,
	ServerSettingsAgentsActionData,
	ServerSettingsAgentsLoaderData,
} from "./server-settings-agents/route.server";

export { action, loader } from "./server-settings-agents/route.server";

export default function ServerSettingsAgents() {
	return (
		<ServerSettingsAgentsPage
			actionData={
				useActionData<typeof action>() as ServerSettingsAgentsActionData
			}
			data={useLoaderData<typeof loader>() as ServerSettingsAgentsLoaderData}
		/>
	);
}
