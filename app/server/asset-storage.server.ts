import { createReadStream, createWriteStream } from "node:fs";
import { cp, mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
} from "@aws-sdk/client-s3";

import { getConfig } from "./config.service.server.ts";
import { getAppEnv, getMediaS3Env } from "./env.server.ts";

export type StoredObjectInfo = {
	byteSize: number;
};

export type AssetStorage = {
	driver: "local" | "s3";
	writeBuffer(params: {
		key: string;
		buffer: Buffer | Uint8Array;
	}): Promise<StoredObjectInfo>;
	writeStream(params: {
		key: string;
		stream: NodeJS.ReadableStream;
	}): Promise<StoredObjectInfo>;
	readBuffer(params: { key: string }): Promise<Buffer>;
	createReadStream(params: { key: string }): Promise<Readable>;
	deleteObject(params: { key: string }): Promise<void>;
	deletePrefix(params: { prefix: string }): Promise<void>;
	statObject(params: { key: string }): Promise<StoredObjectInfo | null>;
	materializeToFile(params: { key: string; filePath: string }): Promise<void>;
};

function normalizeStorageKey(key: string): string {
	const normalized = path.posix.normalize(key).replace(/^\/+/, "");
	if (
		!normalized ||
		normalized === "." ||
		normalized.split("/").some((segment) => segment === "..")
	) {
		throw new Error("Invalid storage key");
	}
	return normalized;
}

async function ensureParentDir(filePath: string) {
	await mkdir(path.dirname(filePath), { recursive: true });
}

function isS3NotFoundError(error: unknown): boolean {
	if (!(error instanceof S3ServiceException)) {
		return false;
	}

	return (
		error.$metadata.httpStatusCode === 404 ||
		error.name === "NotFound" ||
		error.name === "NoSuchKey"
	);
}

function toNodeReadableStream(body: unknown): Readable {
	if (body && typeof body === "object" && "pipe" in body) {
		return body as Readable;
	}

	if (
		body &&
		typeof body === "object" &&
		"transformToWebStream" in body &&
		typeof body.transformToWebStream === "function"
	) {
		return Readable.fromWeb(
			(
				body as { transformToWebStream(): ReadableStream }
			).transformToWebStream() as import("node:stream/web").ReadableStream,
		);
	}

	throw new Error("S3 response body is not a readable stream");
}

