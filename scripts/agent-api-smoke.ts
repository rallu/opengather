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
	};
}

function printHelp(): void {
	console.log(`Usage:
  node --experimental-strip-types scripts/agent-api-smoke.ts --base-url http://localhost:5173 --token oga_xxx [--group-id group-1] [--body "Codex smoke test"] [--skip-write]

Behavior:
  1. GET /api/agents/v1/me
  2. GET /api/agents/v1/groups
  3. POST /api/agents/v1/feed/posts or /api/agents/v1/groups/:groupId/posts unless --skip-write is used
`);
}

async function requestJson(params: {
	baseUrl: string;
	token: string;
	path: string;
	method?: "GET" | "POST";
	body?: Record<string, unknown>;
}): Promise<unknown> {
	const response = await fetch(`${params.baseUrl}${params.path}`, {
		method: params.method ?? "GET",
		headers: {
			authorization: `Bearer ${params.token}`,
			"content-type": "application/json",
		},
		body: params.body ? JSON.stringify(params.body) : undefined,
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(
			`${params.method ?? "GET"} ${params.path} failed with ${response.status}: ${JSON.stringify(data)}`,
		);
	}

	return data;
}

async function main(): Promise<void> {
	try {
		const parsed = parseAgentApiSmokeArgs(process.argv.slice(2));
		if (parsed.command === "help") {
			printHelp();
			return;
		}

		const me = await requestJson({
			baseUrl: parsed.baseUrl,
			token: parsed.token,
			path: "/api/agents/v1/me",
		});
		const groups = await requestJson({
			baseUrl: parsed.baseUrl,
			token: parsed.token,
			path: "/api/agents/v1/groups",
		});

		let write: unknown = {
			skipped: true,
		};
		if (!parsed.skipWrite) {
			write = await requestJson({
				baseUrl: parsed.baseUrl,
				token: parsed.token,
				path: parsed.groupId
					? `/api/agents/v1/groups/${parsed.groupId}/posts`
					: "/api/agents/v1/feed/posts",
				method: "POST",
				body: {
					bodyText: parsed.bodyText,
				},
			});
		}

		console.log(
			JSON.stringify(
				{
					ok: true,
					me,
					groups,
					write,
				},
				null,
				2,
			),
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : "unknown error");
		process.exitCode = 1;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	void main();
}
