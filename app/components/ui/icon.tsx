import {
	Bell,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	Compass,
	Grid2X2,
	Home,
	ImagePlus,
	Info,
	LoaderCircle,
	type LucideIcon,
	MessageSquare,
	Paperclip,
	Search,
	SendHorizontal,
	Settings,
	TriangleAlert,
	Users,
} from "lucide-react";
import type { SVGProps } from "react";

import { cn } from "~/lib/utils";

const icons = {
	bell: Bell,
	checkCircle2: CheckCircle2,
	chevronDown: ChevronDown,
	chevronRight: ChevronRight,
	circleAlert: CircleAlert,
	compass: Compass,
	grid2x2: Grid2X2,
	home: Home,
	imagePlus: ImagePlus,
	info: Info,
	loaderCircle: LoaderCircle,
	messageSquare: MessageSquare,
	paperclip: Paperclip,
	search: Search,
	sendHorizontal: SendHorizontal,
	settings: Settings,
	triangleAlert: TriangleAlert,
	users: Users,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

type IconProps = SVGProps<SVGSVGElement> & {
	name: IconName;
	size?: number;
	strokeWidth?: number;
};

export function Icon({
	name,
	className,
	size = 16,
	strokeWidth = 1.9,
	...props
}: IconProps) {
	const LucideIcon = icons[name];

	return (
		<LucideIcon
			className={cn("shrink-0", className)}
			size={size}
			strokeWidth={strokeWidth}
			{...props}
		/>
	);
}

export { icons };
