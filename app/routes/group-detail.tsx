import {
	useActionData,
	useLoaderData,
	useLocation,
	useNavigation,
} from "react-router";
import type {
	action,
	GroupDetailPostSuccessAction,
} from "./group-detail/action.server";
import { GroupDetailPage } from "./group-detail/group-page";
import type { loader } from "./group-detail/loader.server";

export { action } from "./group-detail/action.server";
export { loader } from "./group-detail/loader.server";

function isSuccessfulPostAction(
	actionData: ReturnType<typeof useActionData<typeof action>>,
): actionData is GroupDetailPostSuccessAction {
	return Boolean(
		actionData &&
			"ok" in actionData &&
			actionData.ok &&
			actionData.actionType === "post" &&
			"createdPost" in actionData &&
			actionData.createdPost,
	);
}

export default function GroupDetailRoute() {
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
		<GroupDetailPage
			data={data}
			errorMessage={
				actionData && "error" in actionData ? actionData.error : undefined
			}
			loading={navigation.state === "submitting"}
			message={
				actionData &&
				"message" in actionData &&
				typeof actionData.message === "string"
					? actionData.message
					: undefined
			}
			pathname={location.pathname}
			priorityPost={priorityPost}
		/>
	);
}
