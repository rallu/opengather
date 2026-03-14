import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type PopoverContextValue = {
	contentId: string;
	contentElement: HTMLDivElement | null;
	setContentElement: (node: HTMLDivElement | null) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	setTriggerElement: (node: HTMLButtonElement | null) => void;
	triggerElement: HTMLButtonElement | null;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
	const context = React.useContext(PopoverContext);
	if (!context) {
		throw new Error("Popover components must be used within <Popover>.");
	}
	return context;
}

export function Popover({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = React.useState(false);
	const [contentElement, setContentElement] =
		React.useState<HTMLDivElement | null>(null);
	const contentId = React.useId();
	const [triggerElement, setTriggerElement] =
		React.useState<HTMLButtonElement | null>(null);

	return (
		<PopoverContext.Provider
			value={{
				contentElement,
				contentId,
				open,
				setContentElement,
				setOpen,
				setTriggerElement,
				triggerElement,
			}}
		>
			{children}
		</PopoverContext.Provider>
	);
}

function positionPopover(
	trigger: HTMLButtonElement,
	content: HTMLDivElement,
	align: "start" | "end",
) {
	const triggerRect = trigger.getBoundingClientRect();
	const contentRect = content.getBoundingClientRect();
	const viewportPadding = 12;
	const top = Math.min(
		triggerRect.bottom + 8,
		window.innerHeight - contentRect.height - viewportPadding,
	);
	const rawLeft =
		align === "end" ? triggerRect.right - contentRect.width : triggerRect.left;
	const left = Math.min(
		Math.max(viewportPadding, rawLeft),
		window.innerWidth - contentRect.width - viewportPadding,
	);

	content.style.top = `${Math.max(viewportPadding, top)}px`;
	content.style.left = `${left}px`;
}

export function PopoverTrigger({
	asChild = false,
	className,
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
	const { contentElement, contentId, open, setTriggerElement } =
		usePopoverContext();
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			ref={(node: HTMLButtonElement | null) => {
				setTriggerElement(node);
				if (node) {
					node.popoverTargetElement = contentElement;
					node.popoverTargetAction = "toggle";
				}
			}}
			type="button"
			aria-controls={contentId}
			aria-expanded={open}
			className={cn(buttonVariants({ variant: "outline" }), className)}
			{...props}
		>
			{children}
		</Comp>
	);
}

export const PopoverContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & {
		align?: "start" | "end";
	}
>(({ align = "start", className, ...props }, forwardedRef) => {
	const {
		contentElement,
		contentId,
		open,
		setContentElement,
		setOpen,
		triggerElement,
	} = usePopoverContext();

	React.useEffect(() => {
		if (triggerElement) {
			triggerElement.popoverTargetElement = contentElement;
			triggerElement.popoverTargetAction = "toggle";
		}
	}, [contentElement, triggerElement]);

	React.useEffect(() => {
		const content = contentElement;
		const trigger = triggerElement;

		if (!content || !trigger) {
			return;
		}

		if (open) {
			requestAnimationFrame(() => {
				positionPopover(trigger, content, align);
			});

			const reposition = () => positionPopover(trigger, content, align);
			window.addEventListener("resize", reposition);
			window.addEventListener("scroll", reposition, true);

			return () => {
				window.removeEventListener("resize", reposition);
				window.removeEventListener("scroll", reposition, true);
			};
		}
	}, [align, contentElement, open, triggerElement]);

	React.useEffect(() => {
		if (!contentElement) {
			return;
		}

		const onToggle = () => {
			setOpen(contentElement.matches(":popover-open"));
		};

		contentElement.addEventListener("toggle", onToggle);
		return () => contentElement.removeEventListener("toggle", onToggle);
	}, [contentElement, setOpen]);

	return (
		<div
			ref={(node) => {
				setContentElement(node);
				if (typeof forwardedRef === "function") {
					forwardedRef(node);
				} else if (forwardedRef) {
					forwardedRef.current = node;
				}
			}}
			id={contentId}
			data-ui-popover=""
			className={cn(
				"elevation-high m-0 max-w-sm rounded-lg border border-border bg-popover p-4 text-popover-foreground",
				className,
			)}
			{...{ popover: "auto" }}
			{...props}
		/>
	);
});
PopoverContent.displayName = "PopoverContent";

export function PopoverTitle({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn(
				"text-sm font-semibold tracking-tight text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function PopoverDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("mt-1 text-sm leading-6 text-muted-foreground", className)}
			{...props}
		/>
	);
}

export function PopoverClose({
	asChild = false,
	className,
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
	const { contentElement } = usePopoverContext();
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			type="button"
			className={cn(
				buttonVariants({ variant: "ghost", size: "sm" }),
				className,
			)}
			onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
				props.onClick?.(event);
				if (
					!event.defaultPrevented &&
					contentElement?.matches(":popover-open")
				) {
					contentElement.hidePopover();
				}
			}}
			{...props}
		>
			{children}
		</Comp>
	);
}
