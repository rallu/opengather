import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const getBaseUrl = () => {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return "http://localhost:5173";
};

export const authClient = createAuthClient({
	baseURL: getBaseUrl(),
	plugins: [genericOAuthClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
