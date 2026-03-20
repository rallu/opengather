import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import Busboy from "busboy";

export type ParsedMultipartFile = {
	fieldName: string;
	filename: string;
	mimeType: string;
	byteSize: number;
	tempFilePath: string;
};

export type ParsedMultipartForm = {
	fields: Map<string, string>;
	files: ParsedMultipartFile[];
	tempDir: string;
};

export async function cleanupParsedMultipartForm(
	form: ParsedMultipartForm | null | undefined,
): Promise<void> {
	if (!form) {
		return;
	}
	await rm(form.tempDir, { recursive: true, force: true });
}

function getHeaderRecord(headers: Headers): Record<string, string> {
	return Object.fromEntries(headers.entries());
}

export async function parseMultipartForm(params: {
	request: Request;
	maxFiles: number;
	maxFileSizeBytes: number;
}): Promise<ParsedMultipartForm> {
	const contentType = params.request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		throw new Error("Expected multipart/form-data request");
	}
	if (!params.request.body) {
		throw new Error("Missing multipart body");
	}

	const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengather-upload-"));
	const form: ParsedMultipartForm = {
		fields: new Map(),
		files: [],
		tempDir,
	};

	try {
		await new Promise<void>((resolve, reject) => {
			const busboy = Busboy({
				headers: getHeaderRecord(params.request.headers),
				limits: {
					files: params.maxFiles,
					fileSize: params.maxFileSizeBytes,
				},
			});
			const pendingWrites: Promise<void>[] = [];

			busboy.on("field", (fieldName, value) => {
				form.fields.set(fieldName, value);
			});

			busboy.on("file", (fieldName, stream, info) => {
				const originalFilename = info.filename?.trim() ?? "";
				const filename = originalFilename || `${randomUUID()}.bin`;
				const safeName = filename.replace(/[^\w.-]+/g, "-");
				const tempFilePath = path.join(
					tempDir,
					`${form.files.length}-${safeName || `${randomUUID()}.bin`}`,
				);
				let byteSize = 0;
				let hitLimit = false;

				stream.on("data", (chunk) => {
					byteSize += Buffer.byteLength(chunk);
				});
				stream.on("limit", () => {
					hitLimit = true;
				});

				const writePromise = pipeline(
					stream,
					createWriteStream(tempFilePath),
				).then(async () => {
					if (!originalFilename && byteSize === 0) {
						await unlink(tempFilePath).catch(() => undefined);
						return;
					}

					if (hitLimit) {
						await unlink(tempFilePath).catch(() => undefined);
						throw new Error(
							`File exceeds ${params.maxFileSizeBytes} byte limit`,
						);
					}

					form.files.push({
						fieldName,
						filename,
						mimeType: info.mimeType || "application/octet-stream",
						byteSize,
						tempFilePath,
					});
				});
				pendingWrites.push(writePromise);
			});

			busboy.on("filesLimit", () => {
				reject(new Error(`Too many files. Maximum is ${params.maxFiles}.`));
			});
			busboy.on("error", reject);
			busboy.on("finish", () => {
				Promise.all(pendingWrites)
					.then(() => resolve())
					.catch(reject);
			});

			const bodyStream = Readable.fromWeb(params.request.body as never);
			bodyStream.pipe(busboy);
		});

		return form;
	} catch (error) {
		await cleanupParsedMultipartForm(form);
		throw error;
	}
}
