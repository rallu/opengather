import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { ServerSettingsAgentsContent } from "./agents-page.tsx";

const TestRoutes = createRoutesStub([
	{
		path: "/server-settings/agents",
		Component: () => (
			<ServerSettingsAgentsContent
				actionData={{
					ok: true,
					action: "create-agent",
					agentId: "agent-1",
					token: "oga_created",
					baseUrl: "http://localhost:5173",
				}}
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
					baseUrl: "http://localhost:5173",
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
									scope: "instance.feed.post",
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

const markup = renderToStaticMarkup(<TestRoutes initialEntries={["/server-settings/agents"]} />);

assert.match(markup, /Connect An Agent/);
assert.match(markup, /Bearer oga_created/);
assert.match(markup, /Existing Agents/);
assert.match(markup, /Codex agent/);
assert.match(markup, /Rotate token/);
assert.match(markup, /Disable agent/);

console.log("server-settings-agents render validation passed");
