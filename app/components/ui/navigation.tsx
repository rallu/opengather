import { Link } from "react-router";

import { cn } from "~/lib/utils";

type NavigationItem = {
	label: string;
	to: string;
	active?: boolean;
};

type NavigationProps = {
	items: NavigationItem[];
	className?: string;
};

export function Navigation({ items, className }: NavigationProps) {
	return (
		<nav
			className={cn(
				"elevation-low flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5",
				className,
			)}
		>
			{items.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					className={cn(
						"rounded-md px-3 py-2 text-sm font-medium transition-colors",
						item.active
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
					)}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}

export function SubNavigation({ items, className }: NavigationProps) {
	return (
		<nav className={cn("flex flex-wrap items-center gap-3", className)}>
			{items.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					className={cn(
						"border-b-2 pb-1.5 text-sm font-medium transition-colors",
						item.active
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground",
					)}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}
