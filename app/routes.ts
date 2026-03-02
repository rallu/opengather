import type { RouteConfig } from "@react-router/dev/routes";

const routes: RouteConfig = [
	{
		path: "/",
		file: "routes/home.tsx",
	},
	{
		path: "/login",
		file: "routes/login.tsx",
	},
	{
		path: "/register",
		file: "routes/register.tsx",
	},
	{
		path: "/auth/hub/login",
		file: "routes/hub-login.tsx",
	},
	{
		path: "/auth/hub/callback",
		file: "routes/hub-callback.tsx",
	},
	{
		path: "/api/auth/*",
		file: "routes/api-auth.ts",
	},
	{
		path: "/metrics",
		file: "routes/metrics.tsx",
	},
	{
		path: "/debug/error-monitoring",
		file: "routes/debug-error-monitoring.tsx",
	},
	{
		path: "/setup",
		file: "routes/setup.tsx",
	},
	{
		path: "/database-required",
		file: "routes/database-required.tsx",
	},
	{
		path: "/feed",
		file: "routes/feed.tsx",
	},
	{
		path: "/community",
		file: "routes/community.tsx",
	},
	{
		path: "/profile",
		file: "routes/profile.tsx",
	},
	{
		path: "/notifications",
		file: "routes/notifications.tsx",
	},
	{
		path: "/settings",
		file: "routes/settings.tsx",
	},
	{
		path: "/server-settings",
		file: "routes/server-settings.tsx",
	},
	{
		path: "/audit-logs",
		file: "routes/audit-logs.tsx",
	},
];

export default routes;
