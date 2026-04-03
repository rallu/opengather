import { useState } from "react";
import { getDefaultProfileImage } from "~/lib/default-profile-images";
import { cn } from "~/lib/utils";

type ProfileCardProps = {
	name: string;
	imageSrc: string;
	imageAlt: string;
	description?: string;
	className?: string;
};

export function ProfileCard({
	name,
	imageSrc,
	imageAlt,
	description,
	className,
}: ProfileCardProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const displayImageSrc =
		failedSrc === imageSrc ? getDefaultProfileImage({ seed: name }) : imageSrc;

	return (
		<article
			className={cn(
				"elevation-low relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-muted",
				className,
			)}
		>
			<img
				src={displayImageSrc}
				alt={imageAlt}
				className="h-full w-full object-cover"
				onError={() => {
					if (displayImageSrc === imageSrc) {
						setFailedSrc(imageSrc);
					}
				}}
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
			<div className="absolute inset-x-0 bottom-0 space-y-2 p-4 text-white">
				<h3 className="text-lg font-semibold">{name}</h3>
				{description ? (
					<p className="text-sm leading-6 text-white/80">{description}</p>
				) : null}
			</div>
		</article>
	);
}
