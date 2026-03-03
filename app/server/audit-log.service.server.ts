import { randomUUID } from "node:crypto";
import { logError } from "./logger.server.ts";
import { getRequestIp } from "./rate-limit.server.ts";

export type AuditActor = {
	id?: string;
	type: "user" | "system";
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
					actorType: "user" | "system";
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
	const db = params.db ?? (await import("./db.server.ts")).getDb();
	const instanceId = (() => {
		if (params.instanceId !== undefined) {
			return Promise.resolve(params.instanceId);
		}
		return import("./setup.service.server.ts").then((module) =>
			module.getSetupInstanceId(),
		);
	})();
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
			instanceId: await instanceId,
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
					actorType: "user" | "system";
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
