import * as React from "react";

import { Textarea, type TextareaProps } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

type PostComposerVariant = "post" | "reply";

const PostComposerContext = React.createContext<PostComposerVariant>("post");

function usePostComposerVariant() {
	return React.useContext(PostComposerContext);
}

type PostComposerProps = React.HTMLAttributes<HTMLDivElement> & {
	variant?: PostComposerVariant;
};

const PostComposer = React.forwardRef<HTMLDivElement, PostComposerProps>(
	({ className, variant = "post", ...props }, ref) => (
		<PostComposerContext.Provider value={variant}>
			<div
				ref={ref}
				className={cn(
					"elevation-low flex rounded-lg border border-border bg-card text-card-foreground",
					variant === "post" ? "gap-4 p-5" : "gap-3 p-4",
					className,
				)}
				{...props}
			/>
		</PostComposerContext.Provider>
	),
);
PostComposer.displayName = "PostComposer";

const PostComposerMedia = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("shrink-0", className)} {...props} />
));
PostComposerMedia.displayName = "PostComposerMedia";

const PostComposerBody = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	return (
		<div ref={ref} className={cn("min-w-0 flex-1", className)} {...props} />
	);
});
PostComposerBody.displayName = "PostComposerBody";

const PostComposerSurface = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"overflow-hidden rounded-md border border-input bg-background",
			className,
		)}
		{...props}
	/>
));
PostComposerSurface.displayName = "PostComposerSurface";

const PostComposerField = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, placeholder, ...props }, ref) => {
		const variant = usePostComposerVariant();

		return (
			<Textarea
				ref={ref}
				placeholder={
					placeholder ??
					(variant === "post"
						? "Share something with the community"
						: "Write a reply")
				}
				className={cn(
					"resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
					variant === "post" ? "min-h-40 px-4 py-4" : "min-h-28 px-4 py-4",
					className,
				)}
				{...props}
			/>
		);
	},
);
PostComposerField.displayName = "PostComposerField";

const PostComposerFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	const variant = usePostComposerVariant();

	return (
		<div
			ref={ref}
			className={cn(
				"flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background px-3 py-2",
				variant === "reply" ? "min-h-12" : "min-h-13",
				className,
			)}
			{...props}
		/>
	);
});
PostComposerFooter.displayName = "PostComposerFooter";

export {
	PostComposer,
	PostComposerBody,
	PostComposerField,
	PostComposerFooter,
	PostComposerMedia,
	PostComposerSurface,
};
