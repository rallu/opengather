import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Icon, type IconName } from "./icon";

type ToastVariant = "info" | "success" | "warning" | "error";

type ToastProps = {
	variant?: ToastVariant;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
};

const variantStyles: Record<
	ToastVariant,
	{
		container: string;
		icon: IconName;
		iconClassName: string;
	}
> = {
	info: {
		container: "border-info/50 bg-info text-info-foreground",
		icon: "info",
		iconClassName: "text-info-foreground",
	},
	success: {
		container: "border-success/50 bg-success text-success-foreground",
		icon: "checkCircle2",
		iconClassName: "text-success-foreground",
	},
	warning: {
		container: "border-warning/50 bg-warning text-warning-foreground",
		icon: "triangleAlert",
		iconClassName: "text-warning-foreground",
	},
	error: {
		container: "border-destructive/30 bg-destructive/10 text-foreground",
		icon: "circleAlert",
		iconClassName: "text-destructive",
	},
};

export function Toast({
	variant = "info",
	title,
	description,
	action,
	className,
}: ToastProps) {
	return (
		<output
			aria-live="polite"
			className={cn(
				"elevation-low flex items-start gap-3 rounded-lg border p-4",
				variantStyles[variant].container,
				className,
			)}
		>
			<Icon
				name={variantStyles[variant].icon}
				className={cn(
					"mt-0.5 h-5 w-5 shrink-0",
					variantStyles[variant].iconClassName,
				)}
			/>
			<div className="min-w-0 flex-1 space-y-1">
				<p className="text-sm font-medium">{title}</p>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</output>
	);
}
