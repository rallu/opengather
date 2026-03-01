import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect } from "react-router";
import { Button } from "~/components/ui/button";
import { completeHubLogin } from "~/server/hub.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	if (!code) {
		return new Response("Missing code", { status: 400 });
	}

	try {
		await completeHubLogin({ code });
		return redirect("/");
	} catch {
		return null;
	}
}

export default function HubCallback() {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-3xl font-bold">Hub Callback</h1>
			<p className="text-destructive">Failed to complete Hub login.</p>
			<Button asChild variant="outline">
				<Link to="/">Back home</Link>
			</Button>
		</div>
	);
}
