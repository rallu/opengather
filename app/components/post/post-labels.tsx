import { Badge } from "~/components/ui/badge";

type PostLabelsProps = {
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
};

function getStatusTone(
	status: NonNullable<PostLabelsProps["moderationStatus"]>,
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

export function PostLabels({
	moderationStatus,
	isHidden = false,
	isDeleted = false,
}: PostLabelsProps) {
	if (!moderationStatus && !isHidden && !isDeleted) {
		return null;
	}

	return (
		<span className="inline-flex flex-wrap items-center gap-2">
			{moderationStatus ? (
				<Badge variant={getStatusTone(moderationStatus)} className="capitalize">
					{moderationStatus}
				</Badge>
			) : null}
			{isHidden ? <Badge variant="default">hidden</Badge> : null}
			{isDeleted ? <Badge variant="default">deleted</Badge> : null}
		</span>
	);
}
