import { useActionData, useLoaderData, useNavigation } from "react-router";
import { SetupPage } from "./setup/setup-page";
import { action, loader } from "./setup/route.server";

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
