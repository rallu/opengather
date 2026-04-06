import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { AuthorizeContent } from "./authorize-page.tsx";

const TestRoutes = createRoutesStub([
	{
		path: "/authorize",
		Component: () => (
			<AuthorizeContent
				data={{
					authUser: {
						id: "user-1",
						name: "Admin",
						email: "admin@example.com",
					},
					viewerRole: "admin",
					setup: {
						isSetup: true,
						instance: {
							id: "instance-1",
							name: "OpenGather Local",
							visibilityMode: "public",
							approvalMode: "automatic",
						},
					},
					oauth: {
						clientId: "codex",
						redirectUri: "http://localhost:8080/callback",
						state: "xyz",
						codeChallenge: "challenge-123",
						codeChallengeMethod: "S256",
						scope: ["instance.feed.read", "instance.feed.reply"],
					},
					agents: [
						{
							id: "agent-1",
							instanceId: "instance-1",
							createdByUserId: "user-1",
							displayName: "Codex",
							displayLabel: "Codex agent",
							description: null,
							role: "assistant",
							isEnabled: true,
							lastUsedAt: null,
							deletedAt: null,
							createdAt: new Date("2026-04-06T12:00:00.000Z"),
							updatedAt: new Date("2026-04-06T12:00:00.000Z"),
							grants: [
								{
									id: "grant-1",
									resourceType: "instance",
									resourceId: "instance-1",
									scope: "instance.feed.read",
									createdAt: new Date("2026-04-06T12:00:00.000Z"),
									updatedAt: new Date("2026-04-06T12:00:00.000Z"),
								},
								{
									id: "grant-2",
									resourceType: "instance",
									resourceId: "instance-1",
									scope: "instance.feed.reply",
									createdAt: new Date("2026-04-06T12:00:00.000Z"),
									updatedAt: new Date("2026-04-06T12:00:00.000Z"),
								},
							],
						},
					],
				}}
			/>
		),
	},
]);

const markup = renderToStaticMarkup(<TestRoutes initialEntries={["/authorize"]} />);

assert.match(markup, /Connect Codex to OpenGather/);
assert.match(markup, /Authorization request/);
assert.match(markup, /Codex agent/);
assert.match(markup, /Create a new agent for this MCP client/);
assert.match(markup, /Approve once/);
assert.match(markup, /instance\.feed\.read, instance\.feed\.reply/);

console.log("authorize-page render validation passed");
