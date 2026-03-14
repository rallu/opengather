import { cn } from "~/lib/utils";

type PostImageContentProps = {
	src: string;
	alt: string;
	caption?: string;
	className?: string;
};

export function PostImageContent({
	src,
	alt,
	caption,
	className,
}: PostImageContentProps) {
	return (
		<figure className={cn("space-y-2", className)}>
			<div className="relative max-h-[32rem] overflow-hidden rounded-lg border border-border bg-muted">
				<img
					src={src}
					alt=""
					aria-hidden="true"
					className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
				/>
				<div className="absolute inset-0 bg-background/20" />
				<img
					src={src}
					alt={alt}
					className="relative h-full max-h-[32rem] w-full object-contain"
				/>
			</div>
			{caption ? (
				<figcaption className="text-sm leading-6 text-muted-foreground">
					{caption}
				</figcaption>
			) : null}
		</figure>
	);
}
