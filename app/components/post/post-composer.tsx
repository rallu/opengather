import * as React from "react";

import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import {
	Selector,
	SelectorAnchor,
	SelectorContent,
	SelectorItem,
	SelectorItemContent,
	SelectorItemDescription,
	SelectorItemTitle,
	SelectorLabel,
	SelectorList,
} from "~/components/ui/selector";
import { Textarea } from "~/components/ui/textarea";
import { plainTextToRichTextDocument } from "~/lib/rich-text";
import { cn } from "~/lib/utils";

type PostComposerVariant = "post" | "reply";

type PostComposerProps = Omit<
	React.HTMLAttributes<HTMLDivElement>,
	"defaultValue"
> & {
	variant?: PostComposerVariant;
	name?: string;
	placeholder?: string;
	rows?: number;
	defaultValue?: string;
	disabled?: boolean;
	loading?: boolean;
	textareaTestId?: string;
	submitTestId?: string;
	submitLabel?: string;
	submittingLabel?: string;
	footer?: React.ReactNode;
	submitClassName?: string;
	resetKey?: string | number | null;
};

type ComposerSuggestion = {
	id: string;
	label: string;
	description: string;
	insertText: string;
};

const SLASH_SUGGESTIONS: ComposerSuggestion[] = [
	{
		id: "feed",
		label: "/feed",
		description: "Link to the feed",
		insertText: "/feed",
	},
	{
		id: "groups",
		label: "/groups",
		description: "Link to groups",
		insertText: "/groups",
	},
	{
		id: "profile",
		label: "/profile",
		description: "Link to your profile",
		insertText: "/profile",
	},
];

