import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type SearchPostListItemProps = {
	authorName: string;
	excerpt: string;
	groupName?: string;
	to: string;
	onSelect?: () => void;
	className?: string;
	testId?: string;
};

export function SearchPostListItem({
	authorName,
	excerpt,
	groupName,
	to,
	onSelect,
	className,
	testId,
}: SearchPostListItemProps) {
	return (
		<Link
			to={to}
			onClick={onSelect}
			data-testid={testId}
			className={cn(
				"block rounded-xl border border-transparent px-3 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="min-w-0 truncate text-sm font-medium text-foreground">
					{authorName}
				</p>
				{groupName ? (
					<Badge variant="neutral" className="shrink-0">
						{groupName}
					</Badge>
				) : null}
			</div>
			<p className="mt-1 text-sm leading-6 text-muted-foreground">{excerpt}</p>
		</Link>
	);
}
