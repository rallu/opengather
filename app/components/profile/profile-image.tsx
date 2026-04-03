import { useState } from "react";
import { getDefaultProfileImage } from "~/lib/default-profile-images";
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

function resolveProfileImageSrcForSize(
	src: string,
	size: "sm" | "md" | "lg" | "xl",
): string {
	const targetSize = size === "sm" ? "64" : size === "md" ? "128" : "256";

	try {
		const parsed =
			src.startsWith("http://") || src.startsWith("https://")
				? new URL(src)
				: new URL(src, "http://localhost");
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments[0] !== "profile-images" || !segments[1]) {
			return src;
		}

		const pathname = `/profile-images/${segments[1]}/${targetSize}`;
		const rewritten = `${pathname}${parsed.search}`;
		if (src.startsWith("http://") || src.startsWith("https://")) {
			return `${parsed.origin}${rewritten}`;
		}
		return rewritten;
	} catch {
		return src;
	}
}

export function ProfileImage({
	src,
	alt,
	fallback,
	size = "md",
	className,
}: ProfileImageProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const resolvedSrc = src
		? resolveProfileImageSrcForSize(src, size)
		: undefined;
	const backupSrc = getDefaultProfileImage({
		seed: `${fallback}:${alt}`,
	});
	const displaySrc =
		resolvedSrc && failedSrc !== resolvedSrc
			? resolvedSrc
			: backupSrc || undefined;

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-full border border-border bg-muted",
				sizeStyles[size],
				className,
			)}
		>
			{displaySrc ? (
				<img
					src={displaySrc}
					alt={alt}
					className="h-full w-full object-cover"
					onError={() => {
						if (resolvedSrc && displaySrc === resolvedSrc) {
							setFailedSrc(resolvedSrc);
						}
					}}
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center bg-primary/10 font-medium text-primary">
					{fallback}
				</div>
			)}
		</div>
	);
}
