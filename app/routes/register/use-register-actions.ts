import { useState } from "react";
import { getSession, signIn, signUp } from "~/lib/auth-client";
import { formatAuthErrorMessage } from "~/lib/auth-error";

export function useRegisterActions(params: {
	googleAuthEnabled: boolean;
	hubAuthEnabled: boolean;
	nextPath: string;
}) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [socialLoading, setSocialLoading] = useState(false);
	const [hubLoading, setHubLoading] = useState(false);

	const finishLocalRegistration = async () => {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const session = await getSession();
			if (session?.data?.session && session.data.user) {
				window.location.assign(params.nextPath);
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 100));
		}

		throw new Error("Registered, but the session did not become active.");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await signUp.email({ name, email, password });

			if (result.error) {
				setError(
					formatAuthErrorMessage(result.error.message) || "Failed to sign up",
				);
				return;
			}

			await finishLocalRegistration();
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "An unexpected error occurred",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleHubRegister = async () => {
		if (!params.hubAuthEnabled || typeof window === "undefined") {
			return;
		}

		setError("");
		setHubLoading(true);

		try {
			const result = await signIn.oauth2({
				providerId: "hub",
				callbackURL: `${window.location.origin}${params.nextPath}`,
			});

			if (result.error) {
				throw new Error(
					formatAuthErrorMessage(result.error.message) || "Hub signup failed",
				);
			}

			if (result.data?.redirect) {
				return;
			}

			const redirectUrl = result.data?.url;
			if (!redirectUrl) {
				throw new Error("Missing Hub redirect URL");
			}

			window.location.href = redirectUrl;
		} catch (error) {
			setError(error instanceof Error ? error.message : "Hub signup failed");
			setHubLoading(false);
		}
	};

	const handleGoogleRegister = async () => {
		if (!params.googleAuthEnabled || typeof window === "undefined") {
			return;
		}

		setError("");
		setSocialLoading(true);

		try {
			const result = await signIn.social({
				provider: "google",
				callbackURL: `${window.location.origin}${params.nextPath}`,
			});

			if (result.error) {
				throw new Error(
					formatAuthErrorMessage(result.error.message) ||
						"Google signup failed",
				);
			}

			if (result.data?.redirect) {
				return;
			}

			const redirectUrl = result.data?.url;
			if (!redirectUrl) {
				throw new Error("Missing Google redirect URL");
			}

			window.location.href = redirectUrl;
		} catch (error) {
			setError(error instanceof Error ? error.message : "Google signup failed");
			setSocialLoading(false);
		}
	};

	return {
		name,
		setName,
		email,
		setEmail,
		password,
		setPassword,
		error,
		loading,
		socialLoading,
		hubLoading,
		isAnyLoading: loading || socialLoading || hubLoading,
		handleSubmit,
		handleHubRegister,
		handleGoogleRegister,
	};
}
