import {
	cleanupParsedMultipartForm,
	parseMultipartForm,
	type ParsedMultipartForm,
} from "../multipart-form.server.ts";
import {
	MAX_IMAGES_PER_POST,
	MAX_VIDEO_BYTES,
	parseAlbumTagsInput,
} from "./shared.ts";

export async function extractPostUploadsFromMultipartRequest(params: {
	request: Request;
	maxFiles?: number;
}): Promise<{
	actionType: string;
	bodyText: string;
	parentPostId?: string;
	albumTags: string[];
	uploads: ParsedMultipartForm["files"];
	cleanup(): Promise<void>;
}> {
	const parsed = await parseMultipartForm({
		request: params.request,
		maxFiles: params.maxFiles ?? MAX_IMAGES_PER_POST,
		maxFileSizeBytes: MAX_VIDEO_BYTES,
	});
	try {
		const actionType = (parsed.fields.get("_action") ?? "").trim();
		const bodyText = (parsed.fields.get("bodyText") ?? "").trim();
		const parentPostId =
			(parsed.fields.get("parentPostId") ?? "").trim() || undefined;
		const albumTags = parseAlbumTagsInput(parsed.fields.get("assetAlbums"));
		const uploads = parsed.files.filter((file) => file.fieldName === "assets");
		return {
			actionType,
			bodyText,
			parentPostId,
			albumTags,
			uploads,
			async cleanup() {
				await cleanupParsedMultipartForm(parsed);
			},
		};
	} catch (error) {
		await cleanupParsedMultipartForm(parsed);
		throw error;
	}
}
