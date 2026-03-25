import { ProfileImage } from "~/components/profile/profile-image";
import { LocalizedTimestamp } from "~/components/ui/localized-timestamp";
import { PostHeading } from "./post-heading";
import { PostLabels } from "./post-labels";

function buildAuthorFallback(name: string) {
	const initials = name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");

	return initials || "M";
}

type PostHeaderProps = {
	authorName: string;
	authorImageSrc?: string;
	createdAt?: string;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
};

export function PostHeader({
	authorName,
	authorImageSrc,
	createdAt,
	moderationStatus,
	isHidden = false,
	isDeleted = false,
}: PostHeaderProps) {
	const displayAuthor = authorName.trim() || "Member";

	return (
		<PostHeading
			media={
				<ProfileImage
					src={authorImageSrc}
					alt={displayAuthor}
					fallback={buildAuthorFallback(displayAuthor)}
					size="md"
				/>
			}
			title={
				<span className="flex flex-wrap items-center gap-2">
					<span>{displayAuthor}</span>
					<PostLabels
						moderationStatus={moderationStatus}
						isHidden={isHidden}
						isDeleted={isDeleted}
					/>
				</span>
			}
			subtitle={
				createdAt ? (
					<LocalizedTimestamp value={createdAt} />
				) : (
					"Unknown publish time"
				)
			}
		/>
	);
}
