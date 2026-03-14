import {
	createContext,
	type HTMLAttributes,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

import { cn } from "~/lib/utils";

type DropdownContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
	const context = useContext(DropdownContext);
	if (!context) {
		throw new Error("Dropdown components must be used within <Dropdown>.");
	}
	return context;
}

export function Dropdown({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function onPointerDown(event: MouseEvent) {
			if (!ref.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return (
		<DropdownContext.Provider value={{ open, setOpen }}>
			<div ref={ref} className={cn("relative inline-block", className)}>
				{children}
			</div>
		</DropdownContext.Provider>
	);
}

export function DropdownTrigger({
	className,
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const { open, setOpen } = useDropdownContext();

	return (
		<button
			type="button"
			aria-expanded={open}
			className={cn(className)}
			onClick={(event) => {
				props.onClick?.(event);
				if (!event.defaultPrevented) {
					setOpen(!open);
				}
			}}
			{...props}
		>
			{children}
		</button>
	);
}

export function DropdownContent({
	className,
	align = "start",
	...props
}: HTMLAttributes<HTMLDivElement> & {
	align?: "start" | "end";
}) {
	const { open } = useDropdownContext();

	if (!open) {
		return null;
	}

	return (
		<div
			className={cn(
				"elevation-medium absolute top-full z-20 mt-2 min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground",
				align === "end" ? "right-0" : "left-0",
				className,
			)}
			{...props}
		/>
	);
}

export function DropdownLabel({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"px-3 py-2 text-sm font-medium text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function DropdownItem({
	className,
	inset = false,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }) {
	const { setOpen } = useDropdownContext();

	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
				inset ? "pl-8" : undefined,
				className,
			)}
			onClick={(event) => {
				props.onClick?.(event);
				if (!event.defaultPrevented) {
					setOpen(false);
				}
			}}
			{...props}
		/>
	);
}

export function DropdownSeparator({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("my-1 h-px bg-border", className)} {...props} />;
}
