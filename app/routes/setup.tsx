import type { ActionFunctionArgs } from "react-router";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useNavigation,
} from "react-router";
import { Button } from "~/components/ui/button";
import { hasDatabaseConfig } from "~/server/env.server";
import { getSetupStatus, initializeSetup } from "~/server/setup.service.server";

export async function loader() {
	if (!hasDatabaseConfig()) {
		return redirect("/database-required");
	}

	try {
		const status = await getSetupStatus();
		if (status.isSetup) {
			return redirect("/");
		}
	} catch {
		// Keep setup UI accessible when DB is not reachable.
	}
	return null;
}

export async function action({ request }: ActionFunctionArgs) {
	if (!hasDatabaseConfig()) {
		return redirect("/database-required");
	}

	const requestUrl = new URL(request.url);
	const appOrigin = requestUrl.origin;
	const defaultHubBaseUrl = appOrigin.includes("127.0.0.1")
		? "http://127.0.0.1:9000"
		: "http://localhost:9000";

	const formData = await request.formData();
	const name = String(formData.get("name") ?? "").trim();
	const description = String(formData.get("description") ?? "").trim();
	const adminName = String(formData.get("adminName") ?? "").trim();
	const adminEmail = String(formData.get("adminEmail") ?? "")
		.trim()
		.toLowerCase();
	const adminPassword = String(formData.get("adminPassword") ?? "");
	const visibilityMode = (formData.get("visibilityMode") ?? "public") as
		| "public"
		| "registered"
		| "approval";
	const approvalMode = (formData.get("approvalMode") ?? "automatic") as
		| "automatic"
		| "manual";
	const hubEnabled = String(formData.get("hubEnabled") ?? "") === "on";
	const hubBaseUrl = String(formData.get("hubBaseUrl") ?? "").trim();
	const hubClientId = String(formData.get("hubClientId") ?? "").trim();
	const hubClientSecret = String(formData.get("hubClientSecret") ?? "").trim();
	const hubRedirectUri = String(formData.get("hubRedirectUri") ?? "").trim();
	const hubInstanceName = String(formData.get("hubInstanceName") ?? "").trim();
	const hubInstanceBaseUrl = String(formData.get("hubInstanceBaseUrl") ?? "")
		.trim();
	const hubInstancePushSecret = String(formData.get("hubInstancePushSecret") ?? "")
		.trim();
	const hubOidcDiscoveryUrl = String(formData.get("hubOidcDiscoveryUrl") ?? "")
		.trim();

	if (!name || !adminName || !adminEmail || !adminPassword) {
		return {
			error: "Server and admin fields are required",
		};
	}

	if (adminPassword.length < 8) {
		return {
			error: "Admin password must be at least 8 characters",
		};
	}

	try {
		const result = await initializeSetup({
			name,
			description: description || undefined,
			visibilityMode,
			approvalMode,
			betterAuthUrl: appOrigin,
			adminName,
			adminEmail,
			adminPassword,
			hub: {
				enabled: hubEnabled,
				baseUrl: hubBaseUrl || defaultHubBaseUrl,
				oidcDiscoveryUrl:
					hubOidcDiscoveryUrl ||
					`${hubBaseUrl || defaultHubBaseUrl}/api/auth/.well-known/openid-configuration`,
				clientId: hubClientId,
				clientSecret: hubClientSecret,
				redirectUri: hubRedirectUri || `${appOrigin}/auth/hub/callback`,
				instanceName: hubInstanceName || name,
				instanceBaseUrl: hubInstanceBaseUrl || appOrigin,
				instancePushSecret: hubInstancePushSecret,
			},
		});

		if (!result.ok) {
			return { error: result.error };
		}

		return redirect("/");
	} catch (error) {
		console.error("setup action failed", error);
		const message = error instanceof Error ? error.message : "unknown error";
		return { error: `Setup failed: ${message}` };
	}
}

