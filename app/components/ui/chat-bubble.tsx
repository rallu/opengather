import type { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function ChatBubble({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex min-w-0 items-start gap-3", className)}
			{...props}
		/>
	);
}

export function ChatBubbleMedia({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("relative shrink-0 pt-0.5", className)} {...props} />
	);
}

export function ChatBubbleContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("min-w-0 flex-1 py-0.5 text-card-foreground", className)}
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
			className={cn("mb-1.5 flex min-w-0 items-center gap-2", className)}
			{...props}
		/>
	);
}

export function ChatBubbleHeading({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
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
			className={cn(
				"text-[15px] font-semibold leading-none text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function ChatBubbleMeta({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn(
				"text-[13px] leading-none text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function ChatBubbleBody({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"space-y-3 text-[15px] leading-8 text-foreground [&_p]:whitespace-pre-wrap",
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
	return <div className={cn("mt-2.5", className)} {...props} />;
}
