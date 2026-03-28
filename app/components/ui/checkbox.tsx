import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "~/lib/utils";

export type CheckboxProps = Omit<
	React.InputHTMLAttributes<HTMLInputElement>,
	"type"
> & {
	description?: React.ReactNode;
	inputClassName?: string;
	label?: React.ReactNode;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
	(
		{ className, description, inputClassName, label, disabled, ...props },
		ref,
	) => {
		const hasText = Boolean(label || description);

		return (
			<label
				className={cn(
					"inline-flex items-start",
					hasText ? "gap-3" : "justify-center",
					disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
					className,
				)}
			>
				<span className="relative flex size-5 shrink-0 items-center justify-center">
					<input
						ref={ref}
						type="checkbox"
						disabled={disabled}
						className={cn(
							"peer absolute inset-0 z-0 m-0 appearance-none rounded-md border border-input bg-background shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 checked:border-primary checked:bg-primary disabled:cursor-not-allowed",
							inputClassName,
						)}
						{...props}
					/>
					<Check
						className="pointer-events-none absolute inset-0 z-10 m-auto size-3.5 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
						strokeWidth={3}
					/>
				</span>
				{hasText ? (
					<span className="space-y-1">
						{label ? (
							<span className="block text-sm font-medium">{label}</span>
						) : null}
						{description ? (
							<span className="block text-sm text-muted-foreground">
								{description}
							</span>
						) : null}
					</span>
				) : null}
			</label>
		);
	},
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
