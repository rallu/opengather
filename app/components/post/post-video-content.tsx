import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";

type PostVideoContentProps = {
	src?: string;
	posterSrc?: string;
	title?: string;
	duration?: string;
	className?: string;
};

export function PostVideoContent({
	posterSrc,
	title,
	duration,
	className,
}: PostVideoContentProps) {
	return (
		<figure className={cn("space-y-2", className)}>
			<div className="relative max-h-[28rem] overflow-hidden rounded-lg border border-border bg-muted">
				{posterSrc ? (
					<img
						src={posterSrc}
						alt={title ?? "Video preview"}
						className="h-full max-h-[28rem] w-full object-cover"
					/>
				) : (
					<div className="h-[20rem] w-full bg-muted" />
				)}
				<div className="absolute inset-0 flex items-center justify-center bg-black/18">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white">
						<Icon name="chevronRight" size={28} />
					</div>
				</div>
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