async function readS3BodyToBuffer(body: unknown): Promise<Buffer> {
	if (
		body &&
		typeof body === "object" &&
		"transformToByteArray" in body &&
		typeof body.transformToByteArray === "function"
	) {
		return Buffer.from(
			await (
				body as {
					transformToByteArray(): Promise<Uint8Array>;
				}
			).transformToByteArray(),
		);
	}

	const chunks: Buffer[] = [];
	for await (const chunk of toNodeReadableStream(body)) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

async function resolveMediaRoot(): Promise<string> {
	const configuredRoot = await getConfig("media_local_root");
	return path.resolve(process.cwd(), configuredRoot);
}

async function resolveAbsolutePath(key: string): Promise<string> {
	const safeKey = normalizeStorageKey(key);
	const root = await resolveMediaRoot();
	const absolutePath = path.resolve(root, safeKey);
	if (!absolutePath.startsWith(root)) {
		throw new Error("Resolved path escaped media root");
	}
	return absolutePath;
}

function createS3Client() {
	const env = getMediaS3Env();
	if (
		!env.bucket ||
		!env.region ||
		!env.endpoint ||
		!env.accessKeyId ||
		!env.secretAccessKey
	) {
		throw new Error(
			"S3 media storage requires MEDIA_S3_BUCKET, MEDIA_S3_REGION, MEDIA_S3_ENDPOINT, MEDIA_S3_ACCESS_KEY_ID, and MEDIA_S3_SECRET_ACCESS_KEY",
		);
	}

	return {
		bucket: env.bucket,
		client: new S3Client({
			region: env.region,
			endpoint: env.endpoint,
			forcePathStyle: env.forcePathStyle,
			credentials: {
				accessKeyId: env.accessKeyId,
				secretAccessKey: env.secretAccessKey,
			},
		}),
	};
}

export async function getAssetStorage(): Promise<AssetStorage> {
	const driver = await getConfig("media_storage_driver");
	if (driver === "local") {
		return {
			driver: "local",
			async writeBuffer(params) {
				const filePath = await resolveAbsolutePath(params.key);
				await ensureParentDir(filePath);
				const buffer = Buffer.isBuffer(params.buffer)
					? params.buffer
					: Buffer.from(params.buffer);
				await writeFile(filePath, buffer);
				return { byteSize: buffer.byteLength };
			},
			async writeStream(params) {
				const filePath = await resolveAbsolutePath(params.key);
				await ensureParentDir(filePath);

				let byteSize = 0;
				const counter = new Transform({
					transform(chunk, _encoding, callback) {
						byteSize += Buffer.byteLength(chunk);
						callback(null, chunk);
					},
				});

				await pipeline(params.stream, counter, createWriteStream(filePath));
				return { byteSize };
			},
			async readBuffer(params) {
				const filePath = await resolveAbsolutePath(params.key);
				return readFile(filePath);
			},
			async createReadStream(params) {
				const filePath = await resolveAbsolutePath(params.key);
				return createReadStream(filePath);
			},
			async deleteObject(params) {
				const filePath = await resolveAbsolutePath(params.key);
				await unlink(filePath).catch((error: unknown) => {
					if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
						return;
					}
					throw error;
				});
			},
			async deletePrefix(params) {
				const prefixPath = await resolveAbsolutePath(params.prefix);
				await rm(prefixPath, { recursive: true, force: true });
			},
			async statObject(params) {
				try {
					const filePath = await resolveAbsolutePath(params.key);
					const fileStat = await stat(filePath);
					if (!fileStat.isFile()) {
						return null;
					}
					return { byteSize: fileStat.size };
				} catch (error) {
					if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
						return null;
					}
					throw error;
				}
			},
			async materializeToFile(params) {
				const filePath = await resolveAbsolutePath(params.key);
				await ensureParentDir(params.filePath);
				await cp(filePath, params.filePath);
			},
		};
	}

	if (driver === "s3") {
		const { client, bucket } = createS3Client();
		return {
			driver: "s3",
			async writeBuffer(params) {
				const key = normalizeStorageKey(params.key);
				const buffer = Buffer.isBuffer(params.buffer)
					? params.buffer
					: Buffer.from(params.buffer);
				await client.send(
					new PutObjectCommand({
						Bucket: bucket,
						Key: key,
						Body: buffer,
						ContentLength: buffer.byteLength,
					}),
				);
				return { byteSize: buffer.byteLength };
			},
			async writeStream(params) {
				const key = normalizeStorageKey(params.key);
				let byteSize = 0;
				const counter = new Transform({
					transform(chunk, _encoding, callback) {
						byteSize += Buffer.byteLength(chunk);
						callback(null, chunk);
					},
				});
				await client.send(
					new PutObjectCommand({
						Bucket: bucket,
						Key: key,
						Body: params.stream.pipe(counter),
					}),
				);
				return { byteSize };
			},
			async readBuffer(params) {
				const key = normalizeStorageKey(params.key);
				const response = await client.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: key,
					}),
				);
				return readS3BodyToBuffer(response.Body);
			},
			async createReadStream(params) {
				const key = normalizeStorageKey(params.key);
				const response = await client.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: key,
					}),
				);
				return toNodeReadableStream(response.Body);
			},
			async deleteObject(params) {
				const key = normalizeStorageKey(params.key);
				await client
					.send(
						new DeleteObjectCommand({
							Bucket: bucket,
							Key: key,
						}),
					)
					.catch((error: unknown) => {
						if (isS3NotFoundError(error)) {
							return;
						}
						throw error;
					});
			},
			async deletePrefix(params) {
				const prefix = normalizeStorageKey(params.prefix).replace(/\/?$/, "/");
				let continuationToken: string | undefined;

				for (;;) {
					const listed = await client.send(
						new ListObjectsV2Command({
							Bucket: bucket,
							Prefix: prefix,
							ContinuationToken: continuationToken,
						}),
					);
					const objects =
						listed.Contents?.flatMap((item) =>
							item.Key ? [{ Key: item.Key }] : [],
						) ?? [];

					if (objects.length > 0) {
						await client.send(
							new DeleteObjectsCommand({
								Bucket: bucket,
								Delete: { Objects: objects },
							}),
						);
					}

					if (!listed.IsTruncated || !listed.NextContinuationToken) {
						break;
					}
					continuationToken = listed.NextContinuationToken;
				}
			},
			async statObject(params) {
				const key = normalizeStorageKey(params.key);
				try {
					const response = await client.send(
						new HeadObjectCommand({
							Bucket: bucket,
							Key: key,
						}),
					);
					return {
						byteSize: response.ContentLength ?? 0,
					};
				} catch (error) {
					if (isS3NotFoundError(error)) {
						return null;
					}
					throw error;
				}
			},
			async materializeToFile(params) {
				const key = normalizeStorageKey(params.key);
				await ensureParentDir(params.filePath);
				const response = await client.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: key,
					}),
				);
				await pipeline(
					toNodeReadableStream(response.Body),
					createWriteStream(params.filePath),
				);
			},
		};
	}

	throw new Error(`Unsupported media storage driver: ${driver}`);
}

export function getAssetDirectoryPrefix(params: { assetId: string }): string {
	return `assets/${params.assetId}`;
}

export async function ensureMediaRootExists(): Promise<string> {
	const driver = await getConfig("media_storage_driver");
	if (driver !== "local") {
		return getAppEnv().MEDIA_LOCAL_ROOT;
	}

	const root = await resolveMediaRoot();
	await mkdir(root, { recursive: true });
	return root;
}
