import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

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
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { badgeVariants };
