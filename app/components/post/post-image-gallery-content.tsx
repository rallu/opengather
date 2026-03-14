import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type PostGalleryImage = {
	src: string;
	alt: string;
};

type PostImageGalleryContentProps = {
	images: PostGalleryImage[];
	className?: string;
};

function GalleryTile({
	image,
	isOverflowTile = false,
	overflowCount = 0,
	className,
}: {
	image: PostGalleryImage;
	isOverflowTile?: boolean;
	overflowCount?: number;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-lg border border-border bg-muted",
				className,
			)}
		>
			<img
				src={image.src}
				alt={image.alt}
				className="h-full w-full object-cover"
			/>
			{isOverflowTile ? (
				<div className="absolute inset-0 flex items-center justify-center bg-black/45">
					<Button
						type="button"
						variant="secondary"
						className="pointer-events-none border-0 bg-white/20 text-white hover:bg-white/20"
					>
						+{overflowCount} more
					</Button>
				</div>
			) : null}
		</div>
	);
}

export function PostImageGalleryContent({
	images,
	className,
}: PostImageGalleryContentProps) {
	const visibleImages = images.slice(0, 5);
	const overflowCount = Math.max(images.length - 5, 0);
	const count = visibleImages.length;

	if (count === 2) {
		return (
			<div className={cn("grid grid-cols-2 gap-2", className)}>
				{visibleImages.map((image) => (
					<GalleryTile
						key={`${image.src}:${image.alt}`}
						image={image}
						className="h-40"
					/>
				))}
			</div>
		);
	}

	if (count === 3) {
		return (
			<div className={cn("space-y-2", className)}>
				<GalleryTile
					image={visibleImages[0]}
					className="h-52"
					key={`${visibleImages[0].src}:${visibleImages[0].alt}`}
				/>
				<div className="grid grid-cols-2 gap-2">
					{visibleImages.slice(1).map((image) => (
						<GalleryTile
							key={`${image.src}:${image.alt}`}
							image={image}
							className="h-36"
						/>
					))}
				</div>
			</div>
		);
	}

	if (count === 4) {
		return (
			<div className={cn("grid grid-cols-2 gap-2", className)}>
				{visibleImages.map((image) => (
					<GalleryTile
						key={`${image.src}:${image.alt}`}
						image={image}
						className="h-36"
					/>
				))}
			</div>
		);
	}

	if (count >= 5) {
		return (
			<div className={cn("space-y-2", className)}>
				<div className="grid grid-cols-2 gap-2">
					{visibleImages.slice(0, 2).map((image) => (
						<GalleryTile
							key={`${image.src}:${image.alt}`}
							image={image}
							className="h-44"
						/>
					))}
				</div>
				<div className="grid grid-cols-3 gap-2">
					{visibleImages.slice(2).map((image, index) => (
						<GalleryTile
							key={`${image.src}:${image.alt}`}
							image={image}
							isOverflowTile={overflowCount > 0 && index === 2}
							overflowCount={overflowCount}
							className="h-32"
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("grid gap-2", className)}>
			{visibleImages.map((image) => (
				<GalleryTile
					key={`${image.src}:${image.alt}`}
					image={image}
					className="h-40"
				/>
			))}
		</div>
	);
}
