import { useActionData, useLoaderData, useNavigation } from "react-router";
import type { action, loader } from "./setup/route.server";
import { SetupPage } from "./setup/setup-page";

export { action, loader } from "./setup/route.server";

export default function SetupWizard() {
	const navigation = useNavigation();

	return (
		<SetupPage
			actionData={useActionData<typeof action>()}
			data={useLoaderData<typeof loader>()}
			loading={navigation.state === "submitting"}
		/>
	);
}
