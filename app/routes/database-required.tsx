import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export default function DatabaseRequiredPage() {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-start justify-center gap-6 p-8">
			<h1 className="text-3xl font-bold">Server Misconfiguration</h1>
			<p className="text-muted-foreground">
				`DATABASE_URL` is missing. Set it in the server environment and restart
				the app.
			</p>
			<div className="rounded-md border border-border p-4 text-sm">
				<p>Required variable:</p>
				<p className="mt-2 font-mono">DATABASE_URL=postgresql://...</p>
			</div>
			<Button asChild variant="outline">
				<Link to="/">Back home</Link>
			</Button>
		</div>
	);
}
