import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { PostActionData } from "./post-actions";
import { PostActionItem, PostActions } from "./post-actions";
import { PostLabels } from "./post-labels";

type PostContentProps = {
	children?: ReactNode;
	createdAt?: string;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
	actions?: PostActionData[];
	className?: string;
};

export function PostContent({
	children,
	createdAt,
	moderationStatus,
	isHidden = false,
	isDeleted = false,
	actions,
	className,
}: PostContentProps) {
	const hasMeta =
		Boolean(moderationStatus) || isHidden || isDeleted || Boolean(createdAt);

	return (
		<div className={cn("space-y-3", className)}>
			{hasMeta ? (
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<PostLabels
						moderationStatus={moderationStatus}
						isHidden={isHidden}
						isDeleted={isDeleted}
					/>
					{createdAt ? (
						<span className="text-muted-foreground">
							{new Date(createdAt).toLocaleString()}
						</span>
					) : null}
				</div>
			) : null}
			<div className="text-sm leading-7 text-foreground [&_p]:whitespace-pre-wrap">
				{children ?? <p>(no text)</p>}
			</div>
			{actions?.length ? (
				<PostActions className="border-t border-border/80 pt-3">
					{actions.map((action) =>
						action.to ? (
							<PostActionItem
								key={action.label}
								asChild
								data-testid={action.testId}
								className={cn(
									action.isActive
										? "bg-accent text-foreground hover:bg-accent"
										: undefined,
								)}
							>
								<Link to={action.to}>{action.label}</Link>
							</PostActionItem>
						) : (
							<PostActionItem
								key={action.label}
								type="button"
								disabled={action.disabled}
								onClick={action.onClick}
								aria-pressed={action.isActive}
								data-testid={action.testId}
								className={cn(
									action.isActive
										? "bg-accent text-foreground hover:bg-accent"
										: undefined,
								)}
							>
								{action.label}
							</PostActionItem>
						),
					)}
				</PostActions>
			) : null}
		</div>
	);
}
