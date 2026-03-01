import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { signOut, useSession } from "~/lib/auth-client";
import { getSetupStatus } from "~/server/setup.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
	void request;

	try {
		const status = await getSetupStatus();

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
			<h1 className="text-4xl font-bold tracking-tight">OpenGather MVP</h1>
			<p className="text-lg text-muted-foreground">
				Single-tenant community instance with Hub identity.
			</p>

			{data.isSetup === false ? (
				<Button asChild>
					<Link to="/setup">Run First Setup</Link>
				</Button>
			) : (
				<>
					<div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
						Instance ready:{" "}
						<span className="font-medium text-foreground">
							{data.instanceName}
						</span>
					</div>
					<Button asChild>
						<Link to="/community">Open Community</Link>
					</Button>
				</>
			)}

			{data.isSetup ? (
				<>
					<Button variant="outline" asChild>
						<Link to="/auth/hub/login">Login via Hub (MVP)</Link>
					</Button>

					{isPending ? (
						<p className="text-muted-foreground">Loading...</p>
					) : session ? (
						<div className="flex flex-col items-center gap-4">
							<p className="text-lg">
								Hello,{" "}
								<span className="font-semibold">{session.user.name}</span>!
							</p>
							<Button variant="outline" onClick={() => signOut()}>
								Sign Out
							</Button>
						</div>
					) : (
						<div className="flex flex-wrap justify-center gap-4">
							<Button asChild>
								<Link to="/login">Sign In</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/register">Sign Up</Link>
							</Button>
						</div>
					)}
				</>
			) : null}
		</div>
	);
}
