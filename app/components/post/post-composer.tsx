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
	const variant = usePostComposerVariant();

	return (
		<div
			ref={ref}
			className={cn(
				"min-w-0 flex-1",
				variant === "post" ? "space-y-4" : "space-y-3",
				className,
			)}
			{...props}
		/>
	);
});
PostComposerBody.displayName = "PostComposerBody";

const PostComposerHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("space-y-1", className)} {...props} />
));
PostComposerHeader.displayName = "PostComposerHeader";

const PostComposerTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
	const variant = usePostComposerVariant();

	return (
		<h3
			ref={ref}
			className={cn(
				"font-semibold tracking-tight text-foreground",
				variant === "post" ? "text-lg" : "text-base",
				className,
			)}
			{...props}
		/>
	);
});
PostComposerTitle.displayName = "PostComposerTitle";

const PostComposerDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-sm leading-6 text-muted-foreground", className)}
		{...props}
	/>
));
PostComposerDescription.displayName = "PostComposerDescription";

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
					"resize-none border-border bg-background",
					variant === "post" ? "min-h-36" : "min-h-24",
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
				"flex flex-wrap items-center justify-between gap-3",
				variant === "reply" ? "pt-1" : undefined,
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
	PostComposerDescription,
	PostComposerField,
	PostComposerFooter,
	PostComposerHeader,
	PostComposerMedia,
	PostComposerTitle,
};
