import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type PostActionData = {
	label: string;
	disabled?: boolean;
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
	variant = "link",
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "link" | "ghost";
}) {
	return (
		<Button
			type={type}
			variant={variant}
			size="sm"
			className={cn(
				"h-auto px-0 py-0 text-sm font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline",
				variant === "ghost"
					? "rounded-none px-0 text-muted-foreground"
					: undefined,
				className,
			)}
			{...props}
		/>
	);
}
