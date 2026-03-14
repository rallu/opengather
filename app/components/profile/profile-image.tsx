import { cn } from "~/lib/utils";

type ProfileImageProps = {
	src?: string;
	alt: string;
	fallback: string;
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
};

const sizeStyles = {
	sm: "h-10 w-10 text-sm",
	md: "h-14 w-14 text-base",
	lg: "h-20 w-20 text-lg",
	xl: "h-28 w-28 text-2xl",
} as const;

export function ProfileImage({
	src,
	alt,
	fallback,
	size = "md",
	className,
}: ProfileImageProps) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-full border border-border bg-muted",
				sizeStyles[size],
				className,
			)}
		>
			{src ? (
				<img src={src} alt={alt} className="h-full w-full object-cover" />
			) : (
				<div className="flex h-full w-full items-center justify-center bg-primary/10 font-medium text-primary">
					{fallback}
				</div>
			)}
		</div>
	);
}
