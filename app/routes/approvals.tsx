import { useActionData, useLoaderData, useNavigation } from "react-router";
import { ApprovalsPage } from "./approvals/approvals-page";
import type { action, loader } from "./approvals/route.server";

export { action, loader } from "./approvals/route.server";

export default function ApprovalsRoute() {
	const navigation = useNavigation();

	return (
		<ApprovalsPage
			actionData={useActionData<typeof action>()}
			data={useLoaderData<typeof loader>()}
			loading={navigation.state === "submitting"}
		/>
	);
}
