import {
	encodeMcpMessage,
	handleAgentMcpRequest,
	parseNextMcpMessage,
	resolveAgentMcpConfig,
} from "../app/server/agent-mcp.server.ts";

function printHelp(): void {
	console.log(`Usage:
  OG_BASE_URL=http://localhost:5173 OG_AGENT_TOKEN=oga_xxx node --experimental-strip-types scripts/agent-mcp.ts
  node --experimental-strip-types scripts/agent-mcp.ts --base-url http://localhost:5173 --token oga_xxx

This starts a stdio MCP server that exposes the OpenGather agent API as tools.
`);
}

async function main(): Promise<void> {
	const config = resolveAgentMcpConfig({
		env: process.env,
		argv: process.argv.slice(2),
	});
	if (!config.baseUrl || !config.token) {
		printHelp();
		if (process.argv.slice(2).length > 0) {
			process.exitCode = 1;
		}
		return;
	}

	let buffer = Buffer.alloc(0);

	process.stdin.on("data", async (chunk: Buffer | string) => {
		buffer = Buffer.concat([
			buffer,
			typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk,
		]);

		while (buffer.length > 0) {
			const parsed = parseNextMcpMessage(buffer);
			if (!parsed.message) {
				buffer = parsed.rest;
				break;
			}
			buffer = parsed.rest;

			try {
				const response = await handleAgentMcpRequest({
					message: parsed.message,
					config,
				});
				if (response) {
					process.stdout.write(encodeMcpMessage(response));
				}
			} catch (error) {
				const id =
					typeof parsed.message.id === "string" ||
					typeof parsed.message.id === "number"
						? parsed.message.id
						: null;
				process.stdout.write(
					encodeMcpMessage({
						jsonrpc: "2.0",
						id,
						error: {
							code: -32603,
							message:
								error instanceof Error ? error.message : "Internal server error",
						},
					}),
				);
			}
		}
	});

	process.stdin.resume();
}

void main();
