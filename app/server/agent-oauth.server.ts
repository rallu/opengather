import {
	createHash,
	randomBytes,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import { getDb } from "./db.server.ts";
import {
	type AccessTokenRecord,
	type AgentOauthDb,
	type AgentOauthTokenBundle,
	createTokenBundle,
	requireNonEmpty,
	selectAccessTokenFields,
	selectAuthorizationCodeFields,
	selectRefreshTokenFields,
} from "./agent-oauth.persistence.ts";

export const MCP_AUTH_CODE_TTL_MS = 5 * 60 * 1000;
export const MCP_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const MCP_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashMcpSecretToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function generateMcpSecretToken(params?: {
	prefix?: string;
	randomBytesFn?: (size: number) => Buffer;
}): string {
	return `${params?.prefix ?? "ogm_"}${(params?.randomBytesFn ?? randomBytes)(24).toString("base64url")}`;
}

export function derivePkceCodeChallenge(params: {
	codeVerifier: string;
	method: "S256";
}): string {
	return createHash("sha256").update(params.codeVerifier).digest("base64url");
}

export async function createMcpAuthorizationCode(params: {
	agentId: string;
	userId: string;
	redirectUri: string;
	codeChallenge: string;
	codeChallengeMethod?: "S256";
	clientId?: string;
	db?: AgentOauthDb;
	now?: Date;
	generateId?: () => string;
	generateToken?: () => string;
}): Promise<{
	code: string;
	expiresAt: Date;
}> {
	const db = (params.db ?? getDb()) as AgentOauthDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const code = (
		params.generateToken ?? (() => generateMcpSecretToken({ prefix: "ogmcc_" }))
	)();
	const expiresAt = new Date(now.getTime() + MCP_AUTH_CODE_TTL_MS);

	await db.agentMcpAuthorizationCode.create({
		data: {
			id: generateId(),
			agentId: params.agentId,
			userId: params.userId,
			clientId: params.clientId?.trim() || null,
			redirectUri: requireNonEmpty(params.redirectUri, "redirectUri"),
			codeHash: hashMcpSecretToken(code),
			codeChallenge: requireNonEmpty(params.codeChallenge, "codeChallenge"),
			codeChallengeMethod: params.codeChallengeMethod ?? "S256",
			expiresAt,
			consumedAt: null,
			createdAt: now,
		},
	});

	return {
		code,
		expiresAt,
	};
}

export async function exchangeMcpAuthorizationCode(params: {
	code: string;
	redirectUri: string;
	codeVerifier: string;
	clientId?: string;
	db?: AgentOauthDb;
	now?: Date;
	generateId?: () => string;
	generateToken?: (prefix: string) => string;
}): Promise<AgentOauthTokenBundle> {
	const db = (params.db ?? getDb()) as AgentOauthDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const generateToken =
		params.generateToken ??
		((prefix: string) => generateMcpSecretToken({ prefix }));

	const codeRecord = await db.agentMcpAuthorizationCode.findUnique({
		where: {
			codeHash: hashMcpSecretToken(requireNonEmpty(params.code, "code")),
		},
		select: selectAuthorizationCodeFields(),
	});

	if (!codeRecord) {
		throw new Error("Invalid authorization code.");
	}
	if (codeRecord.consumedAt) {
		throw new Error("Authorization code has already been used.");
	}
	if (codeRecord.expiresAt.getTime() <= now.getTime()) {
		throw new Error("Authorization code has expired.");
	}
	if (
		codeRecord.redirectUri !==
		requireNonEmpty(params.redirectUri, "redirectUri")
	) {
		throw new Error("redirectUri does not match the authorization request.");
	}
	if ((codeRecord.clientId ?? "") !== (params.clientId?.trim() ?? "")) {
		throw new Error("clientId does not match the authorization request.");
	}
	if (codeRecord.codeChallengeMethod !== "S256") {
		throw new Error("Unsupported PKCE code challenge method.");
	}

	const expectedChallenge = derivePkceCodeChallenge({
		codeVerifier: requireNonEmpty(params.codeVerifier, "codeVerifier"),
		method: "S256",
	});
	if (
		!timingSafeEqual(
			Buffer.from(codeRecord.codeChallenge, "utf8"),
			Buffer.from(expectedChallenge, "utf8"),
		)
	) {
		throw new Error("codeVerifier did not match the authorization request.");
	}

	await db.agentMcpAuthorizationCode.update({
		where: { id: codeRecord.id },
		data: {
			consumedAt: now,
		},
	});

	return createTokenBundle({
		db,
		agentId: codeRecord.agentId,
		userId: codeRecord.userId,
		clientId: codeRecord.clientId ?? undefined,
		now,
		generateId,
		generateToken,
		hashToken: hashMcpSecretToken,
		accessTokenTtlMs: MCP_ACCESS_TOKEN_TTL_MS,
		refreshTokenTtlMs: MCP_REFRESH_TOKEN_TTL_MS,
	});
}

export async function refreshMcpSessionTokens(params: {
	refreshToken: string;
	db?: AgentOauthDb;
	now?: Date;
	generateId?: () => string;
	generateToken?: (prefix: string) => string;
}): Promise<AgentOauthTokenBundle> {
	const db = (params.db ?? getDb()) as AgentOauthDb;
	const now = params.now ?? new Date();
	const generateId = params.generateId ?? randomUUID;
	const generateToken =
		params.generateToken ??
		((prefix: string) => generateMcpSecretToken({ prefix }));

	const refreshRecord = await db.agentMcpRefreshToken.findUnique({
		where: {
			tokenHash: hashMcpSecretToken(
				requireNonEmpty(params.refreshToken, "refreshToken"),
			),
		},
		select: selectRefreshTokenFields(),
	});

	if (!refreshRecord || !refreshRecord.session) {
		throw new Error("Invalid refresh token.");
	}
	if (refreshRecord.revokedAt || refreshRecord.session.revokedAt) {
		throw new Error("Refresh token has been revoked.");
	}
	if (refreshRecord.rotatedAt || refreshRecord.replacedById) {
		throw new Error("Refresh token has already been rotated.");
	}
	if (refreshRecord.expiresAt.getTime() <= now.getTime()) {
		throw new Error("Refresh token has expired.");
	}
	if (refreshRecord.session.expiresAt.getTime() <= now.getTime()) {
		throw new Error("MCP session has expired.");
	}

	const bundle = await createTokenBundle({
		db,
		agentId: refreshRecord.session.agentId,
		userId: refreshRecord.session.userId,
		clientId: refreshRecord.session.clientId ?? undefined,
		now,
		generateId,
		generateToken,
		sessionId: refreshRecord.session.id,
		familyId: refreshRecord.familyId,
		hashToken: hashMcpSecretToken,
		accessTokenTtlMs: MCP_ACCESS_TOKEN_TTL_MS,
		refreshTokenTtlMs: MCP_REFRESH_TOKEN_TTL_MS,
	});

	await db.agentMcpRefreshToken.update({
		where: { id: refreshRecord.id },
		data: {
			rotatedAt: now,
			lastUsedAt: now,
		},
	});

	return bundle;
}

export async function revokeMcpSession(params: {
	sessionId: string;
	db?: AgentOauthDb;
	now?: Date;
}): Promise<{ sessionId: string; revoked: true }> {
	const db = (params.db ?? getDb()) as AgentOauthDb;
	const now = params.now ?? new Date();

	await db.$transaction(
		async (trx: {
			agentMcpSession: AgentOauthDb["agentMcpSession"];
			agentMcpAccessToken: AgentOauthDb["agentMcpAccessToken"];
			agentMcpRefreshToken: AgentOauthDb["agentMcpRefreshToken"];
		}) => {
			await trx.agentMcpSession.update({
				where: { id: params.sessionId },
				data: {
					revokedAt: now,
					updatedAt: now,
				},
			});
			await trx.agentMcpAccessToken.updateMany({
				where: {
					sessionId: params.sessionId,
					revokedAt: null,
				},
				data: {
					revokedAt: now,
				},
			});
			await trx.agentMcpRefreshToken.updateMany({
				where: {
					sessionId: params.sessionId,
					revokedAt: null,
				},
				data: {
					revokedAt: now,
				},
			});
		},
	);

	return {
		sessionId: params.sessionId,
		revoked: true,
	};
}

export async function findActiveMcpAccessToken(params: {
	accessToken: string;
	db?: AgentOauthDb;
	now?: Date;
	updateLastUsedAt?: boolean;
}): Promise<AccessTokenRecord | null> {
	const db = (params.db ?? getDb()) as AgentOauthDb;
	const now = params.now ?? new Date();
	const record = await db.agentMcpAccessToken.findUnique({
		where: {
			tokenHash: hashMcpSecretToken(
				requireNonEmpty(params.accessToken, "accessToken"),
			),
		},
		select: selectAccessTokenFields(),
	});

	if (
		!record ||
		record.revokedAt ||
		record.expiresAt.getTime() <= now.getTime() ||
		!record.session ||
		record.session.revokedAt ||
		record.session.expiresAt.getTime() <= now.getTime()
	) {
		return null;
	}

	if (params.updateLastUsedAt !== false) {
		await db.agentMcpAccessToken.updateMany({
			where: {
				sessionId: record.sessionId,
				revokedAt: null,
			},
			data: {
				lastUsedAt: now,
			},
		});
		await db.agentMcpSession.update({
			where: {
				id: record.sessionId,
			},
			data: {
				lastUsedAt: now,
				updatedAt: now,
			},
		});
	}

	return record;
}
