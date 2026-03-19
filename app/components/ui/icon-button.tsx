import * as React from "react";

import { Button, type ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type IconButtonProps = ButtonProps & {
	label: string;
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
	({ className, label, size = "icon", title, ...props }, ref) => {
		return (
			<Button
				ref={ref}
				size={size}
				title={title ?? label}
				aria-label={label}
				className={cn("h-8 w-8 rounded-full", className)}
				{...props}
			/>
		);
	},
);
IconButton.displayName = "IconButton";

export { IconButton };
