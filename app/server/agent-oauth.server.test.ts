import assert from "node:assert/strict";
import test from "node:test";
import {
	createMcpAuthorizationCode,
	derivePkceCodeChallenge,
	exchangeMcpAuthorizationCode,
	findActiveMcpAccessToken,
	refreshMcpSessionTokens,
	revokeMcpSession,
} from "./agent-oauth.server.ts";

function createDbHarness() {
	const authorizationCodes = new Map<string, Record<string, unknown>>();
	const sessions = new Map<string, Record<string, unknown>>();
	const accessTokens = new Map<string, Record<string, unknown>>();
	const refreshTokens = new Map<string, Record<string, unknown>>();

	type TestDb = {
		$transaction: (
			callback: (trx: TestDb) => Promise<unknown>,
		) => Promise<unknown>;
		agentMcpAuthorizationCode: {
			create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			findUnique: (args: { where: { codeHash: string } }) => Promise<unknown>;
			update: (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
		agentMcpSession: {
			create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			findUnique: (args: { where: { id: string } }) => Promise<unknown>;
			update: (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
		agentMcpAccessToken: {
			create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			findUnique: (args: { where: { tokenHash: string } }) => Promise<unknown>;
			updateMany: (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
		agentMcpRefreshToken: {
			create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
			findUnique: (args: { where: { tokenHash: string } }) => Promise<unknown>;
			update: (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
			updateMany: (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => Promise<unknown>;
		};
	};

	const db: TestDb = {
		$transaction: async (callback: (trx: TestDb) => Promise<unknown>) =>
			callback(db),
		agentMcpAuthorizationCode: {
			create: async (args: { data: Record<string, unknown> }) => {
				authorizationCodes.set(String(args.data.id), { ...args.data });
				return args.data;
			},
			findUnique: async (args: { where: { codeHash: string } }) => {
				for (const record of authorizationCodes.values()) {
					if (record.codeHash === args.where.codeHash) {
						return record as never;
					}
				}
				return null;
			},
			update: async (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				authorizationCodes.set(args.where.id, {
					...authorizationCodes.get(args.where.id),
					...args.data,
				});
				return authorizationCodes.get(args.where.id);
			},
		},
		agentMcpSession: {
			create: async (args: { data: Record<string, unknown> }) => {
				sessions.set(String(args.data.id), { ...args.data });
				return args.data;
			},
			findUnique: async (args: { where: { id: string } }) => {
				return (sessions.get(args.where.id) as never) ?? null;
			},
			update: async (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				sessions.set(args.where.id, {
					...sessions.get(args.where.id),
					...args.data,
				});
				return sessions.get(args.where.id);
			},
		},
		agentMcpAccessToken: {
			create: async (args: { data: Record<string, unknown> }) => {
				accessTokens.set(String(args.data.id), { ...args.data });
				return args.data;
			},
			findUnique: async (args: { where: { tokenHash: string } }) => {
				for (const record of accessTokens.values()) {
					if (record.tokenHash === args.where.tokenHash) {
						return {
							...record,
							session: sessions.get(String(record.sessionId as string)) ?? null,
						} as never;
					}
				}
				return null;
			},
			updateMany: async (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => {
				for (const [id, record] of accessTokens.entries()) {
					if (
						record.sessionId === args.where.sessionId &&
						record.revokedAt === args.where.revokedAt
					) {
						accessTokens.set(id, {
							...record,
							...args.data,
						});
					}
				}
				return { count: 1 };
			},
		},
		agentMcpRefreshToken: {
			create: async (args: { data: Record<string, unknown> }) => {
				refreshTokens.set(String(args.data.id), { ...args.data });
				return args.data;
			},
			findUnique: async (args: { where: { tokenHash: string } }) => {
				for (const record of refreshTokens.values()) {
					if (record.tokenHash === args.where.tokenHash) {
						return {
							...record,
							session: sessions.get(String(record.sessionId as string)) ?? null,
						} as never;
					}
				}
				return null;
			},
			update: async (args: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				refreshTokens.set(args.where.id, {
					...refreshTokens.get(args.where.id),
					...args.data,
				});
				return refreshTokens.get(args.where.id);
			},
			updateMany: async (args: {
				where: { sessionId: string; revokedAt: null };
				data: Record<string, unknown>;
			}) => {
				for (const [id, record] of refreshTokens.entries()) {
					if (
						record.sessionId === args.where.sessionId &&
						record.revokedAt === args.where.revokedAt
					) {
						refreshTokens.set(id, {
							...record,
							...args.data,
						});
					}
				}
				return { count: 1 };
			},
		},
	};

	return { db, authorizationCodes, sessions, accessTokens, refreshTokens };
}

test("createMcpAuthorizationCode stores a hashed auth code with PKCE metadata", async () => {
	const harness = createDbHarness();
	const result = await createMcpAuthorizationCode({
		agentId: "agent-1",
		userId: "user-1",
		redirectUri: "https://example.test/callback",
		codeChallenge: "challenge-1",
		clientId: "codex",
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => "code-row-1",
		generateToken: () => "ogmcc_raw",
		db: harness.db as never,
	});

	assert.equal(result.code, "ogmcc_raw");
	const stored = harness.authorizationCodes.get("code-row-1");
	assert.equal(stored?.codeHash === "ogmcc_raw", false);
	assert.equal(stored?.codeChallenge, "challenge-1");
	assert.equal(stored?.clientId, "codex");
});

test("exchangeMcpAuthorizationCode validates PKCE and creates a session plus tokens", async () => {
	const harness = createDbHarness();
	const verifier = "verifier-value";
	const challenge = derivePkceCodeChallenge({
		codeVerifier: verifier,
		method: "S256",
	});
	await createMcpAuthorizationCode({
		agentId: "agent-1",
		userId: "user-1",
		redirectUri: "https://example.test/callback",
		codeChallenge: challenge,
		clientId: "codex",
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => "code-row-1",
		generateToken: () => "ogmcc_raw",
		db: harness.db as never,
	});

	const ids = ["session-1", "family-1", "access-row-1", "refresh-row-1"];
	const bundle = await exchangeMcpAuthorizationCode({
		code: "ogmcc_raw",
		redirectUri: "https://example.test/callback",
		codeVerifier: verifier,
		clientId: "codex",
		now: new Date("2026-04-06T12:01:00.000Z"),
		generateId: () => ids.shift() ?? "extra-id",
		generateToken: (prefix) => `${prefix}token`,
		db: harness.db as never,
	});

	assert.equal(bundle.sessionId, "session-1");
	assert.equal(bundle.accessToken, "ogmca_token");
	assert.equal(bundle.refreshToken, "ogmcr_token");
	assert.equal(harness.sessions.size, 1);
	assert.equal(harness.accessTokens.size, 1);
	assert.equal(harness.refreshTokens.size, 1);
	assert.equal(
		harness.authorizationCodes.get("code-row-1")?.consumedAt instanceof Date,
		true,
	);
});

test("refreshMcpSessionTokens rotates tokens silently for an active session", async () => {
	const harness = createDbHarness();
	const verifier = "verifier-value";
	const challenge = derivePkceCodeChallenge({
		codeVerifier: verifier,
		method: "S256",
	});
	await createMcpAuthorizationCode({
		agentId: "agent-1",
		userId: "user-1",
		redirectUri: "https://example.test/callback",
		codeChallenge: challenge,
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => "code-row-1",
		generateToken: () => "ogmcc_raw",
		db: harness.db as never,
	});
	await exchangeMcpAuthorizationCode({
		code: "ogmcc_raw",
		redirectUri: "https://example.test/callback",
		codeVerifier: verifier,
		now: new Date("2026-04-06T12:01:00.000Z"),
		generateId: (() => {
			const ids = ["session-1", "family-1", "access-row-1", "refresh-row-1"];
			return () => ids.shift() ?? "extra-id";
		})(),
		generateToken: (prefix) => `${prefix}first`,
		db: harness.db as never,
	});

	const bundle = await refreshMcpSessionTokens({
		refreshToken: "ogmcr_first",
		now: new Date("2026-04-06T12:02:00.000Z"),
		generateId: (() => {
			const ids = ["access-row-2", "refresh-row-2"];
			return () => ids.shift() ?? "extra-id";
		})(),
		generateToken: (prefix) => `${prefix}second`,
		db: harness.db as never,
	});

	assert.equal(bundle.sessionId, "session-1");
	assert.equal(bundle.accessToken, "ogmca_second");
	assert.equal(bundle.refreshToken, "ogmcr_second");
	assert.equal(
		harness.refreshTokens.get("refresh-row-1")?.rotatedAt instanceof Date,
		true,
	);
	assert.equal(harness.accessTokens.size, 2);
	assert.equal(harness.refreshTokens.size, 2);
});

test("findActiveMcpAccessToken returns null after session revocation", async () => {
	const harness = createDbHarness();
	const verifier = "verifier-value";
	const challenge = derivePkceCodeChallenge({
		codeVerifier: verifier,
		method: "S256",
	});
	await createMcpAuthorizationCode({
		agentId: "agent-1",
		userId: "user-1",
		redirectUri: "https://example.test/callback",
		codeChallenge: challenge,
		now: new Date("2026-04-06T12:00:00.000Z"),
		generateId: () => "code-row-1",
		generateToken: () => "ogmcc_raw",
		db: harness.db as never,
	});
	const bundle = await exchangeMcpAuthorizationCode({
		code: "ogmcc_raw",
		redirectUri: "https://example.test/callback",
		codeVerifier: verifier,
		now: new Date("2026-04-06T12:01:00.000Z"),
		generateId: (() => {
			const ids = ["session-1", "family-1", "access-row-1", "refresh-row-1"];
			return () => ids.shift() ?? "extra-id";
		})(),
		generateToken: (prefix) => `${prefix}token`,
		db: harness.db as never,
	});

	const activeBefore = await findActiveMcpAccessToken({
		accessToken: bundle.accessToken,
		now: new Date("2026-04-06T12:01:10.000Z"),
		db: harness.db as never,
	});
	assert.equal(activeBefore?.session?.id, "session-1");

	await revokeMcpSession({
		sessionId: "session-1",
		now: new Date("2026-04-06T12:02:00.000Z"),
		db: harness.db as never,
	});

	const activeAfter = await findActiveMcpAccessToken({
		accessToken: bundle.accessToken,
		now: new Date("2026-04-06T12:02:10.000Z"),
		updateLastUsedAt: false,
		db: harness.db as never,
	});
	assert.equal(activeAfter, null);
});
