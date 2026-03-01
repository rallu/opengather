import type { ActionFunctionArgs } from "react-router";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { Button } from "~/components/ui/button";
import { hasDatabaseConfig } from "~/server/env.server";
import { persistDatabaseUrlToEnv } from "~/server/env-file.server";
import { getSetupStatus, initializeSetup } from "~/server/setup.service.server";

export async function loader() {
	if (!hasDatabaseConfig()) {
		return { step: "database" as const };
	}

	try {
		const status = await getSetupStatus();
		if (status.isSetup) {
			return redirect("/");
		}
	} catch {
		// Keep setup UI accessible when DB is not reachable.
	}
	return { step: "instance" as const };
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const actionType = String(formData.get("_action") ?? "initialize");

	if (actionType === "set_database_url") {
		const databaseUrl = String(formData.get("databaseUrl") ?? "").trim();
		if (!databaseUrl) {
			return { error: "DATABASE_URL is required", step: "database" as const };
		}
		if (
			!databaseUrl.startsWith("postgres://") &&
			!databaseUrl.startsWith("postgresql://")
		) {
			return {
				error: "DATABASE_URL must start with postgres:// or postgresql://",
				step: "database" as const,
			};
		}

		try {
			await persistDatabaseUrlToEnv({ databaseUrl });
			process.env.DATABASE_URL = databaseUrl;
			return redirect("/setup");
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			return {
				error: `Failed to write .env: ${message}`,
				step: "database" as const,
			};
		}
	}

	if (!hasDatabaseConfig()) {
		return { error: "Set DATABASE_URL first", step: "database" as const };
	}

	const name = String(formData.get("name") ?? "").trim();
	const slug = String(formData.get("slug") ?? "").trim();
	const description = String(formData.get("description") ?? "").trim();
	const adminName = String(formData.get("adminName") ?? "").trim();
	const adminEmail = String(formData.get("adminEmail") ?? "")
		.trim()
		.toLowerCase();
	const adminPassword = String(formData.get("adminPassword") ?? "");
	const visibilityMode = (formData.get("visibilityMode") ?? "public") as
		| "public"
		| "registered";
	const approvalMode = (formData.get("approvalMode") ?? "automatic") as
		| "automatic"
		| "manual";

	if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
		return {
			error: "Instance and admin fields are required",
			step: "instance" as const,
		};
	}

	if (adminPassword.length < 8) {
		return {
			error: "Admin password must be at least 8 characters",
			step: "instance" as const,
		};
	}

	try {
		const result = await initializeSetup({
			name,
			slug,
			description: description || undefined,
			visibilityMode,
			approvalMode,
			adminName,
			adminEmail,
			adminPassword,
		});

		if (!result.ok) {
			return { error: result.error, step: "instance" as const };
		}

		return redirect("/");
	} catch (error) {
		console.error("setup action failed", error);
		const message = error instanceof Error ? error.message : "unknown error";
		return { error: `Setup failed: ${message}`, step: "instance" as const };
	}
}

export default function SetupWizard() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const loading = navigation.state === "submitting";
	const activeStep = actionData?.step ?? data.step;

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">First Run Setup</h1>
				<p className="text-muted-foreground">
					{activeStep === "database"
						? "Step 1: configure DATABASE_URL"
						: "Step 2: configure your single-tenant community instance."}
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

				{activeStep === "database" ? (
					<>
						<input type="hidden" name="_action" value="set_database_url" />
						<div className="space-y-2">
							<label
								htmlFor="setup-database-url"
								className="text-sm font-medium"
							>
								DATABASE_URL
							</label>
							<input
								id="setup-database-url"
								name="databaseUrl"
								type="text"
								required
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="postgres://opengather:opengather@localhost:5432/opengather"
							/>
							<p className="text-xs text-muted-foreground">
								This will be written to <code>.env</code>.
							</p>
						</div>
					</>
				) : (
					<>
						<input type="hidden" name="_action" value="initialize" />
						<div className="space-y-2">
							<label htmlFor="setup-name" className="text-sm font-medium">
								Instance name
							</label>
							<input
								id="setup-name"
								name="name"
								required
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="OpenGather Local"
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="setup-slug" className="text-sm font-medium">
								Slug
							</label>
							<input
								id="setup-slug"
								name="slug"
								required
								pattern="^[a-z0-9-]+$"
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="opengather-local"
							/>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="setup-description"
								className="text-sm font-medium"
							>
								Description
							</label>
							<textarea
								id="setup-description"
								name="description"
								className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							/>
						</div>

						<div className="rounded-md border border-border p-4">
							<h2 className="mb-3 text-base font-semibold">Admin Account</h2>
							<div className="space-y-4">
								<div className="space-y-2">
									<label
										htmlFor="setup-admin-name"
										className="text-sm font-medium"
									>
										Admin name
									</label>
									<input
										id="setup-admin-name"
										name="adminName"
										required
										className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										placeholder="Admin User"
									/>
								</div>
								<div className="space-y-2">
									<label
										htmlFor="setup-admin-email"
										className="text-sm font-medium"
									>
										Admin email
									</label>
									<input
										id="setup-admin-email"
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
								<label
									htmlFor="setup-visibility"
									className="text-sm font-medium"
								>
									Visibility
								</label>
								<select
									id="setup-visibility"
									name="visibilityMode"
									defaultValue="public"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									<option value="public">Public</option>
									<option value="registered">Registered only</option>
								</select>
							</div>
							<div className="space-y-2">
								<label htmlFor="setup-approval" className="text-sm font-medium">
									Approval mode
								</label>
								<select
									id="setup-approval"
									name="approvalMode"
									defaultValue="automatic"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									<option value="automatic">Automatic</option>
									<option value="manual">Manual</option>
								</select>
							</div>
						</div>
					</>
				)}

				<div className="flex gap-3">
					<Button type="submit" disabled={loading}>
						{loading
							? "Saving..."
							: activeStep === "database"
								? "Save Database URL"
								: "Initialize Instance"}
					</Button>
					{activeStep === "instance" ? (
						<Button variant="outline" asChild>
							<Link to="/">Back home</Link>
						</Button>
					) : null}
				</div>
			</Form>
		</div>
	);
}
