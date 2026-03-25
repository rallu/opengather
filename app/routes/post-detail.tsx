import { useActionData, useLoaderData, useNavigation } from "react-router";
import { PostDetailPage } from "./post-detail/post-detail-page";
import { action, loader } from "./post-detail/route.server";

export { action, loader } from "./post-detail/route.server";

export default function PostDetailRoute() {
	const navigation = useNavigation();
	const actionData = useActionData<typeof action>();

	return (
		<PostDetailPage
			actionData={actionData && "error" in actionData ? actionData : undefined}
			data={useLoaderData<typeof loader>()}
			loading={navigation.state === "submitting"}
		/>
	);
}
