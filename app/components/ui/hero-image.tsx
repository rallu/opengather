import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type HeroImageProps = {
	imageSrc: string;
	imageAlt: string;
	title?: string;
	description?: string;
	children?: ReactNode;
	className?: string;
};

export function HeroImage({
	imageSrc,
	imageAlt,
	title,
	description,
	children,
	className,
}: HeroImageProps) {
	return (
		<section
			className={cn(
				"elevation-medium relative overflow-hidden rounded-xl border border-border bg-muted/40",
				className,
			)}
		>
			<img
				src={imageSrc}
				alt={imageAlt}
				className="h-72 w-full object-cover sm:h-80 lg:h-96"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
			<div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white sm:p-6">
				{title ? (
					<h3 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
						{title}
					</h3>
				) : null}
				{description ? (
					<p className="max-w-2xl text-sm leading-6 text-white/82">
						{description}
					</p>
				) : null}
				{children ? (
					<div className="flex flex-wrap gap-3">{children}</div>
				) : null}
			</div>
		</section>
	);
}
