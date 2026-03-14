import type { ReactNode } from "react";
import { Form, Link, useLocation } from "react-router";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth-client";
import { cn } from "~/lib/utils";

type ShellAuthUser = {
	name: string;
} | null;

type AppShellProps = {
	authUser: ShellAuthUser;
	title?: string;
	subtitle?: string;
	showServerSettings?: boolean;
	searchQuery?: string;
	children: ReactNode;
};

const baseNavItems = [
	{ to: "/feed", label: "Feed", testId: "shell-nav-feed" },
	{ to: "/groups", label: "Groups", testId: "shell-nav-groups" },
	{
		to: "/notifications",
		label: "Notifications",
		testId: "shell-nav-notifications",
	},
	{ to: "/profile", label: "Profile", testId: "shell-nav-profile" },
	{ to: "/settings", label: "Settings", testId: "shell-nav-settings" },
	{
		to: "/style-guide",
		label: "Style Guide",
		testId: "shell-nav-style-guide",
	},
];

export function AppShell(props: AppShellProps) {
	const location = useLocation();
	const navItems = props.authUser
		? props.showServerSettings
			? [
					...baseNavItems,
					{
						to: "/server-settings",
						label: "Server",
						testId: "shell-nav-server",
					},
				]
			: baseNavItems
		: [
				{ to: "/feed", label: "Feed", testId: "shell-nav-feed" },
				{
					to: "/style-guide",
					label: "Style Guide",
					testId: "shell-nav-style-guide",
				},
			];

	const activeItem = navItems.find((item) =>
		location.pathname.startsWith(item.to),
	)?.to;
	const searchQuery =
		props.searchQuery ?? new URLSearchParams(location.search).get("q") ?? "";

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-border bg-background/95 backdrop-blur">
				<div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<div className="flex items-center gap-4">
						<Link to="/feed" className="text-lg font-semibold tracking-tight">
							OpenGather
						</Link>
						<nav className="flex items-center gap-1 overflow-x-auto">
							{navItems.map((item) => (
								<Link
									key={item.to}
									to={item.to}
									data-testid={item.testId}
									className={cn(
										"rounded-md px-3 py-2 text-sm transition-colors",
										activeItem === item.to
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
									)}
								>
									{item.label}
								</Link>
							))}
						</nav>
					</div>
					<div className="flex w-full items-center gap-2 sm:w-auto">
						<Form method="get" action="/feed" className="flex-1 sm:w-72">
							<input
								name="q"
								data-testid="shell-search"
								defaultValue={searchQuery}
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								placeholder="Search"
							/>
						</Form>
						{props.authUser ? (
							<>
								<span className="hidden text-sm text-muted-foreground md:inline">
									{props.authUser.name}
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => signOut()}
									data-testid="shell-sign-out"
								>
									Sign Out
								</Button>
							</>
						) : (
							<>
								<Button variant="outline" size="sm" asChild>
									<Link to="/login" data-testid="shell-sign-in-link">
										Sign In
									</Link>
								</Button>
								<Button size="sm" asChild>
									<Link to="/register" data-testid="shell-register-link">
										Register
									</Link>
								</Button>
							</>
						)}
					</div>
				</div>
			</header>

			<main
				className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6"
				data-testid="shell-main"
			>
				{props.title ? (
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold tracking-tight">
							{props.title}
						</h1>
						{props.subtitle ? (
							<p className="text-sm text-muted-foreground">{props.subtitle}</p>
						) : null}
					</div>
				) : null}
				{props.children}
			</main>
		</div>
	);
}
