import type * as React from "react";

import { cn } from "~/lib/utils";

type FeedContainerProps = React.HTMLAttributes<HTMLDivElement>;

export function FeedContainer({ className, ...props }: FeedContainerProps) {
	return (
		<div className={cn("mx-auto w-full max-w-[680px]", className)} {...props} />
	);
}
