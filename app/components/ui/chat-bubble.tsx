import type { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function ChatBubble({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex items-start gap-3", className)} {...props} />;
}

export function ChatBubbleMedia({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("shrink-0 pt-1", className)} {...props} />;
}

export function ChatBubbleContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"elevation-low min-w-0 flex-1 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function ChatBubbleHeader({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"mb-2 flex flex-wrap items-center gap-x-2 gap-y-1",
				className,
			)}
			{...props}
		/>
	);
}

export function ChatBubbleTitle({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-sm font-medium text-foreground", className)}
			{...props}
		/>
	);
}

export function ChatBubbleMeta({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p className={cn("text-xs text-muted-foreground", className)} {...props} />
	);
}

export function ChatBubbleBody({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"space-y-3 text-sm leading-7 text-foreground [&_p]:whitespace-pre-wrap",
				className,
			)}
			{...props}
		/>
	);
}

export function ChatBubbleFooter({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("mt-3 border-t border-border pt-3", className)}
			{...props}
		/>
	);
}
