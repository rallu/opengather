import * as React from "react";

import { Button, type ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const ButtonGroup = React.forwardRef<
	HTMLFieldSetElement,
	React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
	<fieldset
		ref={ref}
		className={cn(
			"inline-flex items-center overflow-hidden rounded-md border border-border bg-background",
			className,
		)}
		{...props}
	/>
));
ButtonGroup.displayName = "ButtonGroup";

const ButtonGroupItem = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "ghost", size = "sm", ...props }, ref) => (
		<Button
			ref={ref}
			variant={variant}
			size={size}
			className={cn(
				"h-8 rounded-none border-0 px-3 text-muted-foreground hover:text-foreground focus-visible:relative",
				"[&:not(:first-child)]:border-l [&:not(:first-child)]:border-border",
				className,
			)}
			{...props}
		/>
	),
);
ButtonGroupItem.displayName = "ButtonGroupItem";

export { ButtonGroup, ButtonGroupItem };
