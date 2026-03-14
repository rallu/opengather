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
	return (
		<article
			className={cn(
				"elevation-low relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-muted",
				className,
			)}
		>
			<img
				src={imageSrc}
				alt={imageAlt}
				className="h-full w-full object-cover"
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
