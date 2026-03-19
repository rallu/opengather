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
			...props
		},
		ref,
	) => {
		const resolvedPlaceholder =
			placeholder ??
			(variant === "post"
				? "Share something with the community"
				: "Write a reply");
		const resolvedSubmitLabel =
			submitLabel ?? (variant === "post" ? "Post" : "Reply");
		const resolvedSubmittingLabel =
			submittingLabel ?? (variant === "post" ? "Posting" : resolvedSubmitLabel);

		return (
			<div ref={ref} className={cn("min-w-0", className)} {...props}>
				<div className="overflow-hidden rounded-xl border border-input/80 bg-background">
					<Textarea
						name={name}
						rows={rows}
						defaultValue={defaultValue}
						placeholder={resolvedPlaceholder}
						disabled={disabled}
						data-testid={textareaTestId}
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
						<div className="min-w-0 flex-1">{footer}</div>
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
