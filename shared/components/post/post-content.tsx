import type { ReactNode } from "react";
import { cn } from "../../../app/lib/utils";
import type { PostActionData } from "../../../app/components/post/post-actions";
import { PostActionItem, PostActions } from "../../../app/components/post/post-actions";
import { PostLabels } from "../../../app/components/post/post-labels";
import { useOpenGatherLinkComponent } from "../../render-context";
import { FormattedTimestamp } from "./formatted-timestamp";

type PostContentProps = {
	actions?: PostActionData[];
	children?: ReactNode;
	className?: string;
	createdAt?: string;
	isDeleted?: boolean;
	isHidden?: boolean;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
};

export function PostContent({
	actions,
	children,
	className,
	createdAt,
	isDeleted = false,
	isHidden = false,
	moderationStatus,
}: PostContentProps) {
	const LinkComponent = useOpenGatherLinkComponent();
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
						<FormattedTimestamp
							value={createdAt}
							className="text-muted-foreground"
						/>
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
								<LinkComponent to={action.to}>{action.label}</LinkComponent>
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
