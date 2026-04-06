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
		path: "/api/agents/v1/me",
		file: "routes/api-agents-v1-me.ts",
	},
	{
		path: "/api/agents/v1/groups",
		file: "routes/api-agents-v1-groups.ts",
	},
	{
		path: "/api/agents/v1/feed/posts",
		file: "routes/api-agents-v1-feed-posts.ts",
	},
	{
		path: "/api/agents/v1/notifications",
		file: "routes/api-agents-v1-notifications.ts",
	},
	{
		path: "/api/agents/v1/posts/:postId/replies",
		file: "routes/api-agents-v1-posts-postId-replies.ts",
	},
	{
		path: "/api/agents/v1/posts/:postId/hide",
		file: "routes/api-agents-v1-posts-postId-hide.ts",
	},
	{
		path: "/api/agents/v1/groups/:groupId/posts",
		file: "routes/api-agents-v1-groups-group-posts.ts",
	},
	{
		path: "/mcp",
		file: "routes/mcp.ts",
	},
	{
		path: "/api/auth/*",
		file: "routes/api-auth.ts",
	},
	{
		path: "/api/post-list",
		file: "routes/api-post-list.tsx",
	},
	{
		path: "/api/search",
		file: "routes/api-search.tsx",
	},
	{
		path: "/api/notifications/summary",
		file: "routes/api-notifications-summary.tsx",
	},
	{
		path: "/api/notifications/push-subscriptions",
		file: "routes/api-notifications-push-subscriptions.tsx",
	},
	{
		path: "/.well-known/appspecific/com.chrome.devtools.json",
		file: "routes/chrome-devtools-workspace.ts",
	},
	{
		path: "/media/:assetId/:variantKey",
		file: "routes/media-asset.ts",
	},
	{
		path: "/profile-images/:userId",
		file: "routes/profile-image.ts",
	},
	{
		path: "/profile-images/:userId/:size",
		file: "routes/profile-image-size.ts",
	},
	{
		path: "/metrics",
		file: "routes/metrics.tsx",
	},
	{
		path: "/up",
		file: "routes/up.ts",
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
		path: "/style-guide",
		file: "routes/style-guide.tsx",
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
		path: "/posts/:postId",
		file: "routes/post-detail.tsx",
	},
	{
		path: "/groups",
		file: "routes/groups.tsx",
	},
	{
		path: "/groups/:groupId",
		file: "routes/group-detail.tsx",
	},
	{
		path: "/profile",
		file: "routes/profile.tsx",
	},
	{
		path: "/profiles",
		file: "routes/profile-list.tsx",
	},
	{
		path: "/profiles/:userId",
		file: "routes/profile-detail.tsx",
	},
	{
		path: "/notifications",
		file: "routes/notifications.tsx",
	},
	{
		path: "/approvals",
		file: "routes/approvals.tsx",
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
		path: "/server-settings/agents",
		file: "routes/server-settings-agents.tsx",
	},
	{
		path: "/audit-logs",
		file: "routes/audit-logs.tsx",
	},
];

export default routes;
