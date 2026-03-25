import {
	ArrowLeft,
	Bell,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	CircleMinus,
	CirclePlus,
	Compass,
	Grid2X2,
	Home,
	ImagePlus,
	Info,
	LoaderCircle,
	type LucideIcon,
	Menu,
	MessageSquare,
	Paperclip,
	Search,
	SendHorizontal,
	Settings,
	TriangleAlert,
	Users,
	Video,
	X,
} from "lucide-react";
import type { SVGProps } from "react";

import { cn } from "~/lib/utils";

const icons = {
	arrowLeft: ArrowLeft,
	bell: Bell,
	checkCircle2: CheckCircle2,
	chevronDown: ChevronDown,
	chevronRight: ChevronRight,
	circleAlert: CircleAlert,
	circleMinus: CircleMinus,
	circlePlus: CirclePlus,
	compass: Compass,
	grid2x2: Grid2X2,
	home: Home,
	imagePlus: ImagePlus,
	info: Info,
	loaderCircle: LoaderCircle,
	menu: Menu,
	messageSquare: MessageSquare,
	paperclip: Paperclip,
	search: Search,
	sendHorizontal: SendHorizontal,
	settings: Settings,
	triangleAlert: TriangleAlert,
	users: Users,
	video: Video,
	x: X,
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
