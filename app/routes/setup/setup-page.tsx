import type { SetupActionData, SetupLoaderData } from "./route.server";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui/button";

export function SetupPage(params: {
	actionData: SetupActionData;
	data: SetupLoaderData;
	loading: boolean;
}) {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold" data-testid="setup-title">
					First Run Setup
				</h1>
				<p className="text-muted-foreground">
					Configure your single-server feed settings.
				</p>
			</div>

			<Form
				method="post"
				className="space-y-4"
				data-testid="setup-form"
				aria-busy={params.loading}
			>
				{params.actionData && "error" in params.actionData ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{params.actionData.error}
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

				{params.data.hubAvailable ? (
					<div className="rounded-md border border-border p-4">
						<h2 className="mb-3 text-base font-semibold">Connect to Hub</h2>
						<div className="space-y-4">
							<label className="flex items-center gap-2 text-sm font-medium">
								<input
									name="hubEnabled"
									type="checkbox"
									data-testid="setup-hub-enabled"
								/>
								Enable Hub connection
							</label>
							<p className="text-sm text-muted-foreground">
								When enabled, this server auto-registers against Hub using
								environment configuration and stores returned OAuth credentials.
							</p>
						</div>
					</div>
				) : null}

				<div className="flex gap-3">
					<Button
						type="submit"
						disabled={params.loading}
						data-testid="setup-submit"
					>
						{params.loading ? "Saving..." : "Initialize Server"}
					</Button>
					<Button variant="outline" asChild>
						<Link to="/">Back home</Link>
					</Button>
				</div>
			</Form>
		</div>
	);
}
