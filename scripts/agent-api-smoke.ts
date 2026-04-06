type ParsedSmokeCommand =
	| {
			command: "help";
	  }
	| {
			command: "run";
			baseUrl: string;
			token: string;
			groupId?: string;
			bodyText: string;
			skipWrite: boolean;
			forbiddenPath?: string;
			forbiddenStatus: number;
	  };

export function parseAgentApiSmokeArgs(argv: string[]): ParsedSmokeCommand {
	if (
		argv.length === 0 ||
		argv.includes("--help") ||
		argv.includes("-h") ||
		argv[0] === "help"
	) {
		return { command: "help" };
	}

	let baseUrl = "";
	let token = "";
	let groupId: string | undefined;
	let bodyText = "Codex smoke test post";
	let skipWrite = false;
	let forbiddenPath: string | undefined;
	let forbiddenStatus = 403;

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		switch (flag) {
			case "--base-url":
				baseUrl = argv[index + 1] ?? "";
				index += 1;
				break;
			case "--token":
				token = argv[index + 1] ?? "";
				index += 1;
				break;
			case "--group-id":
				groupId = argv[index + 1] ?? "";
				index += 1;
				break;
			case "--body":
				bodyText = argv[index + 1] ?? "";
				index += 1;
				break;
			case "--skip-write":
				skipWrite = true;
				break;
			case "--forbidden-path":
				forbiddenPath = argv[index + 1] ?? "";
				index += 1;
				break;
			case "--forbidden-status":
				forbiddenStatus = Number.parseInt(argv[index + 1] ?? "", 10);
				index += 1;
				break;
			default:
				throw new Error(`Unsupported flag: ${flag}`);
		}
	}

	if (!baseUrl.trim()) {
		throw new Error("--base-url is required.");
	}
	if (!token.trim()) {
		throw new Error("--token is required.");
	}

	return {
		command: "run",
		baseUrl: baseUrl.replace(/\/+$/, ""),
		token,
		groupId: groupId?.trim() || undefined,
		bodyText,
		skipWrite,
		forbiddenPath: forbiddenPath?.trim() || undefined,
		forbiddenStatus:
			Number.isFinite(forbiddenStatus) && forbiddenStatus > 0
				? forbiddenStatus
				: 403,
	};
}

function printHelp(): void {
	console.log(`Usage:
  node --experimental-strip-types scripts/agent-api-smoke.ts --base-url http://localhost:5173 --token oga_xxx [--group-id group-1] [--body "Codex smoke test"] [--skip-write] [--forbidden-path /api/agents/v1/groups/group-2/posts] [--forbidden-status 403]

Behavior:
  1. GET /api/agents/v1/me
  2. GET /api/agents/v1/groups
  3. POST /api/agents/v1/feed/posts or /api/agents/v1/groups/:groupId/posts unless --skip-write is used
  4. Optionally assert one forbidden route returns the expected status
`);
}

export async function requestJson(params: {
	baseUrl: string;
	token: string;
	path: string;
	method?: "GET" | "POST";
	body?: Record<string, unknown>;
	fetchFn?: typeof fetch;
}): Promise<{
	status: number;
	body: unknown;
}> {
	const response = await (params.fetchFn ?? fetch)(
		`${params.baseUrl}${params.path}`,
		{
			method: params.method ?? "GET",
			headers: {
				authorization: `Bearer ${params.token}`,
				"content-type": "application/json",
			},
			body: params.body ? JSON.stringify(params.body) : undefined,
		},
	);

	const data = await response.json();
	return {
		status: response.status,
		body: data,
	};
}

export async function runAgentApiSmoke(params: {
	command: Extract<ParsedSmokeCommand, { command: "run" }>;
	fetchFn?: typeof fetch;
}): Promise<{
	ok: true;
	me: unknown;
	groups: unknown;
	write: unknown;
	forbidden: unknown;
}> {
	const meResponse = await requestJson({
		baseUrl: params.command.baseUrl,
		token: params.command.token,
		path: "/api/agents/v1/me",
		fetchFn: params.fetchFn,
	});
	if (meResponse.status !== 200) {
		throw new Error(
			`GET /api/agents/v1/me failed with ${meResponse.status}: ${JSON.stringify(meResponse.body)}`,
		);
	}

	const groupsResponse = await requestJson({
		baseUrl: params.command.baseUrl,
		token: params.command.token,
		path: "/api/agents/v1/groups",
		fetchFn: params.fetchFn,
	});
	if (groupsResponse.status !== 200) {
		throw new Error(
			`GET /api/agents/v1/groups failed with ${groupsResponse.status}: ${JSON.stringify(groupsResponse.body)}`,
		);
	}

	let write: unknown = { skipped: true };
	if (!params.command.skipWrite) {
		const writeResponse = await requestJson({
			baseUrl: params.command.baseUrl,
			token: params.command.token,
			path: params.command.groupId
				? `/api/agents/v1/groups/${params.command.groupId}/posts`
				: "/api/agents/v1/feed/posts",
			method: "POST",
			body: {
				bodyText: params.command.bodyText,
			},
			fetchFn: params.fetchFn,
		});
		if (writeResponse.status < 200 || writeResponse.status >= 300) {
			throw new Error(
				`POST ${params.command.groupId ? `/api/agents/v1/groups/${params.command.groupId}/posts` : "/api/agents/v1/feed/posts"} failed with ${writeResponse.status}: ${JSON.stringify(writeResponse.body)}`,
			);
		}
		write = writeResponse.body;
	}

	let forbidden: unknown = { skipped: true };
	if (params.command.forbiddenPath) {
		const forbiddenResponse = await requestJson({
			baseUrl: params.command.baseUrl,
			token: params.command.token,
			path: params.command.forbiddenPath,
			method: "POST",
			body: {
				bodyText: params.command.bodyText,
			},
			fetchFn: params.fetchFn,
		});
		if (forbiddenResponse.status !== params.command.forbiddenStatus) {
			throw new Error(
				`POST ${params.command.forbiddenPath} expected ${params.command.forbiddenStatus} but got ${forbiddenResponse.status}: ${JSON.stringify(forbiddenResponse.body)}`,
			);
		}
		forbidden = forbiddenResponse.body;
	}

	return {
		ok: true,
		me: meResponse.body,
		groups: groupsResponse.body,
		write,
		forbidden,
	};
}

async function main(): Promise<void> {
	try {
		const parsed = parseAgentApiSmokeArgs(process.argv.slice(2));
		if (parsed.command === "help") {
			printHelp();
			return;
		}

		const result = await runAgentApiSmoke({
			command: parsed,
		});
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : "unknown error");
		process.exitCode = 1;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	void main();
}
