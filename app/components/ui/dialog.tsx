import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type DialogContextValue = {
	descriptionId: string;
	open: boolean;
	setOpen: (open: boolean) => void;
	titleId: string;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
	const context = React.useContext(DialogContext);
	if (!context) {
		throw new Error("Dialog components must be used within <Dialog>.");
	}
	return context;
}

type DialogProps = {
	children: React.ReactNode;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function Dialog({
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
}: DialogProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
	const titleId = React.useId();
	const descriptionId = React.useId();
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = React.useCallback(
		(nextOpen: boolean) => {
			if (controlledOpen === undefined) {
				setUncontrolledOpen(nextOpen);
			}
			onOpenChange?.(nextOpen);
		},
		[controlledOpen, onOpenChange],
	);

	return (
		<DialogContext.Provider value={{ descriptionId, open, setOpen, titleId }}>
			{children}
		</DialogContext.Provider>
	);
}

export function DialogTrigger({
	asChild = false,
	className,
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
	const { open, setOpen } = useDialogContext();
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			type="button"
			aria-haspopup="dialog"
			aria-expanded={open}
			className={cn(buttonVariants({ variant: "outline" }), className)}
			onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
				props.onClick?.(event);
				if (!event.defaultPrevented) {
					setOpen(true);
				}
			}}
			{...props}
		>
			{children}
		</Comp>
	);
}

export const DialogContent = React.forwardRef<
	HTMLDialogElement,
	React.DialogHTMLAttributes<HTMLDialogElement>
>(({ className, children, ...props }, forwardedRef) => {
	const { descriptionId, open, setOpen, titleId } = useDialogContext();
	const localRef = React.useRef<HTMLDialogElement>(null);

	React.useEffect(() => {
		const element = localRef.current;
		if (!element) {
			return;
		}

		if (open && !element.open) {
			element.showModal();
		}

		if (!open && element.open) {
			element.close();
		}
	}, [open]);

	return (
		<dialog
			ref={(node) => {
				localRef.current = node;
				if (typeof forwardedRef === "function") {
					forwardedRef(node);
				} else if (forwardedRef) {
					forwardedRef.current = node;
				}
			}}
			data-ui-dialog=""
			aria-describedby={descriptionId}
			aria-labelledby={titleId}
			className={cn(
				"elevation-high fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100%-2rem))] overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground",
				className,
			)}
			onCancel={(event) => {
				props.onCancel?.(event);
				if (!event.defaultPrevented) {
					setOpen(false);
				}
			}}
			onClose={(event) => {
				props.onClose?.(event);
				if (!event.defaultPrevented) {
					setOpen(false);
				}
			}}
			{...props}
		>
			{children}
		</dialog>
	);
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("space-y-2 p-5 pb-0", className)} {...props} />;
}

export function DialogTitle({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	const { titleId } = useDialogContext();

	return (
		<h2
			id={titleId}
			className={cn("text-lg font-semibold tracking-tight", className)}
			{...props}
		/>
	);
}

export function DialogDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	const { descriptionId } = useDialogContext();

	return (
		<p
			id={descriptionId}
			className={cn("text-sm leading-6 text-muted-foreground", className)}
			{...props}
		/>
	);
}

export function DialogBody({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("space-y-4 p-5", className)} {...props} />;
}

export function DialogFooter({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-end gap-2 border-t border-border p-4",
				className,
			)}
			{...props}
		/>
	);
}

export function DialogClose({
	asChild = false,
	className,
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
	const { setOpen } = useDialogContext();
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
				if (!event.defaultPrevented) {
					setOpen(false);
				}
			}}
			{...props}
		>
			{children}
		</Comp>
	);
}
