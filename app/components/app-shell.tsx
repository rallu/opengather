import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { ShellSearch } from "~/components/search/shell-search";
import { Button } from "~/components/ui/button";
import { Container } from "~/components/ui/container";
import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";

type NotificationSummaryData = {
	unreadCount: number;
	pendingApprovalCount: number;
	canAccessApprovals: boolean;
};

type ShellAuthUser = {
	id: string;
	name: string;
} | null;

type NavItem = {
	to: string;
	label: string;
	testId: string;
	activePrefixes?: string[];
};

type AppShellProps = {
	authUser: ShellAuthUser;
	title?: string;
	subtitle?: string;
	showServerSettings?: boolean;
	searchQuery?: string;
	aside?: ReactNode;
	children: ReactNode;
};

const guestNavItems: NavItem[] = [
	{ to: "/feed", label: "Feed", testId: "shell-nav-feed" },
];

function getMemberNavItems(authUserId: string): NavItem[] {
	return [
		{ to: "/feed", label: "Feed", testId: "shell-nav-feed" },
		{ to: "/groups", label: "Groups", testId: "shell-nav-groups" },
		{
			to: `/profiles/${authUserId}`,
			label: "Profile",
			testId: "shell-nav-profile",
			activePrefixes: ["/profile", `/profiles/${authUserId}`],
		},
		{
			to: "/profiles",
			label: "Profiles",
			testId: "shell-nav-profiles",
			activePrefixes: ["/profiles"],
		},
		{
			to: "/notifications",
			label: "Notifications",
			testId: "shell-nav-notifications",
		},
	];
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
	const prefixes = item.activePrefixes ?? [item.to];
	return prefixes.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

function NavBadge(props: { count: number; testId: string }) {
	return (
		<span
			className="rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold"
			data-testid={props.testId}
		>
			{props.count}
		</span>
	);
}

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
	const notificationSummaryFetcher = useFetcher<NotificationSummaryData>();
	const notificationRefreshKey = `${location.pathname}:${location.search}`;
	const lastNotificationRefreshKeyRef = useRef<string | null>(null);
	const lastRouteKeyRef = useRef(notificationRefreshKey);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
	const authUser = props.authUser;
	const logoutAction = `/logout?next=${encodeURIComponent(
		`${location.pathname}${location.search}`,
	)}`;

	useEffect(() => {
		if (!authUser) {
			lastNotificationRefreshKeyRef.current = null;
			return;
		}
		if (lastNotificationRefreshKeyRef.current === notificationRefreshKey) {
			return;
		}
		if (notificationSummaryFetcher.state === "idle") {
			lastNotificationRefreshKeyRef.current = notificationRefreshKey;
			notificationSummaryFetcher.load("/api/notifications/summary");
		}
	}, [authUser, notificationRefreshKey, notificationSummaryFetcher]);

	useEffect(() => {
		if (lastRouteKeyRef.current === notificationRefreshKey) {
			return;
		}
		lastRouteKeyRef.current = notificationRefreshKey;
		setMobileNavOpen(false);
		setMobileDetailsOpen(false);
	}, [notificationRefreshKey]);

	const notificationSummary = notificationSummaryFetcher.data;
	const navItems = authUser
		? [
				...getMemberNavItems(authUser.id),
				...(notificationSummary?.canAccessApprovals
					? [
							{
								to: "/approvals",
								label: "Approvals",
								testId: "shell-nav-approvals",
							},
						]
					: []),
				...(props.showServerSettings
					? [
							{
								to: "/server-settings",
								label: "Server",
								testId: "shell-nav-server",
							},
						]
					: []),
			]
		: guestNavItems;

	const activeItem = navItems.find((item) =>
		isNavItemActive(location.pathname, item),
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
					{authUser ? authUser.name : "Guest access"}
				</p>
				<p className="text-sm text-muted-foreground">
					{authUser
						? "You're signed in and can participate where your permissions allow."
						: "Sign in or register to post, reply, and manage your account."}
				</p>
			</ShellPanel>
		</>
	);
	const asideContent = props.aside ?? defaultAside;

	const searchForm = (testId: string) => (
		<div className="min-w-0 flex-1">
			<ShellSearch initialQuery={searchQuery} testId={testId} />
		</div>
	);

	const authControls = (variant: "desktop" | "mobile") =>
		authUser ? (
			<form method="post" action={logoutAction}>
				<Button
					type="submit"
					variant="ghost"
					className={cn(
						"justify-center",
						variant === "desktop" ? "shrink-0 px-2 sm:px-3" : "w-full",
					)}
					size={variant === "desktop" ? "sm" : "default"}
					data-testid={
						variant === "desktop"
							? "shell-sign-out"
							: "shell-sign-out-mobile"
					}
				>
					Sign Out
				</Button>
			</form>
		) : (
			<div
				className={cn(
					variant === "desktop"
						? "flex shrink-0 items-center gap-2"
						: "grid gap-2",
				)}
			>
				<Button
					variant="ghost"
					size={variant === "desktop" ? "sm" : "default"}
					className={cn(
						"justify-center",
						variant === "desktop" ? "px-2 sm:px-3" : "w-full",
					)}
					asChild
				>
					<Link
						to="/login"
						data-testid={
							variant === "desktop"
								? "shell-sign-in-link"
								: "shell-sign-in-link-mobile"
						}
					>
						Sign In
					</Link>
				</Button>
				<Button
					size={variant === "desktop" ? "sm" : "default"}
					className={cn(
						"justify-center",
						variant === "desktop" ? "" : "w-full",
					)}
					asChild
				>
					<Link
						to="/register"
						data-testid={
							variant === "desktop"
								? "shell-register-link"
								: "shell-register-link-mobile"
						}
					>
						Register
					</Link>
				</Button>
			</div>
		);

	const mobileNavUtilityContent = (
		<>
			{searchForm("shell-search-mobile")}
			{authControls("mobile")}
		</>
	);

	const navContent = (variant: "desktop" | "mobile") => (
		<nav className="space-y-1">
			{navItems.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					data-testid={
						variant === "desktop" ? item.testId : `${item.testId}-mobile`
					}
					className={cn(
						"flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
						activeItem === item.to
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
					)}
				>
					<span>{item.label}</span>
					{item.to === "/notifications" &&
					notificationSummary &&
					notificationSummary.unreadCount > 0 ? (
						<NavBadge
							count={notificationSummary.unreadCount}
							testId={
								variant === "desktop"
									? "shell-nav-notifications-badge"
									: "shell-nav-notifications-badge-mobile"
							}
						/>
					) : null}
					{item.to === "/approvals" &&
					notificationSummary &&
					notificationSummary.pendingApprovalCount > 0 ? (
						<NavBadge
							count={notificationSummary.pendingApprovalCount}
							testId={
								variant === "desktop"
									? "shell-nav-approvals-badge"
									: "shell-nav-approvals-badge-mobile"
							}
						/>
					) : null}
				</Link>
			))}
		</nav>
	);

	return (
		<div className="min-h-screen bg-background">
			<header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
				<div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0 rounded-full lg:hidden"
						onClick={() => setMobileNavOpen(true)}
						data-testid="shell-mobile-nav-trigger"
						aria-label="Open navigation"
					>
						<Icon name="menu" size={18} />
					</Button>

					<Link
						to="/feed"
						className="flex min-w-0 flex-1 items-center gap-2 font-semibold tracking-tight text-foreground lg:flex-none"
					>
						<img src="/logo.svg" alt="OpenGather" className="h-8" />
						<span className="text-sm sm:text-base">OpenGather</span>
					</Link>

					<div className="hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex">
						<div className="min-w-0 max-w-md flex-1">
							{searchForm("shell-search")}
						</div>
						{authControls("desktop")}
					</div>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0 px-2 lg:hidden"
						onClick={() => setMobileDetailsOpen(true)}
						data-testid="shell-mobile-details-trigger"
					>
						Details
					</Button>
				</div>
			</header>

			<Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
				{mobileNavOpen ? (
					<DialogContent
						className="top-0 right-auto bottom-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100%-3rem))] rounded-none rounded-r-3xl border-r border-border/80 p-0 backdrop:bg-black/40 lg:hidden"
						data-testid="shell-mobile-nav-drawer"
						data-dialog-motion="from-left"
					>
						<DialogHeader className="border-b border-border/80 bg-background/95">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<DialogTitle>Navigation</DialogTitle>
									<DialogDescription>
										Move between the main sections of the app.
									</DialogDescription>
								</div>
								<DialogClose
									className="h-8 w-8 rounded-full p-0"
									aria-label="Close navigation"
								>
									<Icon name="x" size={16} />
								</DialogClose>
							</div>
						</DialogHeader>
						<DialogBody className="space-y-4 overflow-y-auto">
							<ShellPanel>{mobileNavUtilityContent}</ShellPanel>
							<ShellPanel>{navContent("mobile")}</ShellPanel>
						</DialogBody>
					</DialogContent>
				) : null}
			</Dialog>

			<Dialog open={mobileDetailsOpen} onOpenChange={setMobileDetailsOpen}>
				{mobileDetailsOpen ? (
					<DialogContent
						className="top-0 right-0 bottom-0 left-auto m-0 h-dvh max-h-none w-[min(22rem,calc(100%-2rem))] rounded-none rounded-l-3xl border-l border-border/80 p-0 backdrop:bg-black/40 lg:hidden"
						data-testid="shell-mobile-details-drawer"
						data-dialog-motion="from-right"
					>
						<DialogHeader className="border-b border-border/80 bg-background/95">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<DialogTitle>Details</DialogTitle>
									<DialogDescription>
										Secondary context and route-specific tools.
									</DialogDescription>
								</div>
								<DialogClose
									className="h-8 w-8 rounded-full p-0"
									aria-label="Close details"
								>
									<Icon name="x" size={16} />
								</DialogClose>
							</div>
						</DialogHeader>
						<DialogBody className="space-y-4 overflow-y-auto">
							{asideContent}
						</DialogBody>
					</DialogContent>
				) : null}
			</Dialog>

			<main className="mx-auto w-full max-w-7xl px-4 pt-24 pb-8 sm:px-6">
				<div
					className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px]"
					data-testid="shell-main"
				>
					<aside className="order-2 hidden min-w-0 lg:order-1 lg:block">
						<div className="space-y-4 lg:sticky lg:top-24">
							<ShellPanel>{navContent("desktop")}</ShellPanel>
						</div>
					</aside>

					<section className="order-1 min-w-0 space-y-6 lg:order-2">
						{props.children}
					</section>

					<aside className="order-3 hidden min-w-0 lg:block">
						<div className="space-y-4 lg:sticky lg:top-24">{asideContent}</div>
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
