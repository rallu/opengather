import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";

type NavigationListItemData = {
	id: string;
	title: string;
	description?: string;
	to: string;
	leading?: ReactNode;
	trailing?: ReactNode;
	active?: boolean;
};

type NavigationListSectionData = {
	title: string;
	description?: string;
	items: NavigationListItemData[];
};

type NavigationListProps = {
	sections: NavigationListSectionData[];
	className?: string;
};

export function NavigationList({ sections, className }: NavigationListProps) {
	return (
		<div className={cn("space-y-5", className)}>
			{sections.map((section) => (
				<section key={section.title} className="space-y-3">
					<div className="space-y-1">
						<h3 className="text-sm font-semibold text-foreground">
							{section.title}
						</h3>
						{section.description ? (
							<p className="text-sm text-muted-foreground">
								{section.description}
							</p>
						) : null}
					</div>
					<div className="rounded-lg border border-border bg-card">
						{section.items.map((item, index) => (
							<Link
								key={item.id}
								to={item.to}
								className={cn(
									"flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50",
									item.active ? "bg-accent/70" : undefined,
									index !== 0 ? "border-t border-border" : undefined,
								)}
							>
								{item.leading ? (
									<div className="shrink-0">{item.leading}</div>
								) : null}
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-foreground">
										{item.title}
									</p>
									{item.description ? (
										<p className="mt-1 text-sm text-muted-foreground">
											{item.description}
										</p>
									) : null}
								</div>
								{item.trailing ? (
									<div className="shrink-0 text-xs text-muted-foreground">
										{item.trailing}
									</div>
								) : null}
							</Link>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
