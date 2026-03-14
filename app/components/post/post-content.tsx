import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type PostContentProps = {
	body?: string;
	createdAt?: string;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
	contextLabel?: string;
	className?: string;
};

function getStatusTone(
	status: NonNullable<PostContentProps["moderationStatus"]>,
): "success" | "warning" | "danger" | "default" {
	switch (status) {
		case "approved":
			return "success";
		case "rejected":
			return "danger";
		case "flagged":
			return "warning";
		default:
			return "default";
	}
}

export function PostContent({
	body,
	createdAt,
	moderationStatus,
	isHidden = false,
	isDeleted = false,
	contextLabel,
	className,
}: PostContentProps) {
	const hasMeta =
		Boolean(contextLabel) ||
		Boolean(moderationStatus) ||
		isHidden ||
		isDeleted ||
		Boolean(createdAt);

	return (
		<div className={cn("space-y-3", className)}>
			{hasMeta ? (
				<div className="flex flex-wrap items-center gap-2 text-xs">
					{contextLabel ? (
						<span className="font-medium text-foreground">{contextLabel}</span>
					) : null}
					{moderationStatus ? (
						<Badge
							variant={getStatusTone(moderationStatus)}
							className="capitalize"
						>
							{moderationStatus}
						</Badge>
					) : null}
					{isHidden ? <Badge variant="default">hidden</Badge> : null}
					{isDeleted ? <Badge variant="default">deleted</Badge> : null}
					{createdAt ? (
						<span className="text-muted-foreground">
							{new Date(createdAt).toLocaleString()}
						</span>
					) : null}
				</div>
			) : null}
			<p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
				{body ?? "(no text)"}
			</p>
		</div>
	);
}
