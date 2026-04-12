import "dotenv/config";

import { ensureHostedBootstrapReady } from "../app/server/hosted-bootstrap.server.ts";

await ensureHostedBootstrapReady();
