export function shouldRedirectHome(params: {
	isSetup: boolean;
	isAuthenticated: boolean;
}): boolean {
	return params.isSetup && params.isAuthenticated;
}
