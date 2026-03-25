import { useActionData, useLoaderData } from "react-router";
import type { action, loader } from "./server-settings/route.server";
import { ServerSettingsPage } from "./server-settings/server-settings-page";

export { action, loader } from "./server-settings/route.server";

export default function ServerSettings() {
	return (
		<ServerSettingsPage
			actionData={useActionData<typeof action>()}
			data={useLoaderData<typeof loader>()}
		/>
	);
}
