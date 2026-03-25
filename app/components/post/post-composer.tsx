import * as React from "react";

import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { Textarea } from "~/components/ui/textarea";
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
		const [value, setValue] = React.useState(defaultValue ?? "");
		const [isExpanded, setIsExpanded] = React.useState(
			variant === "reply" || (defaultValue ?? "").trim().length > 0,
		);
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
			isCollapsible && !isExpanded ? 1 : rows ?? (variant === "post" ? 4 : 3);

		React.useEffect(() => {
			setValue(defaultValue ?? "");
		}, [defaultValue]);

		React.useEffect(() => {
			if (resetKey === undefined) {
				return;
			}
			setValue(defaultValue ?? "");
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
				<div className="overflow-hidden rounded-xl border border-input/80 bg-background transition-[border-color,box-shadow] duration-150">
					<Textarea
						name={name}
						rows={resolvedRows}
						value={value}
						placeholder={resolvedPlaceholder}
						disabled={disabled}
						data-testid={textareaTestId}
						aria-keyshortcuts="Meta+Enter Control+Enter Alt+Enter"
						onChange={(event) => setValue(event.currentTarget.value)}
						onKeyDown={(event) => {
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
