import { runCommandJson } from "./commands.ts";
import type { ProbedVideo } from "./shared.ts";

export async function probeVideo(filePath: string): Promise<ProbedVideo> {
	const result = await runCommandJson<{
		streams?: Array<{
			codec_type?: string;
			width?: number;
			height?: number;
			duration?: string;
		}>;
		format?: { duration?: string };
	}>("ffprobe", [
		"-v",
		"error",
		"-show_streams",
		"-show_format",
		"-print_format",
		"json",
		filePath,
	]);

	const videoStream = result.streams?.find(
		(stream) => stream.codec_type === "video",
	);
	if (!videoStream?.width || !videoStream.height) {
		throw new Error("Uploaded video does not contain a readable video stream");
	}

	const durationSeconds = Number(
		videoStream.duration ?? result.format?.duration ?? 0,
	);
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		throw new Error("Uploaded video duration could not be determined");
	}

	return {
		durationSeconds,
		width: videoStream.width,
		height: videoStream.height,
	};
}
