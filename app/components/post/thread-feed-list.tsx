import * as React from "react";
import { Link, useFetcher } from "react-router";
import { ButtonGroup, ButtonGroupItem } from "~/components/ui/button-group";
import { Spinner } from "~/components/ui/spinner";
import type {
	PostListItem,
	PostListPage,
	PostListSortMode,
} from "~/server/post-list.service.server";

function withCursor(apiPath: string, cursor: string) {
	const separator = apiPath.includes("?") ? "&" : "?";
	return `${apiPath}${separator}cursor=${encodeURIComponent(cursor)}`;
}

export function PostListSortToggle(params: {
	sortMode: PostListSortMode;
	buildHref: (sortMode: PostListSortMode) => string;
	prefix: string;
}) {
	return (
		<ButtonGroup aria-label="Sort threads" className="rounded-full">
			<ButtonGroupItem
				asChild
				variant={params.sortMode === "activity" ? "secondary" : "ghost"}
				className="rounded-l-full"
				data-testid={`${params.prefix}-sort-activity`}
			>
				<Link to={params.buildHref("activity")}>Activity</Link>
			</ButtonGroupItem>
			<ButtonGroupItem
				asChild
				variant={params.sortMode === "newest" ? "secondary" : "ghost"}
				className="rounded-r-full"
				data-testid={`${params.prefix}-sort-newest`}
			>
				<Link to={params.buildHref("newest")}>Newest</Link>
			</ButtonGroupItem>
		</ButtonGroup>
	);
}

export function ThreadFeedList(params: {
	initialPage: PostListPage;
	apiPath: string;
	listTestId: string;
	sentinelTestId: string;
	loadingTestId: string;
	emptyState: React.ReactNode;
	renderItem: (item: PostListItem) => React.ReactNode;
	priorityItem?: PostListItem;
}) {
	const fetcher = useFetcher<PostListPage>();
	const prioritizeItem = React.useCallback(
		(items: PostListItem[]) => {
			if (!params.priorityItem) {
				return items;
			}

			return [
				params.priorityItem,
				...items.filter((item) => item.id !== params.priorityItem?.id),
			];
		},
		[params.priorityItem],
	);
	const [items, setItems] = React.useState(() =>
		prioritizeItem(params.initialPage.items),
	);
	const [nextCursor, setNextCursor] = React.useState(
		params.initialPage.nextCursor,
	);
	const [hasMore, setHasMore] = React.useState(params.initialPage.hasMore);
	const lastRequestedCursorRef = React.useRef<string | null>(null);
	const sentinelRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		setItems(prioritizeItem(params.initialPage.items));
		setNextCursor(params.initialPage.nextCursor);
		setHasMore(params.initialPage.hasMore);
		lastRequestedCursorRef.current = null;
	}, [
		params.initialPage.hasMore,
		params.initialPage.items,
		params.initialPage.nextCursor,
		prioritizeItem,
	]);

	React.useEffect(() => {
		const page = fetcher.data;
		if (!page || !("items" in page)) {
			return;
		}

		setItems((currentItems) => {
			const mergedItems = [...currentItems];
			const seenIds = new Set(currentItems.map((item) => item.id));

			for (const item of page.items) {
				if (seenIds.has(item.id)) {
					continue;
				}
				seenIds.add(item.id);
				mergedItems.push(item);
			}

			return prioritizeItem(mergedItems);
		});
		setNextCursor(page.nextCursor);
		setHasMore(page.hasMore);
		lastRequestedCursorRef.current = null;
	}, [fetcher.data, prioritizeItem]);

	React.useEffect(() => {
		if (!params.priorityItem) {
			return;
		}

		setItems((currentItems) => prioritizeItem(currentItems));
	}, [params.priorityItem, prioritizeItem]);

	const requestMore = React.useEffectEvent((cursor: string) => {
		if (fetcher.state !== "idle" || lastRequestedCursorRef.current === cursor) {
			return;
		}

		lastRequestedCursorRef.current = cursor;
		fetcher.load(withCursor(params.apiPath, cursor));
	});

	React.useEffect(() => {
		if (!hasMore || !nextCursor) {
			return;
		}

		const sentinel = sentinelRef.current;
		if (!sentinel) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					requestMore(nextCursor);
				}
			},
			{
				rootMargin: "240px 0px",
			},
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, nextCursor]);

	return (
		<>
			<div className="space-y-3" data-testid={params.listTestId}>
				{items.length === 0 ? params.emptyState : null}
				{items.map((item) => params.renderItem(item))}
			</div>
			{hasMore ? (
				<div
					ref={sentinelRef}
					className="flex min-h-12 items-center justify-center py-2"
					data-testid={params.sentinelTestId}
				>
					{fetcher.state !== "idle" ? (
						<div
							className="inline-flex items-center gap-2 text-sm text-muted-foreground"
							data-testid={params.loadingTestId}
						>
							<Spinner size="sm" />
							<span>Loading more threads</span>
						</div>
					) : (
						<span className="text-sm text-muted-foreground">
							Scroll to load more
						</span>
					)}
				</div>
			) : null}
		</>
	);
}
