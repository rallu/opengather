import type { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function MediaHeading({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex items-start gap-3", className)} {...props} />;
}

export function MediaHeadingMedia({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("shrink-0", className)} {...props} />;
}

export function MediaHeadingContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("min-w-0 space-y-1", className)} {...props} />;
}

export function MediaHeadingTitle({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("truncate text-sm font-medium text-foreground", className)}
			{...props}
		/>
	);
}

export function MediaHeadingSubtitle({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("truncate text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
