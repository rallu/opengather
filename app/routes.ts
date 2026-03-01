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
		path: "/setup",
		file: "routes/setup.tsx",
	},
	{
		path: "/community",
		file: "routes/community.tsx",
	},
];

export default routes;
