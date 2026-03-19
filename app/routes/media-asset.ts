import type { LoaderFunctionArgs } from "react-router";

import { createMediaResponse } from "~/server/post-assets.server.ts";

export async function loader({ request, params }: LoaderFunctionArgs) {
	const assetId = params.assetId ?? "";
	const variantKey = params.variantKey ?? "";
	return createMediaResponse({
		request,
		assetId,
		variantKey,
	});
}
