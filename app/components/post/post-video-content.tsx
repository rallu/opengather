import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";

const EMPTY_CAPTIONS_TRACK = "data:text/vtt;charset=utf-8,WEBVTT";

type PostVideoContentProps = {
	src?: string;
	posterSrc?: string;
	title?: string;
	duration?: string;
	playable?: boolean;
	className?: string;
};

export function PostVideoContent({
	src,
	posterSrc,
	title,
	duration,
	playable = true,
	className,
}: PostVideoContentProps) {
	return (
		<figure className={cn("space-y-2", className)}>
			<div className="relative max-h-[28rem] overflow-hidden rounded-lg border border-border bg-muted">
				{src && playable ? (
					<video
						src={src}
						poster={posterSrc}
						controls
						preload="metadata"
						className="h-full max-h-[28rem] w-full bg-black object-contain"
					>
						<track
							kind="captions"
							label="No captions available"
							src={EMPTY_CAPTIONS_TRACK}
						/>
					</video>
				) : posterSrc ? (
					<img
						src={posterSrc}
						alt={title ?? "Video preview"}
						className="h-full max-h-[28rem] w-full object-cover"
					/>
				) : (
					<div className="h-[20rem] w-full bg-muted" />
				)}
				{!src || !playable ? (
					<div className="absolute inset-0 flex items-center justify-center bg-black/18">
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white">
							<Icon name="chevronRight" size={28} />
						</div>
					</div>
				) : null}
				{duration ? (
					<div className="absolute bottom-3 right-3 rounded bg-black/65 px-2 py-1 text-xs text-white">
						{duration}
					</div>
				) : null}
			</div>
			{title ? (
				<figcaption className="text-sm leading-6 text-muted-foreground">
					{title}
				</figcaption>
			) : null}
		</figure>
	);
}
