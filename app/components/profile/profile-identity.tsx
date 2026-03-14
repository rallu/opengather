import { cn } from "~/lib/utils";

import { ProfileImage } from "./profile-image";

type ProfileIdentityProps = {
	name: string;
	imageSrc?: string;
	imageAlt: string;
	fallback: string;
	subtitle?: string;
	size?: "sm" | "md" | "lg";
	className?: string;
};

const imageSizeByIdentitySize = {
	sm: "sm",
	md: "md",
	lg: "lg",
} as const;

export function ProfileIdentity({
	name,
	imageSrc,
	imageAlt,
	fallback,
	subtitle,
	size = "md",
	className,
}: ProfileIdentityProps) {
	return (
		<div className={cn("flex items-center gap-3", className)}>
			<ProfileImage
				src={imageSrc}
				alt={imageAlt}
				fallback={fallback}
				size={imageSizeByIdentitySize[size]}
			/>
			<div className="min-w-0">
				<p
					className={cn(
						"truncate font-medium text-foreground",
						size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
					)}
				>
					{name}
				</p>
				{subtitle ? (
					<p className="truncate text-sm text-muted-foreground">{subtitle}</p>
				) : null}
			</div>
		</div>
	);
}
