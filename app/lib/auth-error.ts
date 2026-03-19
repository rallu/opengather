export function formatAuthErrorMessage(message?: string): string {
	const normalizedMessage = message?.trim();
	if (!normalizedMessage) {
		return "Authentication failed";
	}

	if (normalizedMessage.toLowerCase() === "invalid origin") {
		return "Invalid origin. Set APP_BASE_URL to your public application URL, then redeploy.";
	}

	return normalizedMessage;
}
