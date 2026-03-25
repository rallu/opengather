import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-[0.01em]",
	{
		variants: {
			variant: {
				default: "border-border bg-muted text-muted-foreground",
				neutral: "border-border bg-background text-foreground",
				info: "border-info/50 bg-info text-info-foreground",
				success: "border-success/50 bg-success text-success-foreground",
				warning: "border-warning/50 bg-warning text-warning-foreground",
				danger:
					"border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/35",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {
	closeLabel?: string;
	onClose?: () => void;
}

export function Badge({
	children,
	className,
	closeLabel = "Remove",
	onClick,
	onClose,
	variant,
	...props
}: BadgeProps) {
	const interactive = typeof onClick === "function";

	if (interactive && !onClose) {
		return (
			<button
				type="button"
				className={cn(
					badgeVariants({ variant }),
					"cursor-pointer hover:border-primary/40 hover:text-foreground",
					className,
				)}
				onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
				{...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
			>
				{children}
			</button>
		);
	}

	return (
		<span
			className={cn(
				badgeVariants({ variant }),
				onClose && "gap-1 pr-1",
				className,
			)}
			{...props}
		>
			{children}
			{onClose ? (
				<button
					type="button"
					aria-label={closeLabel}
					className="inline-flex h-4 w-4 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-foreground/10 hover:text-current"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onClose();
					}}
				>
					<Icon name="x" size={12} />
				</button>
			) : null}
		</span>
	);
}

export { badgeVariants };
