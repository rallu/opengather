import { Link } from "react-router";
import { Button } from "~/components/ui/button";

type RegisterFormProps = {
	error: string;
	googleAuthEnabled: boolean;
	hubAuthEnabled: boolean;
	hubLoading: boolean;
	isAnyLoading: boolean;
	loading: boolean;
	email: string;
	name: string;
	nextPath: string;
	password: string;
	reason: string;
	serverDescription: string;
	serverName: string;
	socialLoading: boolean;
	onEmailChange(value: string): void;
	onGoogleRegister(): void;
	onHubRegister(): void;
	onNameChange(value: string): void;
	onPasswordChange(value: string): void;
	onSubmit(event: React.FormEvent): void;
};

export function RegisterForm(props: RegisterFormProps) {
	return (
		<div className="w-full max-w-md space-y-8">
			<div className="text-center">
				<h1 className="text-3xl font-bold" data-testid="register-title">
					{props.reason === "members-only"
						? `Join ${props.serverName}`
						: "Create Account"}
				</h1>
				<p
					className="mt-2 text-muted-foreground"
					data-testid={
						props.reason === "members-only"
							? "register-reason-members-only"
							: "register-reason-default"
					}
				>
					{props.reason === "members-only"
						? "This community is only available to registered members."
						: "Get started with opengather"}
				</p>
			</div>

			{props.reason === "members-only" ? (
				<section
					className="rounded-lg border bg-muted/40 p-4"
					data-testid="register-context"
				>
					<p
						className="text-sm font-semibold"
						data-testid="register-context-title"
					>
						{props.serverName}
					</p>
					{props.serverDescription ? (
						<p className="mt-1 text-sm text-muted-foreground">
							{props.serverDescription}
						</p>
					) : null}
				</section>
			) : null}

			{props.error ? (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{props.error}
				</div>
			) : null}

			{props.hubAuthEnabled ? (
				<section className="space-y-3 rounded-lg border bg-muted/40 p-4">
					<p className="text-sm text-muted-foreground">
						Create or access your account through Hub first.
					</p>
					<Button
						type="button"
						className="h-11 w-full"
						disabled={props.isAnyLoading}
						onClick={props.onHubRegister}
						data-testid="register-hub-button"
					>
						{props.hubLoading ? "Redirecting..." : "Continue with Hub"}
					</Button>
				</section>
			) : null}

			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<div className="h-px flex-1 bg-border" />
				<span>Local account</span>
				<div className="h-px flex-1 bg-border" />
			</div>

			<form onSubmit={props.onSubmit} className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Create a local account with email and password.
				</p>

				<div className="space-y-2">
					<label htmlFor="name" className="text-sm font-medium">
						Name
					</label>
					<input
						id="name"
						data-testid="register-name"
						type="text"
						value={props.name}
						onChange={(event) => props.onNameChange(event.target.value)}
						required
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						placeholder="John Doe"
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="email" className="text-sm font-medium">
						Email
					</label>
					<input
						id="email"
						data-testid="register-email"
						type="email"
						value={props.email}
						onChange={(event) => props.onEmailChange(event.target.value)}
						required
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						placeholder="you@example.com"
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="password" className="text-sm font-medium">
						Password
					</label>
					<input
						id="password"
						data-testid="register-password"
						type="password"
						value={props.password}
						onChange={(event) => props.onPasswordChange(event.target.value)}
						required
						minLength={8}
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						placeholder="••••••••"
					/>
				</div>

				<Button
					type="submit"
					className="w-full"
					disabled={props.isAnyLoading}
					data-testid="register-submit"
				>
					{props.loading ? "Creating account..." : "Sign Up"}
				</Button>

				{props.googleAuthEnabled ? (
					<Button
						type="button"
						variant="outline"
						className="w-full"
						disabled={props.isAnyLoading}
						onClick={props.onGoogleRegister}
						data-testid="register-google-button"
					>
						{props.socialLoading ? "Redirecting..." : "Continue with Google"}
					</Button>
				) : null}
			</form>

			<p className="text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link
					to={`/login?${new URLSearchParams({
						next: props.nextPath,
						reason: props.reason,
					}).toString()}`}
					className="text-primary hover:underline"
					data-testid="register-sign-in-link"
				>
					Sign in
				</Link>
			</p>
		</div>
	);
}
