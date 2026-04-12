import assert from "node:assert/strict";
import test from "node:test";

import { parseConfigValue } from "./config.schema.server.ts";

test("parseConfigValue accepts s3 media storage driver", () => {
	assert.equal(parseConfigValue("media_storage_driver", "s3"), "s3");
	assert.equal(parseConfigValue("media_storage_driver", "local"), "local");
});
