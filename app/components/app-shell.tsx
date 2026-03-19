import type { ReactNode } from "react";
import { Form, Link, useLocation } from "react-router";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
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
	aside?: ReactNode;
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

function ShellPanel(props: { children?: ReactNode; className?: string }) {
	return (
		<Container
			className={cn("rounded-lg border-border/50 bg-card", props.className)}
		>
			{props.children ? (
				<div className="space-y-3 p-5">{props.children}</div>
			) : null}
		</Container>
	);
}

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
	const defaultAside = (
		<>
			<ShellPanel>
				<div className="space-y-2 text-sm text-muted-foreground">
					<p>The center column is for the main task on each route.</p>
					<p>
						Route-specific tools live on the right so the main content stays
						calm.
					</p>
				</div>
			</ShellPanel>
			<ShellPanel>
				<p className="text-sm text-foreground">
					{props.authUser ? props.authUser.name : "Guest access"}
				</p>
				<p className="text-sm text-muted-foreground">
					{props.authUser
						? "You're signed in and can participate where your permissions allow."
						: "Sign in or register to post, reply, and manage your account."}
				</p>
			</ShellPanel>
		</>
	);

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-border/80 bg-background/90 backdrop-blur-xl">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex min-w-0 flex-col gap-1">
							<Link
								to="/feed"
								className="text-[1.8rem] font-semibold tracking-tight text-foreground"
							>
								OpenGather
							</Link>
						</div>
						<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
							<Form
								method="get"
								action="/feed"
								className="relative flex-1 sm:min-w-80"
							>
								<Input
									name="q"
									data-testid="shell-search"
									defaultValue={searchQuery}
									placeholder="Search"
									leadingAccessory={<Icon name="search" />}
								/>
							</Form>
							{props.authUser ? (
								<div className="flex items-center justify-end gap-2">
									<span className="hidden rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground md:inline">
										{props.authUser.name}
									</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => signOut()}
										data-testid="shell-sign-out"
									>
										Sign Out
									</Button>
								</div>
							) : (
								<div className="flex items-center justify-end gap-2">
									<Button variant="ghost" size="sm" asChild>
										<Link to="/login" data-testid="shell-sign-in-link">
											Sign In
										</Link>
									</Button>
									<Button size="sm" asChild>
										<Link to="/register" data-testid="shell-register-link">
											Register
										</Link>
									</Button>
								</div>
							)}
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
				<div
					className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px]"
					data-testid="shell-main"
				>
					<aside className="order-2 min-w-0 lg:order-1">
						<div className="space-y-4 lg:sticky lg:top-24">
							<ShellPanel>
								<nav className="space-y-1">
									{navItems.map((item) => (
										<Link
											key={item.to}
											to={item.to}
											data-testid={item.testId}
											className={cn(
												"flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
												activeItem === item.to
													? "bg-primary text-primary-foreground"
													: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
											)}
										>
											<span>{item.label}</span>
										</Link>
									))}
								</nav>
							</ShellPanel>
							<ShellPanel>
								<p className="text-sm text-muted-foreground">
									Search always returns to the feed so results stay in one
									place.
								</p>
							</ShellPanel>
						</div>
					</aside>

					<section className="order-1 min-w-0 space-y-6 lg:order-2">
						{props.children}
					</section>

					<aside className="order-3 min-w-0">
						<div className="space-y-4 lg:sticky lg:top-24">
							{props.aside ?? defaultAside}
						</div>
					</aside>
				</div>
			</main>

			<footer className="border-t border-border/80 bg-background/80">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
					<p>
						OpenGather keeps navigation, content, and secondary tools in
						separate rails.
					</p>
					<p>Built for slower reading and clearer conversations.</p>
				</div>
			</footer>
		</div>
	);
}
