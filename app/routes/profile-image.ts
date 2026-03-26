import type { LoaderFunctionArgs } from "react-router";

import { createProfileImageResponse } from "~/server/profile-image.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
	return createProfileImageResponse({
		request,
		userId: params.userId ?? "",
		size: params.size,
	});
}
