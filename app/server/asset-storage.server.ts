import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { getConfig } from "./config.service.server.ts";

export type StoredObjectInfo = {
	byteSize: number;
};

export type AssetStorage = {
	driver: "local";
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
	resolvePath(params: { key: string }): Promise<string>;
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

export async function getAssetStorage(): Promise<AssetStorage> {
	const driver = await getConfig("media_storage_driver");
	if (driver !== "local") {
		throw new Error(`Unsupported media storage driver: ${driver}`);
	}

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
		async resolvePath(params) {
			return resolveAbsolutePath(params.key);
		},
	};
}

export function getAssetDirectoryPrefix(params: { assetId: string }): string {
	return `assets/${params.assetId}`;
}

export async function ensureMediaRootExists(): Promise<string> {
	const root = await resolveMediaRoot();
	await mkdir(root, { recursive: true });
	return root;
}
