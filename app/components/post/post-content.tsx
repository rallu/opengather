import type { ReactNode } from "react";

import { ButtonGroup, ButtonGroupItem } from "~/components/ui/button-group";
import { cn } from "~/lib/utils";
import type { PostActionData } from "./post-actions";
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
				<div className="border-t border-border pt-3">
					<ButtonGroup>
						{actions.map((action) =>
							action.to ? (
								<ButtonGroupItem
									key={action.label}
									asChild
									className={cn(
										action.isActive
											? "bg-accent text-foreground hover:bg-accent"
											: undefined,
									)}
								>
									<a href={action.to} data-testid={action.testId}>
										{action.label}
									</a>
								</ButtonGroupItem>
							) : (
								<ButtonGroupItem
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
								</ButtonGroupItem>
							),
						)}
					</ButtonGroup>
				</div>
			) : null}
		</div>
	);
}
