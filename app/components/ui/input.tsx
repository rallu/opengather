import * as React from "react";

import { cn } from "~/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	leadingAccessory?: React.ReactNode;
	trailingAccessory?: React.ReactNode;
	inputClassName?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{
			className,
			inputClassName,
			leadingAccessory,
			trailingAccessory,
			type = "text",
			...props
		},
		ref,
	) => {
		return (
			<div
				className={cn(
					"flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive/20 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
					className,
				)}
			>
				{leadingAccessory ? (
					<span className="shrink-0 text-muted-foreground">
						{leadingAccessory}
					</span>
				) : null}
				<input
					type={type}
					className={cn(
						"flex h-full w-full min-w-0 flex-1 bg-transparent py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed",
						inputClassName,
					)}
					ref={ref}
					{...props}
				/>
				{trailingAccessory ? (
					<span className="shrink-0 text-muted-foreground">
						{trailingAccessory}
					</span>
				) : null}
			</div>
		);
	},
);
Input.displayName = "Input";

export { Input };
