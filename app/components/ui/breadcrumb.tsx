import type { HTMLAttributes, LiHTMLAttributes } from "react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";

import { Icon } from "./icon";

export function Breadcrumb({
	className,
	...props
}: HTMLAttributes<HTMLElement>) {
	return <nav aria-label="Breadcrumb" className={cn(className)} {...props} />;
}

export function BreadcrumbList({
	className,
	...props
}: HTMLAttributes<HTMLOListElement>) {
	return (
		<ol
			className={cn(
				"flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function BreadcrumbItem({
	className,
	...props
}: LiHTMLAttributes<HTMLLIElement>) {
	return (
		<li
			className={cn("inline-flex items-center gap-1.5", className)}
			{...props}
		/>
	);
}

export function BreadcrumbLink({
	className,
	to,
	...props
}: Omit<React.ComponentProps<typeof Link>, "to"> & { to: string }) {
	return (
		<Link
			to={to}
			className={cn("transition-colors hover:text-foreground", className)}
			{...props}
		/>
	);
}

export function BreadcrumbCurrent({
	className,
	...props
}: HTMLAttributes<HTMLSpanElement>) {
	return (
		<span className={cn("font-medium text-foreground", className)} {...props} />
	);
}

export function BreadcrumbSeparator({
	className,
	...props
}: HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			aria-hidden="true"
			className={cn("text-muted-foreground/70", className)}
			{...props}
		>
			<Icon name="chevronRight" size={14} />
		</span>
	);
}
