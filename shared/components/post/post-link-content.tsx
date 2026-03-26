import {
	type RichTextLinkTarget,
	resolveRichTextLinkTarget,
} from "../../../app/lib/rich-text";
import { cn } from "../../../app/lib/utils";
import { useOpenGatherLinkComponent } from "../../render-context";

type PostLinkContentProps = {
	className?: string;
	description?: string;
	imageSrc?: string;
	target: RichTextLinkTarget;
	title: string;
};

function getMetaLabel(target: RichTextLinkTarget) {
	switch (target.type) {
		case "external":
			try {
				return new URL(target.href).hostname;
			} catch {
				return target.href;
			}
		case "profile":
			return "Profile";
		case "post":
			return "Post";
		case "route":
			return "Internal route";
	}
}

export function PostLinkContent({
	className,
	description,
	imageSrc,
	target,
	title,
}: PostLinkContentProps) {
	const LinkComponent = useOpenGatherLinkComponent();
	const href = resolveRichTextLinkTarget(target);
	const content = (
		<div
			className={cn(
				"elevation-low overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors hover:bg-accent/20",
				className,
			)}
		>
			{imageSrc ? (
				<img
					src={imageSrc}
					alt={title}
					className="aspect-[16/9] w-full border-b border-border object-cover"
				/>
			) : null}
			<div className="space-y-2 p-4">
				<p className="text-base font-semibold tracking-tight text-foreground">
					{title}
				</p>
				{description ? (
					<p className="text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				) : null}
				<p className="text-sm font-medium text-muted-foreground">
					{getMetaLabel(target)}
				</p>
			</div>
		</div>
	);

	if (target.type === "external") {
		return (
			<a href={href} target="_blank" rel="noreferrer">
				{content}
			</a>
		);
	}

	return <LinkComponent to={href}>{content}</LinkComponent>;
}
