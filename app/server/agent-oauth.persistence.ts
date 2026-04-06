export type AgentOauthDb = {
	$transaction: <T>(
		callback: (trx: {
			agentMcpAuthorizationCode: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				findUnique: (args: {
					where: { codeHash: string };
					select: Record<string, unknown>;
				}) => Promise<AuthorizationCodeRecord | null>;
				update: (args: {
					where: { id: string };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
			};
			agentMcpSession: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				findUnique: (args: {
					where: { id: string };
					select: Record<string, unknown>;
				}) => Promise<SessionRecord | null>;
				update: (args: {
					where: { id: string };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
			};
			agentMcpAccessToken: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				findUnique: (args: {
					where: { tokenHash: string };
					select: Record<string, unknown>;
				}) => Promise<AccessTokenRecord | null>;
				updateMany: (args: {
					where: { sessionId: string; revokedAt: null };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
			};
			agentMcpRefreshToken: {
				create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
				findUnique: (args: {
					where: { tokenHash: string };
					select: Record<string, unknown>;
				}) => Promise<RefreshTokenRecord | null>;
				update: (args: {
					where: { id: string };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
				updateMany: (args: {
					where: { sessionId: string; revokedAt: null };
					data: Record<string, unknown>;
				}) => Promise<unknown>;
			};
		}) => Promise<T>,
	) => Promise<T>;
	agentMcpAuthorizationCode: {
		create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
		findUnique: (args: {
			where: { codeHash: string };
			select: Record<string, unknown>;
		}) => Promise<AuthorizationCodeRecord | null>;
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
	};
	agentMcpSession: {
		create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
		findUnique: (args: {
			where: { id: string };
			select: Record<string, unknown>;
		}) => Promise<SessionRecord | null>;
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
	};
	agentMcpAccessToken: {
		findUnique: (args: {
			where: { tokenHash: string };
			select: Record<string, unknown>;
		}) => Promise<AccessTokenRecord | null>;
		updateMany: (args: {
			where: { sessionId: string; revokedAt: null };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
		create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
	};
	agentMcpRefreshToken: {
		findUnique: (args: {
			where: { tokenHash: string };
			select: Record<string, unknown>;
		}) => Promise<RefreshTokenRecord | null>;
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
		updateMany: (args: {
			where: { sessionId: string; revokedAt: null };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
		create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
	};
};

export type AuthorizationCodeRecord = {
	id: string;
	agentId: string;
	userId: string;
	clientId: string | null;
	redirectUri: string;
	codeHash: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	expiresAt: Date;
	consumedAt: Date | null;
};

export type SessionRecord = {
	id: string;
	agentId: string;
	userId: string;
	clientId: string | null;
	expiresAt: Date;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
};

export type AccessTokenRecord = {
	id: string;
	sessionId: string;
	tokenHash: string;
	expiresAt: Date;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
	session?: SessionRecord | null;
};

export type RefreshTokenRecord = {
	id: string;
	sessionId: string;
	familyId: string;
	tokenHash: string;
	expiresAt: Date;
	revokedAt: Date | null;
	rotatedAt: Date | null;
	replacedById: string | null;
	lastUsedAt: Date | null;
	session?: SessionRecord | null;
};

export type AgentOauthTokenBundle = {
	sessionId: string;
	agentId: string;
	accessToken: string;
	accessTokenExpiresAt: Date;
	refreshToken: string;
	refreshTokenExpiresAt: Date;
};

export function requireNonEmpty(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${label} is required.`);
	}
	return normalized;
}

export function selectAuthorizationCodeFields(): Record<string, unknown> {
	return {
		id: true,
		agentId: true,
		userId: true,
		clientId: true,
		redirectUri: true,
		codeHash: true,
		codeChallenge: true,
		codeChallengeMethod: true,
		expiresAt: true,
		consumedAt: true,
	};
}

function selectSessionFields(): Record<string, unknown> {
	return {
		id: true,
		agentId: true,
		userId: true,
		clientId: true,
		expiresAt: true,
		revokedAt: true,
		lastUsedAt: true,
	};
}

export function selectAccessTokenFields(): Record<string, unknown> {
	return {
		id: true,
		sessionId: true,
		tokenHash: true,
		expiresAt: true,
		revokedAt: true,
		lastUsedAt: true,
		session: {
			select: selectSessionFields(),
		},
	};
}

export function selectRefreshTokenFields(): Record<string, unknown> {
	return {
		id: true,
		sessionId: true,
		familyId: true,
		tokenHash: true,
		expiresAt: true,
		revokedAt: true,
		rotatedAt: true,
		replacedById: true,
		lastUsedAt: true,
		session: {
			select: selectSessionFields(),
		},
	};
}

export async function createTokenBundle(params: {
	db: AgentOauthDb;
	agentId: string;
	userId: string;
	clientId?: string;
	now: Date;
	generateId: () => string;
	generateToken: (prefix: string) => string;
	sessionId?: string;
	familyId?: string;
	hashToken: (token: string) => string;
	accessTokenTtlMs: number;
	refreshTokenTtlMs: number;
}): Promise<AgentOauthTokenBundle> {
	const sessionId = params.sessionId ?? params.generateId();
	const familyId = params.familyId ?? params.generateId();
	const accessToken = params.generateToken("ogmca_");
	const refreshToken = params.generateToken("ogmcr_");
	const accessTokenExpiresAt = new Date(
		params.now.getTime() + params.accessTokenTtlMs,
	);
	const refreshTokenExpiresAt = new Date(
		params.now.getTime() + params.refreshTokenTtlMs,
	);

	await params.db.$transaction(
		async (trx: {
			agentMcpSession: AgentOauthDb["agentMcpSession"];
			agentMcpAccessToken: AgentOauthDb["agentMcpAccessToken"];
			agentMcpRefreshToken: AgentOauthDb["agentMcpRefreshToken"];
		}) => {
			if (!params.sessionId) {
				await trx.agentMcpSession.create({
					data: {
						id: sessionId,
						agentId: params.agentId,
						userId: params.userId,
						clientId: params.clientId ?? null,
						expiresAt: refreshTokenExpiresAt,
						revokedAt: null,
						lastUsedAt: params.now,
						createdAt: params.now,
						updatedAt: params.now,
					},
				});
			} else {
				await trx.agentMcpSession.update({
					where: { id: sessionId },
					data: {
						expiresAt: refreshTokenExpiresAt,
						lastUsedAt: params.now,
						updatedAt: params.now,
					},
				});
			}

			await trx.agentMcpAccessToken.updateMany({
				where: {
					sessionId,
					revokedAt: null,
				},
				data: {
					revokedAt: params.now,
				},
			});

			await trx.agentMcpAccessToken.create({
				data: {
					id: params.generateId(),
					sessionId,
					tokenHash: params.hashToken(accessToken),
					expiresAt: accessTokenExpiresAt,
					revokedAt: null,
					lastUsedAt: null,
					createdAt: params.now,
				},
			});

			await trx.agentMcpRefreshToken.create({
				data: {
					id: params.generateId(),
					sessionId,
					familyId,
					tokenHash: params.hashToken(refreshToken),
					expiresAt: refreshTokenExpiresAt,
					revokedAt: null,
					rotatedAt: null,
					replacedById: null,
					lastUsedAt: null,
					createdAt: params.now,
				},
			});
		},
	);

	return {
		sessionId,
		agentId: params.agentId,
		accessToken,
		accessTokenExpiresAt,
		refreshToken,
		refreshTokenExpiresAt,
	};
}
