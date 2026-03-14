import * as React from "react";

import { cn } from "~/lib/utils";

const CenteredLayout = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("mx-auto w-full max-w-3xl", className)}
		{...props}
	/>
));
CenteredLayout.displayName = "CenteredLayout";

const RightSidebarLayout = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start",
			className,
		)}
		{...props}
	/>
));
RightSidebarLayout.displayName = "RightSidebarLayout";

const LayoutMain = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("min-w-0", className)} {...props} />
));
LayoutMain.displayName = "LayoutMain";

const LayoutSidebar = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<aside ref={ref} className={cn("min-w-0", className)} {...props} />
));
LayoutSidebar.displayName = "LayoutSidebar";

export { CenteredLayout, LayoutMain, LayoutSidebar, RightSidebarLayout };
