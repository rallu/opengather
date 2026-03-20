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
	shortcutHint?: string;
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
			shortcutHint,
			...props
		},
		ref,
	) => {
		const [value, setValue] = React.useState(defaultValue ?? "");
		const resolvedPlaceholder =
			placeholder ??
			(variant === "post"
				? "Share something with the community"
				: "Write a reply");
		const resolvedSubmitLabel =
			submitLabel ?? (variant === "post" ? "Post" : "Reply");
		const resolvedSubmittingLabel =
			submittingLabel ?? (variant === "post" ? "Posting" : resolvedSubmitLabel);
		const resolvedShortcutHint =
			shortcutHint ?? "Send with Cmd+Enter or Ctrl+Enter";

		React.useEffect(() => {
			setValue(defaultValue ?? "");
		}, [defaultValue]);

		React.useEffect(() => {
			if (resetKey === undefined) {
				return;
			}
			setValue(defaultValue ?? "");
		}, [defaultValue, resetKey]);

		return (
			<div ref={ref} className={cn("min-w-0", className)} {...props}>
				<div className="overflow-hidden rounded-xl border border-input/80 bg-background">
					<Textarea
						name={name}
						rows={rows}
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
							"resize-none border-0 bg-transparent text-[15px] leading-7 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
							variant === "post"
								? "min-h-32 px-4 py-4 sm:min-h-36"
								: "min-h-28 px-4 py-4",
						)}
					/>
					<div
						className={cn(
							"flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-2",
							variant === "reply" ? "min-h-12" : "min-h-13",
						)}
					>
						<div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
							{footer}
							<span className="text-xs leading-5 text-muted-foreground">
								{resolvedShortcutHint}
							</span>
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
