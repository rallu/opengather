import { randomUUID } from "node:crypto";
import { getDb } from "./db.server.ts";
import { logError } from "./logger.server.ts";
import { getRequestIp } from "./rate-limit.server.ts";
import { getSetupInstanceId } from "./setup.service.server.ts";

export type AuditActor = {
	id?: string;
	type: "agent" | "user" | "system";
};

export async function writeAuditLog(params: {
	action: string;
	actor: AuditActor;
	resourceType?: string;
	resourceId?: string;
	request?: Request;
	payload?: Record<string, unknown>;
	db?: {
		auditLog: {
			create: (args: {
				data: {
					id: string;
					instanceId: string | null;
					actorId: string | undefined;
					actorType: "agent" | "user" | "system";
					action: string;
					resourceType: string | undefined;
					resourceId: string | undefined;
					payload: Record<string, unknown>;
				};
			}) => Promise<unknown>;
		};
	};
	instanceId?: string | null;
}): Promise<void> {
	const db = params.db ?? getDb();
	const instanceId =
		params.instanceId !== undefined
			? params.instanceId
			: await getSetupInstanceId();
	const requestContext = params.request
		? {
				method: params.request.method,
				path: new URL(params.request.url).pathname,
				ip: getRequestIp(params.request),
				userAgent: params.request.headers.get("user-agent") ?? null,
			}
		: null;

	await db.auditLog.create({
		data: {
			id: randomUUID(),
			instanceId,
			actorId: params.actor.id,
			actorType: params.actor.type,
			action: params.action,
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			payload: {
				request: requestContext,
				...(params.payload ?? {}),
			},
		},
	});
}

export async function writeAuditLogSafely(params: {
	action: string;
	actor: AuditActor;
	resourceType?: string;
	resourceId?: string;
	request?: Request;
	payload?: Record<string, unknown>;
	db?: {
		auditLog: {
			create: (args: {
				data: {
					id: string;
					instanceId: string | null;
					actorId: string | undefined;
					actorType: "agent" | "user" | "system";
					action: string;
					resourceType: string | undefined;
					resourceId: string | undefined;
					payload: Record<string, unknown>;
				};
			}) => Promise<unknown>;
		};
	};
	instanceId?: string | null;
}): Promise<void> {
	try {
		await writeAuditLog(params);
	} catch (error) {
		logError({
			event: "audit_log.write_failed",
			data: {
				error: error instanceof Error ? error.message : "unknown error",
				action: params.action,
				resourceType: params.resourceType,
				resourceId: params.resourceId,
			},
		});
	}
}
