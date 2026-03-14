import * as React from "react";

import { cn } from "~/lib/utils";

type SelectorContextValue = {
	open: boolean;
};

const SelectorContext = React.createContext<SelectorContextValue | null>(null);

function useSelectorContext() {
	const context = React.useContext(SelectorContext);
	if (!context) {
		throw new Error("Selector components must be used within <Selector>.");
	}
	return context;
}

export function Selector({
	children,
	open = false,
}: {
	children: React.ReactNode;
	open?: boolean;
}) {
	return (
		<SelectorContext.Provider value={{ open }}>
			<div className="relative">{children}</div>
		</SelectorContext.Provider>
	);
}

export function SelectorAnchor({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("relative", className)} {...props} />;
}

export function SelectorContent({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	const { open } = useSelectorContext();

	if (!open) {
		return null;
	}

	return (
		<div
			className={cn(
				"elevation-high absolute left-0 top-full z-20 mt-2 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function SelectorList({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("max-h-80 overflow-y-auto p-1", className)} {...props} />
	);
}

export function SelectorSection({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <section className={cn("space-y-1", className)} {...props} />;
}

export function SelectorLabel({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn(
				"px-3 pt-3 text-sm font-medium text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function SelectorItem({
	className,
	active = false,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/60",
				active ? "bg-accent/80" : undefined,
				className,
			)}
			{...props}
		/>
	);
}

export function SelectorItemMedia({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("shrink-0 pt-0.5", className)} {...props} />;
}

export function SelectorItemContent({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("min-w-0 flex-1 space-y-0.5", className)} {...props} />
	);
}

export function SelectorItemTitle({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-sm font-medium text-foreground", className)}
			{...props}
		/>
	);
}

export function SelectorItemDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-sm leading-6 text-muted-foreground", className)}
			{...props}
		/>
	);
}

export function SelectorItemMeta({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("shrink-0 text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
}

export function SelectorEmpty({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("px-3 py-6 text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
