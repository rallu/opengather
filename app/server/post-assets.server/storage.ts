import { createReadStream } from "node:fs";

import type { AssetStorage } from "../asset-storage.server.ts";

export async function writeFileToStorage(params: {
	storage: AssetStorage;
	key: string;
	filePath: string;
}): Promise<number> {
	const result = await params.storage.writeStream({
		key: params.key,
		stream: createReadStream(params.filePath),
	});
	return result.byteSize;
}

export async function writeGeneratedFile(params: {
	storage: AssetStorage;
	filePath: string;
	storageKey: string;
}): Promise<number> {
	return writeFileToStorage({
		storage: params.storage,
		key: params.storageKey,
		filePath: params.filePath,
	});
}