const PostComposer = React.forwardRef<HTMLDivElement, PostComposerProps>(
	(
		{
			className,
			variant = "post",
			name = "bodyText",
			placeholder,
			rows,
			defaultValue,
			disabled,
			loading,
			textareaTestId,
			submitTestId,
			submitLabel,
			submittingLabel,
			footer,
			submitClassName,
			resetKey,
			...props
		},
		ref,
	) => {
		const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
		const [value, setValue] = React.useState(defaultValue ?? "");
		const [isExpanded, setIsExpanded] = React.useState(
			variant === "reply" || (defaultValue ?? "").trim().length > 0,
		);
		const [activeQuery, setActiveQuery] = React.useState<{
			trigger: "@" | "/";
			text: string;
			start: number;
			end: number;
		} | null>(null);
		const resolvedPlaceholder =
			placeholder ??
			(variant === "post"
				? "Share something with the community"
				: "Write a reply");
		const resolvedSubmitLabel =
			submitLabel ?? (variant === "post" ? "Post" : "Reply");
		const resolvedSubmittingLabel =
			submittingLabel ?? (variant === "post" ? "Posting" : resolvedSubmitLabel);
		const isCollapsible = variant === "post";
		const resolvedRows =
			isCollapsible && !isExpanded ? 1 : (rows ?? (variant === "post" ? 4 : 3));
		const richTextJson = React.useMemo(
			() => JSON.stringify(plainTextToRichTextDocument(value)),
			[value],
		);

		React.useEffect(() => {
			setValue(defaultValue ?? "");
		}, [defaultValue]);

		React.useEffect(() => {
			if (resetKey === undefined) {
				return;
			}
			setValue(defaultValue ?? "");
			setActiveQuery(null);
		}, [defaultValue, resetKey]);

		React.useEffect(() => {
			setIsExpanded(
				variant === "reply" || (defaultValue ?? "").trim().length > 0,
			);
		}, [defaultValue, variant]);

		React.useEffect(() => {
			if (resetKey === undefined || !isCollapsible) {
				return;
			}

			setIsExpanded(false);
		}, [isCollapsible, resetKey]);

		const suggestions = React.useMemo(() => {
			if (!activeQuery) {
				return [];
			}

			if (activeQuery.trigger === "@") {
				const label = activeQuery.text.trim() || "member";
				return [
					{
						id: `mention-${label}`,
						label: `@${label}`,
						description: "Tag a profile",
						insertText: `@${label}`,
					},
				];
			}

			const query = activeQuery.text.trim().toLowerCase();
			return SLASH_SUGGESTIONS.filter((item) =>
				item.insertText.toLowerCase().includes(query),
			);
		}, [activeQuery]);

		function updateTriggerQuery(text: string, caretPosition: number) {
			const prefix = text.slice(0, caretPosition);
			const match = prefix.match(/(^|\s)([@/])([\w.-]*)$/);
			if (!match) {
				setActiveQuery(null);
				return;
			}

			const trigger = match[2] as "@" | "/";
			const queryText = match[3] ?? "";
			const tokenStart = caretPosition - queryText.length - 1;
			setActiveQuery({
				trigger,
				text: queryText,
				start: tokenStart,
				end: caretPosition,
			});
		}

		function insertSuggestion(suggestion: ComposerSuggestion) {
			if (!activeQuery) {
				return;
			}
			const nextValue =
				value.slice(0, activeQuery.start) +
				suggestion.insertText +
				" " +
				value.slice(activeQuery.end);
			setValue(nextValue);
			setActiveQuery(null);
			requestAnimationFrame(() => {
				const nextPos = activeQuery.start + suggestion.insertText.length + 1;
				textareaRef.current?.focus();
				textareaRef.current?.setSelectionRange(nextPos, nextPos);
			});
		}

		return (
			<div
				ref={ref}
				className={cn("min-w-0", className)}
				onFocusCapture={() => {
					if (isCollapsible) {
						setIsExpanded(true);
					}
				}}
				onBlurCapture={(event) => {
					if (
						!isCollapsible ||
						event.currentTarget.contains(event.relatedTarget as Node | null)
					) {
						return;
					}

					setIsExpanded(false);
				}}
				{...props}
			>
				<input type="hidden" name="bodyRichText" value={richTextJson} />
				<div className="overflow-hidden rounded-xl border border-input/80 bg-background transition-[border-color,box-shadow] duration-150">
					<Selector open={suggestions.length > 0 && !disabled}>
						<SelectorAnchor>
							<Textarea
								ref={textareaRef}
								name={name}
								rows={resolvedRows}
								value={value}
								placeholder={resolvedPlaceholder}
								disabled={disabled}
								data-testid={textareaTestId}
								aria-keyshortcuts="Meta+Enter Control+Enter Alt+Enter"
								onChange={(event) => {
									const nextValue = event.currentTarget.value;
									setValue(nextValue);
									updateTriggerQuery(
										nextValue,
										event.currentTarget.selectionStart,
									);
								}}
								onKeyDown={(event) => {
									if (
										event.key === "Enter" &&
										suggestions.length > 0 &&
										activeQuery
									) {
										event.preventDefault();
										insertSuggestion(suggestions[0]);
										return;
									}
									if (
										event.key !== "Enter" ||
										(!event.metaKey && !event.ctrlKey && !event.altKey)
									) {
										return;
									}

									event.preventDefault();
									if (disabled) {
										return;
									}

									event.currentTarget.form?.requestSubmit();
								}}
								className={cn(
									"resize-none overflow-hidden border-0 bg-transparent text-[15px] leading-7 shadow-none transition-[min-height,padding] duration-150 focus-visible:ring-0 focus-visible:ring-offset-0",
									variant === "post"
										? isExpanded
											? "min-h-32 px-4 py-4 sm:min-h-36"
											: "min-h-0 px-4 py-3 leading-6"
										: "min-h-28 px-4 py-4",
								)}
							/>
						</SelectorAnchor>
						<SelectorContent className="z-30">
							<SelectorLabel>
								{activeQuery?.trigger === "@" ? "Tag" : "Link command"}
							</SelectorLabel>
							<SelectorList>
								{suggestions.map((suggestion) => (
									<SelectorItem
										key={suggestion.id}
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => insertSuggestion(suggestion)}
									>
										<SelectorItemContent>
											<SelectorItemTitle>{suggestion.label}</SelectorItemTitle>
											<SelectorItemDescription>
												{suggestion.description}
											</SelectorItemDescription>
										</SelectorItemContent>
									</SelectorItem>
								))}
							</SelectorList>
						</SelectorContent>
					</Selector>
					<div
						className={cn(
							"flex flex-wrap items-center justify-between gap-2 overflow-hidden border-border/70 bg-muted/20 transition-all duration-150",
							variant === "reply" ? "min-h-12" : "min-h-13",
							isCollapsible &&
								(!isExpanded
									? "max-h-0 border-t-0 px-3 py-0 opacity-0 pointer-events-none"
									: "max-h-24 border-t px-3 py-2 opacity-100"),
							!isCollapsible && "border-t px-3 py-2",
						)}
					>
						<div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
							{footer}
						</div>
						<IconButton
							type="submit"
							label={loading ? resolvedSubmittingLabel : resolvedSubmitLabel}
							disabled={disabled}
							data-testid={submitTestId}
							className={submitClassName}
						>
							{loading ? (
								<Icon name="loaderCircle" className="animate-spin" />
							) : (
								<Icon name="sendHorizontal" />
							)}
						</IconButton>
					</div>
				</div>
			</div>
		);
	},
);
PostComposer.displayName = "PostComposer";

export { PostComposer };
