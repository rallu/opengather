import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { signIn } from "~/lib/auth-client";
import { getServerConfig } from "~/server/config.service.server";
import { isHubUiEnabled } from "~/server/hub-config.server";
import {
	getSetupStatus,
	isSetupCompleteForRequest,
} from "~/server/setup.service.server";

function normalizeNextPath(raw: string | null): string {
	if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
		return "/";
	}
	return raw;
}

export async function loader({ request }: LoaderFunctionArgs) {
	const isSetup = await isSetupCompleteForRequest({ request });
	if (!isSetup) {
		return redirect("/setup");
	}

	const url = new URL(request.url);
	const config = await getServerConfig();
	const setup = await getSetupStatus();
	return {
		hubAuthEnabled: isHubUiEnabled({
			hubAvailable: config.hubAvailable,
			hubEnabled: config.hubEnabled,
			hubClientId: config.hubClientId,
			hubClientSecret: config.hubClientSecret,
		}),
		googleAuthEnabled: Boolean(
			config.googleClientId && config.googleClientSecret,
		),
		nextPath: normalizeNextPath(url.searchParams.get("next")),
		reason: url.searchParams.get("reason") ?? "",
		serverName: setup.instance?.name ?? "OpenGather",
	};
}

export default function Login() {
	const { googleAuthEnabled, hubAuthEnabled, nextPath, reason, serverName } =
		useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [socialLoading, setSocialLoading] = useState(false);
	const [hubLoading, setHubLoading] = useState(false);
	const isAnyLoading = loading || socialLoading || hubLoading;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await signIn.email({
				email,
				password,
			});

			if (result.error) {
				setError(result.error.message || "Failed to sign in");
			} else {
				navigate(nextPath);
			}
		} catch (_err) {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleHubLogin = async () => {
		if (!hubAuthEnabled || typeof window === "undefined") return;

		setError("");
		setHubLoading(true);

		try {
			const result = await signIn.oauth2({
				providerId: "hub",
				callbackURL: `${window.location.origin}${nextPath}`,
			});

			if (result.error) {
				throw new Error(result.error.message || "Hub login failed");
			}

			if (result.data?.redirect) {
				return;
			}

			const redirectUrl = result.data?.url;
			if (!redirectUrl) {
				throw new Error("Missing Hub redirect URL");
			}

			window.location.href = redirectUrl;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Hub login failed";
			setError(message);
			setHubLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		if (!googleAuthEnabled || typeof window === "undefined") return;

		setError("");
		setSocialLoading(true);

		try {
			const result = await signIn.social({
				provider: "google",
				callbackURL: `${window.location.origin}${nextPath}`,
			});

			if (result.error) {
				throw new Error(result.error.message || "Google login failed");
			}

			if (result.data?.redirect) {
				return;
			}

			const redirectUrl = result.data?.url;
			if (!redirectUrl) {
				throw new Error("Missing Google redirect URL");
			}

			window.location.href = redirectUrl;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Google login failed";
			setError(message);
			setSocialLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-8">
			<div className="w-full max-w-md space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold" data-testid="login-title">
						Sign In
					</h1>
					<p className="mt-2 text-muted-foreground">
						{reason === "members-only"
							? `Sign in to continue to ${serverName}`
							: "Welcome back to opengather"}
					</p>
				</div>

				{reason === "members-only" ? (
					<section
						className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground"
						data-testid="login-context"
					>
						This community requires a registered account before you can access
						the feed.
					</section>
				) : null}

				{error && (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				)}

				{hubAuthEnabled ? (
					<section className="space-y-3 rounded-lg border bg-muted/40 p-4">
						<div>
							<p className="text-sm font-semibold">Recommended</p>
							<p className="text-sm text-muted-foreground">
								Use Hub to sign in with your existing opengather identity.
							</p>
						</div>
						<Button
							type="button"
							className="h-11 w-full"
							disabled={isAnyLoading}
							onClick={handleHubLogin}
							data-testid="login-hub-button"
						>
							{hubLoading ? "Redirecting..." : "Continue with Hub"}
						</Button>
					</section>
				) : null}

				<div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
					<div className="h-px flex-1 bg-border" />
					<span>Other sign in methods</span>
					<div className="h-px flex-1 bg-border" />
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Sign in with your local email and password.
					</p>

					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							data-testid="login-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
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
							data-testid="login-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							placeholder="••••••••"
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={isAnyLoading}
						data-testid="login-submit"
					>
						{loading ? "Signing in..." : "Sign In"}
					</Button>

					{googleAuthEnabled ? (
						<Button
							type="button"
							variant="outline"
							className="w-full"
							disabled={isAnyLoading}
							onClick={handleGoogleLogin}
							data-testid="login-google-button"
						>
							{socialLoading ? "Redirecting..." : "Continue with Google"}
						</Button>
					) : null}
				</form>

				<p className="text-center text-sm text-muted-foreground">
					Don't have an account?{" "}
					<Link
						to={`/register?${new URLSearchParams({
							next: nextPath,
							reason,
						}).toString()}`}
						className="text-primary hover:underline"
					>
						Sign up
					</Link>
				</p>
			</div>
		</div>
	);
}
