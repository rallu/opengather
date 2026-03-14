import { cn } from "~/lib/utils";

import { Icon } from "./icon";

type SpinnerProps = {
	size?: "sm" | "md" | "lg";
	className?: string;
	label?: string;
};

const sizeMap = {
	sm: 14,
	md: 18,
	lg: 24,
} as const;

export function Spinner({
	size = "md",
	className,
	label = "Loading",
}: SpinnerProps) {
	return (
		<output
			aria-live="polite"
			aria-label={label}
			className={cn("inline-flex items-center justify-center", className)}
		>
			<Icon
				name="loaderCircle"
				size={sizeMap[size]}
				className="animate-spin text-muted-foreground"
			/>
		</output>
	);
}
