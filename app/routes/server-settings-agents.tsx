import { useActionData, useLoaderData } from "react-router";
import { ServerSettingsAgentsPage } from "./server-settings-agents/agents-page";
import type { action, loader } from "./server-settings-agents/route.server";

export { action, loader } from "./server-settings-agents/route.server";

export default function ServerSettingsAgents() {
	return (
		<ServerSettingsAgentsPage
			actionData={useActionData<typeof action>()}
			data={useLoaderData<typeof loader>()}
		/>
	);
}
