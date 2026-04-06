import { AuthorizePage } from "./authorize/authorize-page";
import type { action, loader } from "./authorize/route.server";

export { action, loader } from "./authorize/route.server";

export default function AuthorizeRoute() {
	return <AuthorizePage />;
}
