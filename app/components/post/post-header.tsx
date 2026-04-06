import { ProfileImage } from "~/components/profile/profile-image";
import { LocalizedTimestamp } from "~/components/ui/localized-timestamp";
import type { PostAuthorSummary } from "~/server/post-author.service.server";
import type { PostGroup } from "~/server/post-list.service.server/core";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "../ui/breadcrumb";
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
	author: PostAuthorSummary;
	createdAt?: string;
	group?: PostGroup;
	moderationStatus?: "pending" | "approved" | "rejected" | "flagged";
	isHidden?: boolean;
	isDeleted?: boolean;
};

export function PostHeader({
	author,
	createdAt,
	moderationStatus,
	group,
	isHidden = false,
	isDeleted = false,
}: PostHeaderProps) {
	const displayAuthor = author.name.trim() || "Member";

	return (
		<PostHeading
			media={
				<ProfileImage
					src={author.imageSrc}
					alt={displayAuthor}
					fallback={buildAuthorFallback(displayAuthor)}
					size="md"
				/>
			}
			title={
				<span className="flex flex-wrap items-center gap-2">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								{author.profilePath ? (
									<BreadcrumbLink to={author.profilePath}>
										{author.name}
									</BreadcrumbLink>
								) : (
									<span>{author.name}</span>
								)}
							</BreadcrumbItem>
							{group ? (
								<>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbLink to={`/groups/${group.id}`}>
											{group.name}
										</BreadcrumbLink>
									</BreadcrumbItem>
								</>
							) : null}
						</BreadcrumbList>
					</Breadcrumb>
					<PostLabels
						isAgent={author.kind === "agent"}
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
