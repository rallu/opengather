import type { action, loader } from "./authorize/route.server";
import { AuthorizePage } from "./authorize/authorize-page";

export { action, loader } from "./authorize/route.server";

export default function AuthorizeRoute() {
	return <AuthorizePage />;
}
