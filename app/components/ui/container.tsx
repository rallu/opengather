import * as React from "react";

import { cn } from "~/lib/utils";

const Container = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"rounded-md border border-border/55 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
			className,
		)}
		{...props}
	/>
));
Container.displayName = "Container";

export { Container };
