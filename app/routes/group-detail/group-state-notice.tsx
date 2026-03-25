import { Form, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import type { GroupDetailLoaderData } from "./loader.server";

export function GroupStateNotice(params: {
	data: GroupDetailLoaderData;
	loading: boolean;
}) {
	if (params.data.status === "not_setup") {
		return (
			<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				Setup is not completed.
			</div>
		);
	}

	if (params.data.status === "not_found") {
		return (
			<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				Group not found.
			</div>
		);
	}

	if (params.data.status === "requires_authentication") {
		return (
			<Container className="p-5" data-testid="group-requires-auth-state">
				<p className="text-sm text-muted-foreground">
					Sign in to view or request access to this group.
				</p>
				<div className="mt-4 flex gap-3">
					<Button asChild>
						<Link to="/login">Sign In</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to="/register">Register</Link>
					</Button>
				</div>
			</Container>
		);
	}

	if (
		params.data.status !== "forbidden" &&
		params.data.status !== "pending_membership"
	) {
		return null;
	}

	return (
		<Container className="p-5" data-testid="group-membership-state">
			<p className="text-sm text-muted-foreground">
				{params.data.status === "pending_membership"
					? "Your membership request is still pending approval."
					: "You do not have access to this group yet."}
			</p>
			{params.data.joinState === "join" || params.data.joinState === "request" ? (
				<Form method="post" className="mt-4">
					<input type="hidden" name="_action" value="request-access" />
					<Button
						type="submit"
						disabled={params.loading}
						data-testid="group-request-access"
					>
						{params.data.joinState === "join" ? "Join group" : "Request access"}
					</Button>
				</Form>
			) : null}
		</Container>
	);
}
