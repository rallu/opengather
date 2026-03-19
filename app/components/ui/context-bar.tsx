import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { cn } from "~/lib/utils";

import {
	Breadcrumb,
	BreadcrumbCurrent,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "./breadcrumb";
import { Container } from "./container";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";

export type ContextBarItem = {
	label: ReactNode;
	to?: string;
};

type ContextBarProps = {
	backTo: string;
	backLabel?: string;
	breadcrumbs: ContextBarItem[];
	actions?: ReactNode;
	className?: string;
};

export function ContextBar({
	backTo,
	backLabel = "Back",
	breadcrumbs,
	actions,
	className,
}: ContextBarProps) {
	const location = useLocation();
	const navigate = useNavigate();

	return (
		<Container className={cn("p-3 sm:px-4", className)}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<IconButton
						variant="ghost"
						label={backLabel}
						onClick={() => {
							if (location.key !== "default") {
								navigate(-1);
								return;
							}
							navigate(backTo);
						}}
					>
						<Icon name="arrowLeft" />
					</IconButton>
					<Breadcrumb className="min-w-0">
						<BreadcrumbList className="min-w-0 flex-wrap">
							{breadcrumbs.map((item, index) => {
								const isLast = index === breadcrumbs.length - 1;
								return (
									<BreadcrumbItem key={`${item.to ?? "current"}-${index}`}>
										{!isLast && item.to ? (
											<BreadcrumbLink to={item.to} className="truncate">
												{item.label}
											</BreadcrumbLink>
										) : (
											<BreadcrumbCurrent className="truncate">
												{item.label}
											</BreadcrumbCurrent>
										)}
										{!isLast ? <BreadcrumbSeparator /> : null}
									</BreadcrumbItem>
								);
							})}
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				{actions ? (
					<div className="flex shrink-0 items-center gap-2 sm:justify-end">
						{actions}
					</div>
				) : null}
			</div>
		</Container>
	);
}