export default function SetupWizard() {
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold" data-testid="setup-title">First Run Setup</h1>
				<p className="text-muted-foreground">
					Configure your single-server feed settings.
				</p>
			</div>

			<Form
				method="post"
				className="space-y-4"
				data-testid="setup-form"
				aria-busy={loading}
			>
				{actionData && "error" in actionData ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{actionData.error}
					</div>
				) : null}

				<div className="space-y-2">
					<label htmlFor="setup-name" className="text-sm font-medium">
						Server name
					</label>
					<input
						id="setup-name"
						data-testid="setup-name"
						name="name"
						required
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						placeholder="OpenGather Local"
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="setup-description" className="text-sm font-medium">
						Description
					</label>
					<textarea
						id="setup-description"
						data-testid="setup-description"
						name="description"
						className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>

				<div className="rounded-md border border-border p-4">
					<h2 className="mb-3 text-base font-semibold">Admin Account</h2>
					<div className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="setup-admin-name" className="text-sm font-medium">
								Admin name
							</label>
							<input
								id="setup-admin-name"
						data-testid="setup-admin-name"
								name="adminName"
								required
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="Admin User"
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="setup-admin-email" className="text-sm font-medium">
								Admin email
							</label>
							<input
								id="setup-admin-email"
						data-testid="setup-admin-email"
								name="adminEmail"
								type="email"
								required
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="admin@example.com"
							/>
						</div>
						<div className="space-y-2">
							<label
								htmlFor="setup-admin-password"
								className="text-sm font-medium"
							>
								Admin password
							</label>
							<input
								id="setup-admin-password"
						data-testid="setup-admin-password"
								name="adminPassword"
								type="password"
								minLength={8}
								required
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="At least 8 characters"
							/>
						</div>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<label htmlFor="setup-visibility" className="text-sm font-medium">
							Visibility
						</label>
						<select
							id="setup-visibility"
						data-testid="setup-visibility"
							name="visibilityMode"
							defaultValue="public"
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="public">Public</option>
							<option value="registered">Registered only</option>
							<option value="approval">Members with approval</option>
						</select>
					</div>
					<div className="space-y-2">
						<label htmlFor="setup-approval" className="text-sm font-medium">
							Approval mode
						</label>
						<select
							id="setup-approval"
						data-testid="setup-approval"
							name="approvalMode"
							defaultValue="automatic"
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="automatic">Automatic</option>
							<option value="manual">Manual</option>
						</select>
					</div>
				</div>

				<div className="rounded-md border border-border p-4">
					<h2 className="mb-3 text-base font-semibold">Connect to Hub</h2>
					<div className="space-y-4">
						<label className="flex items-center gap-2 text-sm font-medium">
							<input name="hubEnabled" type="checkbox" data-testid="setup-hub-enabled" />
							Enable Hub connection
						</label>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label htmlFor="setup-hub-base-url" className="text-sm font-medium">
									Hub base URL
								</label>
								<input
									id="setup-hub-base-url"
						data-testid="setup-hub-base-url"
									name="hubBaseUrl"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									placeholder="http://localhost:9000"
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="setup-hub-oidc-discovery-url"
									className="text-sm font-medium"
								>
									Hub OIDC discovery URL
								</label>
								<input
									id="setup-hub-oidc-discovery-url"
						data-testid="setup-hub-oidc-discovery-url"
									name="hubOidcDiscoveryUrl"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									placeholder="http://localhost:9000/api/auth/.well-known/openid-configuration"
								/>
							</div>
							<div className="space-y-2">
								<label htmlFor="setup-hub-client-id" className="text-sm font-medium">
									Hub client ID
								</label>
								<input
									id="setup-hub-client-id"
						data-testid="setup-hub-client-id"
									name="hubClientId"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="setup-hub-client-secret"
									className="text-sm font-medium"
								>
									Hub client secret
								</label>
								<input
									id="setup-hub-client-secret"
						data-testid="setup-hub-client-secret"
									name="hubClientSecret"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>
							<div className="space-y-2">
								<label htmlFor="setup-hub-redirect-uri" className="text-sm font-medium">
									Hub redirect URI
								</label>
								<input
									id="setup-hub-redirect-uri"
						data-testid="setup-hub-redirect-uri"
									name="hubRedirectUri"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									placeholder="http://localhost:5173/auth/hub/callback"
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="setup-hub-instance-name"
									className="text-sm font-medium"
								>
									Instance name in Hub
								</label>
								<input
									id="setup-hub-instance-name"
						data-testid="setup-hub-instance-name"
									name="hubInstanceName"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="setup-hub-instance-base-url"
									className="text-sm font-medium"
								>
									Instance base URL
								</label>
								<input
									id="setup-hub-instance-base-url"
						data-testid="setup-hub-instance-base-url"
									name="hubInstanceBaseUrl"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									placeholder="http://localhost:5173"
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="setup-hub-instance-push-secret"
									className="text-sm font-medium"
								>
									Hub push secret
								</label>
								<input
									id="setup-hub-instance-push-secret"
						data-testid="setup-hub-instance-push-secret"
									name="hubInstancePushSecret"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="flex gap-3">
					<Button type="submit" disabled={loading} data-testid="setup-submit">
						{loading ? "Saving..." : "Initialize Server"}
					</Button>
					<Button variant="outline" asChild>
						<Link to="/">Back home</Link>
					</Button>
				</div>
			</Form>
		</div>
	);
}
