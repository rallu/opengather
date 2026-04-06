import {
	createAgent,
	disableAgent,
	rotateAgentToken,
} from "../app/server/agent.service.server.ts";

type ParsedCommand =
	| {
			command: "help";
	  }
	| {
			command: "create";
			displayName: string;
			displayLabel?: string;
			description?: string;
			role?: string;
			instanceId?: string;
			createdByUserId?: string;
			instanceRole?: "member" | "moderator" | "admin";
			groupMemberships: Array<{
				groupId: string;
				role: "member" | "moderator" | "admin" | "owner";
			}>;
			grants: Array<{
				resourceType: string;
				resourceId: string;
				scope: string;
			}>;
	  }
	| {
			command: "rotate";
			agentId: string;
	  }
	| {
			command: "disable";
			agentId: string;
	  };

function printHelp(): void {
	console.log(`Usage:
  node --experimental-strip-types scripts/bootstrap-agent.ts create --display-name "Codex" [--display-label "Codex agent"] [--description "..."] [--role assistant] [--instance-id instance-1] [--created-by user-1] [--instance-role member] [--group group-1:member] [--grant group:group-1:group.read] [--grant group:group-1:group.post]
  node --experimental-strip-types scripts/bootstrap-agent.ts rotate --agent-id agent-1
  node --experimental-strip-types scripts/bootstrap-agent.ts disable --agent-id agent-1
`);
}

function requireValue(value: string | undefined, flag: string): string {
	if (!value) {
		throw new Error(`${flag} requires a value.`);
	}
	return value;
}

function parseGroupMembership(value: string): {
	groupId: string;
	role: "member" | "moderator" | "admin" | "owner";
} {
	const [groupId, role] = value.split(":");
	if (
		!groupId ||
		(role !== "member" &&
			role !== "moderator" &&
			role !== "admin" &&
			role !== "owner")
	) {
		throw new Error("--group must use groupId:role.");
	}
	return { groupId, role };
}

function parseGrant(value: string): {
	resourceType: string;
	resourceId: string;
	scope: string;
} {
	const [resourceType, resourceId, scope] = value.split(":");
	if (!resourceType || !resourceId || !scope) {
		throw new Error("--grant must use resourceType:resourceId:scope.");
	}
	return { resourceType, resourceId, scope };
}

export function parseAgentBootstrapArgs(argv: string[]): ParsedCommand {
	const [command, ...rest] = argv;
	if (!command || command === "help" || command === "--help" || command === "-h") {
		return { command: "help" };
	}

	if (command === "rotate" || command === "disable") {
		let agentId = "";
		for (let index = 0; index < rest.length; index += 1) {
			if (rest[index] === "--agent-id") {
				agentId = requireValue(rest[index + 1], "--agent-id");
				index += 1;
			}
		}
		if (!agentId) {
			throw new Error("--agent-id is required.");
		}
		return { command, agentId };
	}

	if (command !== "create") {
		throw new Error(`Unsupported command: ${command}`);
	}

	let displayName = "";
	let displayLabel: string | undefined;
	let description: string | undefined;
	let role: string | undefined;
	let instanceId: string | undefined;
	let createdByUserId: string | undefined;
	let instanceRole: "member" | "moderator" | "admin" | undefined;
	const groupMemberships: ParsedCommand["groupMemberships"] = [];
	const grants: ParsedCommand["grants"] = [];

	for (let index = 0; index < rest.length; index += 1) {
		const flag = rest[index];
		switch (flag) {
			case "--display-name":
				displayName = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--display-label":
				displayLabel = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--description":
				description = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--role":
				role = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--instance-id":
				instanceId = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--created-by":
				createdByUserId = requireValue(rest[index + 1], flag);
				index += 1;
				break;
			case "--instance-role": {
				const value = requireValue(rest[index + 1], flag);
				if (value !== "member" && value !== "moderator" && value !== "admin") {
					throw new Error("--instance-role must be member, moderator, or admin.");
				}
				instanceRole = value;
				index += 1;
				break;
			}
			case "--group":
				groupMemberships.push(
					parseGroupMembership(requireValue(rest[index + 1], flag)),
				);
				index += 1;
				break;
			case "--grant":
				grants.push(parseGrant(requireValue(rest[index + 1], flag)));
				index += 1;
				break;
			default:
				throw new Error(`Unsupported flag: ${flag}`);
		}
	}

	if (!displayName.trim()) {
		throw new Error("--display-name is required.");
	}

	return {
		command: "create",
		displayName,
		displayLabel,
		description,
		role,
		instanceId,
		createdByUserId,
		instanceRole,
		groupMemberships,
		grants,
	};
}

async function main(): Promise<void> {
	try {
		const parsed = parseAgentBootstrapArgs(process.argv.slice(2));
		if (parsed.command === "help") {
			printHelp();
			return;
		}

		if (parsed.command === "create") {
			const result = await createAgent(parsed);
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		if (parsed.command === "rotate") {
			const result = await rotateAgentToken({ agentId: parsed.agentId });
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		const result = await disableAgent({ agentId: parsed.agentId });
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : "unknown error");
		process.exitCode = 1;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	void main();
}
