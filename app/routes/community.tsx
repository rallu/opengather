import {
	useActionData,
	useLoaderData,
	useLocation,
	useNavigation,
} from "react-router";
import type {
	action,
	CommunityPostSuccessAction,
} from "./community/action.server";
import { CommunityPage } from "./community/community-page";
import type { loader } from "./community/loader.server";

export { action } from "./community/action.server";
export { loader } from "./community/loader.server";

function isSuccessfulPostAction(
	actionData: ReturnType<typeof useActionData<typeof action>>,
): actionData is CommunityPostSuccessAction {
	return Boolean(
		actionData &&
			"ok" in actionData &&
			actionData.ok &&
			actionData.actionType === "post" &&
			"createdPost" in actionData &&
			actionData.createdPost,
	);
}

export default function CommunityRoute() {
	const actionData = useActionData<typeof action>();
	const data = useLoaderData<typeof loader>();
	const location = useLocation();
	const navigation = useNavigation();
	const successfulPostAction = isSuccessfulPostAction(actionData)
		? actionData
		: null;
	const priorityPost =
		successfulPostAction?.createdPost.parentPostId === undefined
			? successfulPostAction?.createdPost
			: undefined;

	return (
		<CommunityPage
			data={data}
			errorMessage={
				actionData && "error" in actionData ? actionData.error : undefined
			}
			loading={navigation.state === "submitting"}
			pathname={location.pathname}
			priorityPost={priorityPost}
		/>
	);
}
