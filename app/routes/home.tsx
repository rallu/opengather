import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { signOut, useSession } from "~/lib/auth-client";
import { shouldRedirectHome } from "~/server/home-route.server";
import { getAuthUserFromRequest } from "~/server/session.server";
import { getSetupStatus } from "~/server/setup.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const [status, authUser] = await Promise.all([
			getSetupStatus(),
			getAuthUserFromRequest({ request }),
		]);
		if (
			shouldRedirectHome({
				isSetup: status.isSetup,
				isAuthenticated: Boolean(authUser),
			})
		) {
			return redirect("/feed");
		}

		return {
			isSetup: status.isSetup,
			instanceName: status.instance?.name ?? "",
		};
	} catch {
		return {
			isSetup: false,
			instanceName: "",
		};
	}
}

export default function Home() {
	const { data: session, isPending } = useSession();
	const data = useLoaderData<typeof loader>();

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
			<h1
				className="text-4xl font-bold tracking-tight"
				data-testid="home-title"
			>
				OpenGather
			</h1>
			<p className="text-lg text-muted-foreground">
				Self-hosted community feed for privacy-first groups.
			</p>

			{data.isSetup === false ? (
				<Button asChild>
					<Link to="/setup" data-testid="home-run-setup-link">
						Run First Setup
					</Link>
				</Button>
			) : (
				<>
					<div
						className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground"
						data-testid="home-instance-ready"
					>
						Instance ready:{" "}
						<span className="font-medium text-foreground">
							{data.instanceName}
						</span>
					</div>
					<Button asChild>
						<Link to="/feed" data-testid="home-open-feed-link">
							Open Feed
						</Link>
					</Button>
				</>
			)}

			{data.isSetup ? (
				isPending ? (
					<p className="text-muted-foreground">Loading...</p>
				) : session ? (
					<div className="flex flex-col items-center gap-4">
						<p className="text-lg">
							Hello, <span className="font-semibold">{session.user.name}</span>!
						</p>
						<Button variant="outline" onClick={() => signOut()}>
							<span data-testid="home-sign-out">Sign Out</span>
						</Button>
					</div>
				) : (
					<div className="flex flex-wrap justify-center gap-4">
						<Button asChild>
							<Link to="/login" data-testid="home-sign-in-link">
								Sign In
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/register" data-testid="home-sign-up-link">
								Sign Up
							</Link>
						</Button>
					</div>
				)
			) : null}
		</div>
	);
}
