import type { HTMLAttributes } from "react";

import { Button, type ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type PostActionData = {
	label: string;
	disabled?: boolean;
	onClick?: () => void;
	isActive?: boolean;
	testId?: string;
	to?: string;
};

export function PostActions({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
			{...props}
		/>
	);
}

export function PostActionItem({
	className,
	variant = "ghost",
	size = "sm",
	...props
}: ButtonProps & {
	variant?: "link" | "ghost";
}) {
	return (
		<Button
			variant={variant}
			size={size}
			className={cn(
				"h-8 text-sm font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline",
				variant === "ghost"
					? "rounded-full px-3.5 hover:bg-accent/80"
					: "h-auto rounded-none px-0 py-0 hover:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}
