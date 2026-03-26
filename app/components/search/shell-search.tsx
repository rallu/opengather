import {
	type ChangeEvent,
	type FormEvent,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from "react";
import { Form, Link, useFetcher } from "react-router";
import { ProfileIdentity } from "~/components/profile/profile-identity";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import {
	MINIMUM_SEARCH_QUERY_LENGTH,
	normalizeSearchQuery,
	type SearchResults,
} from "~/lib/search";
import { SearchPostListItem } from "./search-post-list-item";

type ShellSearchProps = {
	initialQuery: string;
	testId: string;
};

export function ShellSearch({ initialQuery, testId }: ShellSearchProps) {
	const searchFetcher = useFetcher<SearchResults>();
	const rootRef = useRef<HTMLDivElement | null>(null);
	const lastRequestedQueryRef = useRef("");
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState(initialQuery);
	const deferredQuery = useDeferredValue(query);
	const normalizedQuery = normalizeSearchQuery(deferredQuery);
	const hasMinimumQueryLength =
		normalizedQuery.length >= MINIMUM_SEARCH_QUERY_LENGTH;
	const searchResults =
		searchFetcher.data?.query === normalizedQuery ? searchFetcher.data : null;
	const isLoading =
		hasMinimumQueryLength &&
		searchFetcher.state !== "idle" &&
		searchFetcher.data?.query !== normalizedQuery;

	useEffect(() => {
		setQuery(initialQuery);
	}, [initialQuery]);

	useEffect(() => {
		if (!open || !hasMinimumQueryLength) {
			if (!hasMinimumQueryLength) {
				lastRequestedQueryRef.current = "";
			}
			return;
		}

		const handle = window.setTimeout(() => {
			if (lastRequestedQueryRef.current === normalizedQuery) {
				return;
			}

			lastRequestedQueryRef.current = normalizedQuery;
			searchFetcher.load(
				`/api/search?q=${encodeURIComponent(normalizedQuery)}`,
			);
		}, 150);

		return () => window.clearTimeout(handle);
	}, [hasMinimumQueryLength, normalizedQuery, open, searchFetcher]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
			}
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setQuery(event.target.value);
		if (!open) {
			setOpen(true);
		}
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		if (!hasMinimumQueryLength) {
			event.preventDefault();
		}
	}

	const shouldShowPopover =
		open &&
		(Boolean(query.trim()) || isLoading) &&
		(hasMinimumQueryLength || query.trim().length > 0);
	const hasAnyResults = Boolean(
		searchResults &&
			(searchResults.people.length > 0 || searchResults.posts.length > 0),
	);

	return (
		<div ref={rootRef} className="relative">
			<Form method="get" action="/feed" onSubmit={handleSubmit}>
				<Input
					name="q"
					data-testid={testId}
					value={query}
					onChange={handleChange}
					onFocus={() => setOpen(true)}
					placeholder="Search people and posts"
					autoComplete="off"
					className="h-10"
					inputClassName="text-sm"
					leadingAccessory={<Icon name="search" size={14} />}
					trailingAccessory={
						isLoading ? <Spinner size="sm" label="Searching" /> : undefined
					}
				/>
			</Form>

			{shouldShowPopover ? (
				<div
					className="elevation-high absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
					data-testid={`${testId}-popover`}
				>
					<div className="max-h-[26rem] overflow-y-auto p-2">
						{hasMinimumQueryLength ? (
							isLoading ? (
								<div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
									<Spinner size="sm" label="Searching" />
									Searching for “{normalizedQuery}”
								</div>
							) : hasAnyResults ? (
								<div className="space-y-3">
									{searchResults && searchResults.people.length > 0 ? (
										<section
											className="space-y-1"
											data-testid={`${testId}-people-results`}
										>
											<p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												People
											</p>
											{searchResults.people.map((person) => (
												<Link
													key={person.id}
													to={person.profilePath}
													onClick={() => setOpen(false)}
													data-testid={`${testId}-person-${person.id}`}
													className="block rounded-xl border border-transparent px-3 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												>
													<ProfileIdentity
														name={person.name}
														subtitle={person.summary}
														imageSrc={person.imageSrc}
														imageAlt={`${person.name} profile image`}
														fallback={
															person.name.trim().slice(0, 1).toUpperCase() ||
															"?"
														}
													/>
												</Link>
											))}
										</section>
									) : null}

									{searchResults && searchResults.posts.length > 0 ? (
										<section
											className="space-y-1"
											data-testid={`${testId}-post-results`}
										>
											<p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Posts
											</p>
											{searchResults.posts.map((post) => (
												<SearchPostListItem
													key={post.id}
													authorName={post.authorName}
													excerpt={post.excerpt}
													groupName={post.groupName}
													to={post.postPath}
													onSelect={() => setOpen(false)}
													testId={`${testId}-post-${post.id}`}
												/>
											))}
										</section>
									) : null}
								</div>
							) : (
								<p
									className="px-3 py-3 text-sm text-muted-foreground"
									data-testid={`${testId}-empty`}
								>
									No people or posts matched “{normalizedQuery}”.
								</p>
							)
						) : (
							<p
								className="px-3 py-3 text-sm text-muted-foreground"
								data-testid={`${testId}-hint`}
							>
								Type at least {MINIMUM_SEARCH_QUERY_LENGTH} characters to
								search.
							</p>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
