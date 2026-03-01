import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { signIn, signUp } from "~/lib/auth-client";
import { getServerEnv } from "~/server/env.server";
import { isSetupCompleteForRequest } from "~/server/setup.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const isSetup = await isSetupCompleteForRequest({ request });
	if (!isSetup) {
		return redirect("/setup");
	}

	const env = getServerEnv();
	return {
		googleAuthEnabled: Boolean(
			env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
		),
	};
}

export default function Register() {
	const { googleAuthEnabled } = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [socialLoading, setSocialLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await signUp.email({
				name,
				email,
				password,
			});

			if (result.error) {
				setError(result.error.message || "Failed to sign up");
			} else {
				navigate("/");
			}
		} catch (_err) {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleRegister = async () => {
		if (!googleAuthEnabled || typeof window === "undefined") return;

		setError("");
		setSocialLoading(true);

		try {
			const result = await signIn.social({
				provider: "google",
				callbackURL: `${window.location.origin}/`,
			});

			if (result.error) {
				throw new Error(result.error.message || "Google signup failed");
			}

			const redirectUrl = result.data?.url;
			if (!redirectUrl) {
				throw new Error("Missing Google redirect URL");
			}

			window.location.href = redirectUrl;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Google signup failed";
			setError(message);
			setSocialLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-8">
			<div className="w-full max-w-md space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold">Create Account</h1>
					<p className="mt-2 text-muted-foreground">
						Get started with opengather
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
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
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={8}
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							placeholder="••••••••"
						/>
					</div>

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Creating account..." : "Sign Up"}
					</Button>

					{googleAuthEnabled ? (
						<Button
							type="button"
							variant="outline"
							className="w-full"
							disabled={loading || socialLoading}
							onClick={handleGoogleRegister}
						>
							{socialLoading ? "Redirecting..." : "Continue with Google"}
						</Button>
					) : null}
				</form>

				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link to="/login" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
