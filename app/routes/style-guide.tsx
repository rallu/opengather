import { Link } from "react-router";
import {
	type PostCommentData,
	PostComments,
} from "~/components/post/post-comments";
import {
	PostComposer,
	PostComposerBody,
	PostComposerField,
	PostComposerFooter,
	PostComposerMedia,
	PostComposerSurface,
} from "~/components/post/post-composer";
import { PostContent } from "~/components/post/post-content";
import { PostHeading } from "~/components/post/post-heading";
import { PostImageContent } from "~/components/post/post-image-content";
import { PostImageGalleryContent } from "~/components/post/post-image-gallery-content";
import { PostLabels } from "~/components/post/post-labels";
import { PostLinkContent } from "~/components/post/post-link-content";
import { PostRichTextContent } from "~/components/post/post-rich-text-content";
import { PostVideoContent } from "~/components/post/post-video-content";
import { ProfileCard } from "~/components/profile/profile-card";
import { ProfileIdentity } from "~/components/profile/profile-identity";
import { ProfileImage } from "~/components/profile/profile-image";
import { Badge } from "~/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbCurrent,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { ButtonGroup, ButtonGroupItem } from "~/components/ui/button-group";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	Dropdown,
	DropdownContent,
	DropdownItem,
	DropdownLabel,
	DropdownSeparator,
	DropdownTrigger,
} from "~/components/ui/dropdown";
import { HeroImage } from "~/components/ui/hero-image";
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	CenteredLayout,
	LayoutMain,
	LayoutSidebar,
	RightSidebarLayout,
} from "~/components/ui/layouts";
import { Navigation, SubNavigation } from "~/components/ui/navigation";
import { NavigationList } from "~/components/ui/navigation-list";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "~/components/ui/popover";
import { RichTextContent } from "~/components/ui/rich-text-content";
import {
	Selector,
	SelectorAnchor,
	SelectorContent,
	SelectorItem,
	SelectorItemContent,
	SelectorItemDescription,
	SelectorItemMedia,
	SelectorItemMeta,
	SelectorItemTitle,
	SelectorLabel,
	SelectorList,
} from "~/components/ui/selector";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Toast } from "~/components/ui/toast";
import { RICH_TEXT_VERSION, type RichTextDocument } from "~/lib/rich-text";

function createProfileArt(params: {
	backgroundStart: string;
	backgroundEnd: string;
	accent: string;
	label: string;
}) {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 960">
			<defs>
				<linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
					<stop offset="0%" stop-color="${params.backgroundStart}" />
					<stop offset="100%" stop-color="${params.backgroundEnd}" />
				</linearGradient>
			</defs>
			<rect width="640" height="960" fill="url(#bg)" />
			<circle cx="320" cy="300" r="150" fill="${params.accent}" opacity="0.95" />
			<rect x="160" y="500" width="320" height="230" rx="120" fill="${params.accent}" opacity="0.92" />
			<circle cx="120" cy="180" r="70" fill="white" opacity="0.14" />
			<circle cx="520" cy="740" r="110" fill="white" opacity="0.12" />
			<text
				x="320"
				y="900"
				font-family="Arial, sans-serif"
				font-size="48"
				fill="white"
				text-anchor="middle"
				letter-spacing="8"
			>${params.label}</text>
		</svg>
	`;

	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createHeroArt() {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">
			<defs>
				<linearGradient id="sky" x1="0%" x2="100%" y1="0%" y2="100%">
					<stop offset="0%" stop-color="#0f766e" />
					<stop offset="45%" stop-color="#115e59" />
					<stop offset="100%" stop-color="#111827" />
				</linearGradient>
			</defs>
			<rect width="1440" height="900" fill="url(#sky)" />
			<circle cx="1080" cy="160" r="120" fill="#99f6e4" opacity="0.18" />
			<circle cx="240" cy="220" r="180" fill="#ccfbf1" opacity="0.08" />
			<rect x="120" y="520" width="320" height="180" rx="32" fill="#ecfeff" opacity="0.16" />
			<rect x="500" y="420" width="380" height="220" rx="36" fill="#ffffff" opacity="0.1" />
			<rect x="940" y="500" width="280" height="160" rx="28" fill="#f0fdfa" opacity="0.18" />
			<path d="M0 760C180 700 320 650 480 680C620 706 780 818 940 820C1100 822 1240 710 1440 640V900H0Z" fill="#022c22" opacity="0.4" />
			<path d="M0 820C140 780 320 740 460 760C620 784 780 870 980 858C1140 848 1280 780 1440 720V900H0Z" fill="#111827" opacity="0.65" />
		</svg>
	`;

	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPostMediaArt(params: {
	accent: string;
	backgroundEnd: string;
	backgroundStart: string;
	label: string;
}) {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1080">
			<defs>
				<linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
					<stop offset="0%" stop-color="${params.backgroundStart}" />
					<stop offset="100%" stop-color="${params.backgroundEnd}" />
				</linearGradient>
			</defs>
			<rect width="1440" height="1080" fill="url(#bg)" />
			<circle cx="1180" cy="220" r="160" fill="${params.accent}" opacity="0.22" />
			<circle cx="300" cy="260" r="220" fill="white" opacity="0.08" />
			<rect x="160" y="580" width="420" height="220" rx="28" fill="${params.accent}" opacity="0.28" />
			<rect x="680" y="450" width="520" height="300" rx="32" fill="white" opacity="0.1" />
			<path d="M0 850C190 780 360 730 540 752C740 776 860 914 1090 908C1230 904 1330 850 1440 788V1080H0Z" fill="#0f172a" opacity="0.52" />
			<text
				x="120"
				y="980"
				font-family="Arial, sans-serif"
				font-size="56"
				font-weight="700"
				fill="white"
				letter-spacing="4"
			>${params.label}</text>
		</svg>
	`;

	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const heroImage = createHeroArt();
const ainoImage = createProfileArt({
	backgroundStart: "#1d4ed8",
	backgroundEnd: "#0f172a",
	accent: "#93c5fd",
	label: "AINO",
});
const mikaImage = createProfileArt({
	backgroundStart: "#7c3aed",
	backgroundEnd: "#1f2937",
	accent: "#c4b5fd",
	label: "MIKA",
});
const saraImage = createProfileArt({
	backgroundStart: "#0f766e",
	backgroundEnd: "#134e4a",
	accent: "#99f6e4",
	label: "SARA",
});
const marketImage = createPostMediaArt({
	backgroundStart: "#234B47",
	backgroundEnd: "#0f172a",
	accent: "#8ed1c7",
	label: "SATURDAY MARKET",
});
const gardenImage = createPostMediaArt({
	backgroundStart: "#365314",
	backgroundEnd: "#1f2937",
	accent: "#bef264",
	label: "COMMUNITY GARDEN",
});
const routeImage = createPostMediaArt({
	backgroundStart: "#1d4ed8",
	backgroundEnd: "#172554",
	accent: "#93c5fd",
	label: "ROUTE UPDATE",
});
const kitchenImage = createPostMediaArt({
	backgroundStart: "#7c2d12",
	backgroundEnd: "#1f2937",
	accent: "#fdba74",
	label: "OPEN KITCHEN",
});
const workshopImage = createPostMediaArt({
	backgroundStart: "#7c3aed",
	backgroundEnd: "#312e81",
	accent: "#c4b5fd",
	label: "REPAIR WORKSHOP",
});
const archiveImage = createPostMediaArt({
	backgroundStart: "#334155",
	backgroundEnd: "#0f172a",
	accent: "#cbd5e1",
	label: "ARCHIVE NOTES",
});

const sampleComments: PostCommentData[] = [
	{
		id: "comment-1",
		threadDepth: 0,
		author: "Aino Moderator",
		imageSrc: ainoImage,
		fallback: "AM",
		body: "Pinned notes like this should feel calm and readable even when the thread gets long.",
		createdAt: "2026-03-14T09:45:00.000Z",
		actions: [{ label: "Reply" }, { label: "Share" }, { label: "Report" }],
		replies: [
			{
				id: "comment-1-1",
				threadDepth: 1,
				author: "Mika Member",
				imageSrc: mikaImage,
				fallback: "MM",
				body: "Agreed. The nested reply should still stay easy to scan on mobile.",
				createdAt: "2026-03-14T09:58:00.000Z",
				actions: [{ label: "Reply" }, { label: "Share" }],
				replies: [
					{
						id: "comment-1-1-1",
						threadDepth: 2,
						author: "Sara Admin",
						imageSrc: saraImage,
						fallback: "SA",
						body: "This is why the indentation needs to be moderate rather than extreme.",
						createdAt: "2026-03-14T10:05:00.000Z",
						actions: [{ label: "Reply" }],
					},
				],
			},
		],
	},
	{
		id: "comment-2",
		threadDepth: 0,
		author: "Ville Member",
		fallback: "VM",
		body: "We also need to show state badges cleanly when moderation changes the comment later.",
		createdAt: "2026-03-14T10:12:00.000Z",
		moderationStatus: "flagged",
		actions: [{ label: "Reply" }, { label: "Share" }, { label: "Hide" }],
	},
];

const navigationItems = [
	{ label: "Feed", to: "/feed", active: true },
	{ label: "Groups", to: "/groups" },
	{ label: "Notifications", to: "/notifications" },
	{ label: "Profile", to: "/profile" },
	{ label: "Settings", to: "/settings" },
];

const subNavigationItems = [
	{ label: "Overview", to: "/profile", active: true },
	{ label: "Members", to: "/profile" },
	{ label: "Posts", to: "/profile" },
	{ label: "Files", to: "/profile" },
];

const navigationListSections = [
	{
		title: "Community spaces",
		description:
			"Sectioned navigation list with icons or profile images at the front.",
		items: [
			{
				id: "space-feed",
				title: "Main feed",
				description: "Posts and replies across the full community.",
				to: "/feed",
				leading: (
					<div className="rounded-lg bg-primary/10 p-2 text-primary">
						<Icon name="compass" size={16} />
					</div>
				),
				trailing: "Active",
				active: true,
			},
			{
				id: "space-groups",
				title: "Working groups",
				description: "Small group spaces for projects and teams.",
				to: "/groups",
				leading: (
					<div className="rounded-lg bg-muted p-2 text-muted-foreground">
						<Icon name="users" size={16} />
					</div>
				),
				trailing: "14",
			},
		],
	},
	{
		title: "People",
		items: [
			{
				id: "person-aino",
				title: "Aino Moderator",
				description: "Neighborhood planning lead",
				to: "/profile",
				leading: (
					<ProfileImage src={ainoImage} alt="Aino" fallback="AM" size="sm" />
				),
				trailing: "Admin",
			},
			{
				id: "person-mika",
				title: "Mika Member",
				description: "Helped launch the community kitchen.",
				to: "/profile",
				leading: (
					<ProfileImage src={mikaImage} alt="Mika" fallback="MM" size="sm" />
				),
			},
		],
	},
];

const richTextExample: RichTextDocument = {
	version: RICH_TEXT_VERSION,
	blocks: [
		{
			type: "paragraph",
			children: [
				{
					type: "text",
					text: "This content format stores plain text and typed links in one document. You can link to ",
				},
				{
					type: "link",
					text: "a profile",
					target: {
						type: "profile",
						profileId: "aino-moderator",
						to: "/profile",
					},
				},
				{
					type: "text",
					text: ", jump to ",
				},
				{
					type: "link",
					text: "a feed post",
					target: { type: "post", postId: "post-42" },
				},
				{
					type: "text",
					text: ", or open ",
				},
				{
					type: "link",
					text: "an external reference",
					target: {
						type: "external",
						href: "https://developer.mozilla.org/en-US/docs/Web/API/Popover_API",
					},
				},
				{
					type: "text",
					text: ".",
				},
			],
		},
		{
			type: "paragraph",
			children: [
				{
					type: "text",
					text: "The stored format stays structural, so the renderer never has to guess whether a link is internal or external.",
				},
			],
		},
	],
};

function SectionHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
			<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
				{description}
			</p>
		</div>
	);
}

function GuideGroup({
	id,
	title,
	description,
	children,
}: {
	id: string;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className="space-y-6 scroll-mt-24" data-testid={id}>
			<div className="space-y-2 border-b border-border pb-4">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
					{description}
				</p>
			</div>
			<div className="space-y-10">{children}</div>
		</section>
	);
}

const styleGuideGroups = [
	{
		title: "Design Tokens",
		description:
			"Foundational visual values that define the tone, spacing, and rhythm of the system.",
		items: [
			{ id: "style-guide-tokens-colors", title: "Colors" },
			{ id: "style-guide-tokens-fonts", title: "Fonts" },
			{ id: "style-guide-tokens-headings", title: "Headings" },
			{ id: "style-guide-tokens-body-text", title: "Body Text" },
			{ id: "style-guide-tokens-spacing", title: "Spacing" },
			{ id: "style-guide-tokens-radius", title: "Corner Radius" },
		],
	},
	{
		title: "Foundations",
		description:
			"Base primitives and system rules that other components build on.",
		items: [
			{ id: "style-guide-button", title: "Button" },
			{ id: "style-guide-button-group", title: "Button Group" },
			{ id: "style-guide-icon", title: "Icon" },
			{ id: "style-guide-icon-button", title: "Icon Button" },
			{ id: "style-guide-badge", title: "Badge" },
			{ id: "style-guide-card", title: "Card" },
			{ id: "style-guide-elevation", title: "Elevation" },
		],
	},
	{
		title: "Forms And Actions",
		description:
			"Inputs, labels, menus, and small feedback patterns for interaction.",
		items: [
			{ id: "style-guide-label", title: "Label" },
			{ id: "style-guide-input", title: "Input" },
			{ id: "style-guide-textarea", title: "Textarea" },
			{ id: "style-guide-selector", title: "Selector" },
			{ id: "style-guide-dialog", title: "Dialog" },
			{ id: "style-guide-popover", title: "Popover" },
			{ id: "style-guide-dropdown", title: "Dropdown" },
			{ id: "style-guide-spinner", title: "Spinner" },
			{ id: "style-guide-toast", title: "Toast" },
		],
	},
	{
		title: "Navigation And Wayfinding",
		description:
			"Components that help people move through routes, sections, and structures.",
		items: [
			{ id: "style-guide-navigation", title: "Navigation" },
			{ id: "style-guide-breadcrumb", title: "Breadcrumb" },
			{ id: "style-guide-navigation-list", title: "Navigation List" },
		],
	},
	{
		title: "Identity And Media",
		description:
			"Profile and image-led surfaces used for people, groups, and feature moments.",
		items: [
			{ id: "style-guide-hero-image", title: "Hero Image" },
			{ id: "style-guide-profile-image", title: "Profile Image" },
			{ id: "style-guide-profile-listing", title: "Profile Listing" },
			{ id: "style-guide-profile-card", title: "Profile Card" },
		],
	},
	{
		title: "Layouts",
		description:
			"Page and surface arrangements that define how content and side regions share space.",
		items: [
			{ id: "style-guide-layout-centered", title: "Centered Feed Layout" },
			{
				id: "style-guide-layout-right-sidebar",
				title: "Right Sidebar Layout",
			},
		],
	},
	{
		title: "Posts And Conversation",
		description:
			"Content structures for posts, replies, and lightweight conversational UI.",
		items: [
			{ id: "style-guide-post-heading", title: "Post Heading" },
			{ id: "style-guide-post-composer", title: "Post Composer" },
			{ id: "style-guide-post-content", title: "Post Content" },
			{ id: "style-guide-rich-text-content", title: "Rich Text Content" },
			{ id: "style-guide-post-image-content", title: "Single Image Content" },
			{
				id: "style-guide-post-image-gallery-content",
				title: "Image Gallery Content",
			},
			{ id: "style-guide-post-video-content", title: "Video Content" },
			{ id: "style-guide-post-link-content", title: "Link Content" },
			{ id: "style-guide-chat-bubble", title: "Chat Bubble" },
			{ id: "style-guide-post-comments", title: "Post Comments" },
		],
	},
] as const;

export default function StyleGuidePage() {
	return (
		<div
			className="min-h-screen bg-background"
			data-testid="style-guide-full-layout"
		>
			<header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
				<div className="flex w-full items-center justify-between gap-4 px-6 py-4 lg:px-8">
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold tracking-tight">
							Style Guide
						</h1>
						<p className="text-sm text-muted-foreground">
							Internal component reference with full-width space for the system.
						</p>
					</div>
					<Button asChild variant="outline">
						<Link to="/feed">Back to feed</Link>
					</Button>
				</div>
			</header>

			<div
				className="space-y-10 px-6 py-8 lg:px-8"
				data-testid="style-guide-page"
			>
				<Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-background via-background to-muted/40">
					<CardHeader className="gap-4">
						<CardTitle className="text-3xl leading-tight sm:text-4xl">
							Shared building pieces for the first OpenGather interface system.
						</CardTitle>
						<CardDescription className="max-w-4xl text-sm leading-7">
							This route has its own full-page layout so the component system,
							left-side anchor navigation, and example surfaces have enough room
							to breathe. It stays token-based, keeps room for community
							theming, and acts as the reference for future extraction work.
						</CardDescription>
					</CardHeader>
				</Card>

				<div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
					<aside className="hidden lg:block">
						<div
							className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto pr-3"
							data-testid="style-guide-side-nav"
						>
							<nav className="space-y-5">
								{styleGuideGroups.map((group) => (
									<div key={group.title} className="space-y-2">
										<a
											href={`#style-guide-group-${group.title.toLowerCase().replaceAll(" ", "-")}`}
											className="block text-sm font-medium text-foreground transition-colors hover:text-primary"
										>
											{group.title}
										</a>
										<div className="space-y-1">
											{group.items.map((item) => (
												<a
													key={item.id}
													href={`#${item.id}`}
													className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
												>
													{item.title}
												</a>
											))}
										</div>
									</div>
								))}
							</nav>
						</div>
					</aside>

					<div className="space-y-10">
						<GuideGroup
							id="style-guide-group-design-tokens"
							title="Design Tokens"
							description="Foundational values for color, typography, spacing, and shape. These define the visual baseline before component-specific decisions begin."
						>
							<section
								className="space-y-4"
								data-testid="style-guide-tokens-colors"
							>
								<SectionHeader
									title="Colors"
									description="Semantic color roles should be used through tokens rather than hard-coded values in routes or one-off components."
								/>
								<Card>
									<CardContent className="grid gap-3 pt-6 md:grid-cols-3 xl:grid-cols-6">
										{[
											{
												label: "Background",
												swatch: "bg-background",
												text: "hsl(var(--background))",
												border: "border-border",
											},
											{
												label: "Foreground",
												swatch: "bg-foreground",
												text: "hsl(var(--foreground))",
												border: "border-border",
											},
											{
												label: "Primary",
												swatch: "bg-primary",
												text: "hsl(var(--primary))",
												border: "border-border",
											},
											{
												label: "Muted",
												swatch: "bg-muted",
												text: "hsl(var(--muted))",
												border: "border-border",
											},
											{
												label: "Accent",
												swatch: "bg-accent",
												text: "hsl(var(--accent))",
												border: "border-border",
											},
											{
												label: "Info",
												swatch: "bg-info",
												text: "hsl(var(--info))",
												border: "border-info/50",
											},
											{
												label: "Approved",
												swatch: "bg-success",
												text: "hsl(var(--success))",
												border: "border-success/50",
											},
											{
												label: "Flagged",
												swatch: "bg-warning",
												text: "hsl(var(--warning))",
												border: "border-warning/50",
											},
											{
												label: "Destructive",
												swatch: "bg-destructive",
												text: "hsl(var(--destructive))",
												border: "border-destructive/30",
											},
										].map((token) => (
											<div
												key={token.label}
												className="space-y-3 rounded-lg border border-border p-3"
											>
												<div
													className={`h-14 rounded-md border ${token.border} ${token.swatch}`}
												/>
												<div className="space-y-1">
													<p className="text-sm font-medium">{token.label}</p>
													<p className="text-xs text-muted-foreground">
														{token.text}
													</p>
												</div>
											</div>
										))}
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-tokens-fonts"
							>
								<SectionHeader
									title="Fonts"
									description="The system currently uses a single sans family. Weight and size changes should do more work than adding unrelated font pairings."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<div className="rounded-lg border border-border p-4">
											<p className="text-sm text-muted-foreground">
												Sans family
											</p>
											<p className="mt-2 text-2xl font-semibold tracking-tight">
												Inter, ui-sans-serif, system-ui, sans-serif
											</p>
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-tokens-headings"
							>
								<SectionHeader
									title="Headings"
									description="The typography token scale should stay simple: a display heading plus H2 through H4. Component-specific titles belong in components, not in the token layer."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<div className="space-y-2">
											<p className="text-sm font-medium text-muted-foreground">
												Display H1
											</p>
											<p className="text-4xl font-semibold tracking-tight">
												OpenGather style guide display
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-muted-foreground">
												H2
											</p>
											<p className="text-2xl font-semibold tracking-tight">
												Primary content heading
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-muted-foreground">
												H3
											</p>
											<p className="text-lg font-semibold tracking-tight">
												Supporting content heading
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-muted-foreground">
												H4
											</p>
											<p className="text-base font-semibold tracking-tight">
												Compact interface heading
											</p>
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-tokens-body-text"
							>
								<SectionHeader
									title="Body Text"
									description="Body copy should stay readable and calm, with line-height tuned for product scanning rather than editorial drift."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<p className="max-w-3xl text-base leading-7 text-foreground">
											Body text in OpenGather should read clearly on both dense
											product screens and longer content surfaces. It should
											feel stable and useful rather than promotional.
										</p>
										<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
											Secondary body text carries support content, metadata, and
											explanatory UI copy without competing with the primary
											information.
										</p>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-tokens-spacing"
							>
								<SectionHeader
									title="Spacing"
									description="Spacing should stay systematic and restrained. The system should prefer a few repeatable gaps over many custom offsets."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<div className="flex items-end gap-4">
											{[
												{ label: "4", className: "h-4 w-12" },
												{ label: "8", className: "h-8 w-12" },
												{ label: "12", className: "h-12 w-12" },
												{ label: "16", className: "h-16 w-12" },
												{ label: "24", className: "h-24 w-12" },
											].map((space) => (
												<div
													key={space.label}
													className="space-y-2 text-center"
												>
													<div
														className={`rounded-sm bg-primary/12 ${space.className}`}
													/>
													<p className="text-xs text-muted-foreground">
														{space.label}
													</p>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-tokens-radius"
							>
								<SectionHeader
									title="Corner Radius"
									description="Corner radius should stay moderate. Most surfaces should feel precise rather than overly soft."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 md:grid-cols-3">
										<div className="space-y-2">
											<p className="text-sm font-medium">Tight</p>
											<div className="h-16 rounded-sm border border-border bg-muted/50" />
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium">Default</p>
											<div className="h-16 rounded-md border border-border bg-muted/50" />
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium">Surface</p>
											<div className="h-16 rounded-lg border border-border bg-muted/50" />
										</div>
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-foundations"
							title="Foundations"
							description="Core building blocks, state markers, and surface rules used across the whole UI system."
						>
							<section className="space-y-4" data-testid="style-guide-button">
								<SectionHeader
									title="Button"
									description="Primary action control. Use the shared button variants for calls to action, secondary actions, and low-emphasis inline controls."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-3 pt-6">
										<Button>Primary action</Button>
										<Button variant="secondary">Secondary</Button>
										<Button variant="outline">Outline</Button>
										<Button variant="ghost">Ghost</Button>
										<Button variant="destructive">Destructive</Button>
										<Button variant="link">Link style</Button>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-button-group"
							>
								<SectionHeader
									title="Button Group"
									description="Grouped related actions into a single compact control. Use it when actions belong together and should read as one set instead of separate loose buttons."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-3 pt-6">
										<ButtonGroup>
											<ButtonGroupItem>Comment</ButtonGroupItem>
											<ButtonGroupItem>Share</ButtonGroupItem>
										</ButtonGroup>
										<ButtonGroup>
											<ButtonGroupItem>Day</ButtonGroupItem>
											<ButtonGroupItem>Week</ButtonGroupItem>
											<ButtonGroupItem>Month</ButtonGroupItem>
										</ButtonGroup>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-icon">
								<SectionHeader
									title="Icon"
									description="Single icon wrapper for all Lucide usage in the product. Use this component instead of importing icons route-by-route."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-4 pt-6">
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Icon name="home" />
											<span className="text-sm">Home</span>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Icon name="bell" />
											<span className="text-sm">Alerts</span>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Icon name="settings" />
											<span className="text-sm">Settings</span>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Icon name="grid2x2" />
											<span className="text-sm">Layout</span>
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-icon-button"
							>
								<SectionHeader
									title="Icon Button"
									description="Compact action control for icon-only affordances. Use it when the icon is clear, the action is small, and an accessible label is supplied."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-3 pt-6">
										<IconButton label="Add image" variant="ghost">
											<Icon name="imagePlus" size={16} />
										</IconButton>
										<IconButton label="Attach file" variant="outline">
											<Icon name="paperclip" size={16} />
										</IconButton>
										<IconButton label="Send reply">
											<Icon name="sendHorizontal" size={16} />
										</IconButton>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-badge">
								<SectionHeader
									title="Badge"
									description="Small state indicator for moderation, visibility, and status. Use badges when the UI needs compact state markers without turning them into full pills or buttons."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-3 pt-6">
										<Badge>Hidden</Badge>
										<Badge variant="neutral">Draft</Badge>
										<Badge variant="success">Approved</Badge>
										<Badge variant="warning">Flagged</Badge>
										<Badge variant="danger">Rejected</Badge>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-card">
								<SectionHeader
									title="Card"
									description="Default content container for grouped information, internal panels, guide sections, and compositional feature blocks."
								/>
								<Card>
									<CardHeader>
										<CardTitle>Community overview</CardTitle>
										<CardDescription>
											Cards provide a reliable header-content-footer structure
											for future product surfaces.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<p className="text-sm leading-7 text-muted-foreground">
											Use cards when a block needs clear hierarchy, breathing
											room, and a consistent border/surface treatment.
										</p>
										<div className="grid gap-3 sm:grid-cols-3">
											<div className="rounded-lg bg-muted/50 p-3 text-sm">
												<p className="font-medium">Members</p>
												<p className="mt-1 text-muted-foreground">128 active</p>
											</div>
											<div className="rounded-lg bg-muted/50 p-3 text-sm">
												<p className="font-medium">Groups</p>
												<p className="mt-1 text-muted-foreground">
													14 public spaces
												</p>
											</div>
											<div className="rounded-lg bg-muted/50 p-3 text-sm">
												<p className="font-medium">Moderation</p>
												<p className="mt-1 text-muted-foreground">
													Healthy baseline
												</p>
											</div>
										</div>
									</CardContent>
									<CardFooter>
										<Button size="sm">Open dashboard</Button>
										<Button size="sm" variant="outline">
											Learn more
										</Button>
									</CardFooter>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-elevation"
							>
								<SectionHeader
									title="Elevation"
									description="Shared depth system with three levels. Most components should stay on low elevation and only move up when hierarchy genuinely needs it."
								/>
								<div className="grid gap-4 lg:grid-cols-3">
									<div className="elevation-low rounded-lg border border-border bg-card p-4">
										<p className="text-sm font-medium text-foreground">Low</p>
										<p className="mt-2 text-sm text-muted-foreground">
											Default for cards, bubbles, navigation, and everyday
											surfaces.
										</p>
									</div>
									<div className="elevation-medium rounded-lg border border-border bg-card p-4">
										<p className="text-sm font-medium text-foreground">
											Medium
										</p>
										<p className="mt-2 text-sm text-muted-foreground">
											Use sparingly for feature surfaces such as heroes or
											highlighted content.
										</p>
									</div>
									<div className="elevation-high rounded-lg border border-border bg-card p-4">
										<p className="text-sm font-medium text-foreground">High</p>
										<p className="mt-2 text-sm text-muted-foreground">
											Reserve for overlays, urgent layers, or future modal-level
											UI.
										</p>
									</div>
								</div>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-forms-and-actions"
							title="Forms And Actions"
							description="Form controls, menus, and compact feedback patterns used while interacting with the product."
						>
							<section className="space-y-4" data-testid="style-guide-input">
								<SectionHeader
									title="Input"
									description="Single-line field for search, auth, settings, and lightweight form capture. It now supports optional prefix and suffix content, including icon and button affordances."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="style-guide-input-default">Default</Label>
											<Input
												id="style-guide-input-default"
												defaultValue="community@example.com"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="style-guide-input-prefix">
												Prefix icon
											</Label>
											<Input
												id="style-guide-input-prefix"
												placeholder="Search communities"
												leadingAccessory={<Icon name="search" size={16} />}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="style-guide-input-suffix">
												Suffix button
											</Label>
											<Input
												id="style-guide-input-suffix"
												placeholder="Invite by email"
												trailingAccessory={
													<Button
														size="sm"
														variant="ghost"
														className="h-7 px-2"
													>
														Send
													</Button>
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="style-guide-input-invalid">Invalid</Label>
											<Input
												id="style-guide-input-invalid"
												defaultValue="not-an-email"
												aria-invalid="true"
												leadingAccessory={
													<Icon name="messageSquare" size={16} />
												}
											/>
										</div>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-label">
								<SectionHeader
									title="Label"
									description="Form field label primitive. Keep it quiet, readable, and consistent instead of redefining label styling in each route."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="style-guide-label-example">
												Community name
											</Label>
											<Input
												id="style-guide-label-example"
												placeholder="OpenGather Helsinki"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="style-guide-label-search">Search</Label>
											<Input
												id="style-guide-label-search"
												leadingAccessory={<Icon name="search" size={16} />}
												placeholder="Find members"
											/>
										</div>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-textarea">
								<SectionHeader
									title="Textarea"
									description="Multi-line field for posting, setup descriptions, and longer settings content. Use for composition surfaces that need clear vertical rhythm."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="style-guide-textarea-default">
												Default
											</Label>
											<Textarea
												id="style-guide-textarea-default"
												defaultValue={
													"OpenGather lets a community shape the interface without rewriting the product."
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="style-guide-textarea-disabled">
												Disabled
											</Label>
											<Textarea
												id="style-guide-textarea-disabled"
												defaultValue="This content is read-only in this state."
												disabled
											/>
										</div>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-selector">
								<SectionHeader
									title="Selector"
									description="Anchored suggestion surface for rich-text linking and mention-style flows. Use it when typing in a text field should open a focused list of profiles, posts, groups, or other structured targets."
								/>
								<Card>
									<CardContent className="pt-6">
										<Selector open>
											<SelectorAnchor>
												<Textarea
													defaultValue="Let’s mention @ain and link the Saturday route update in this post."
													className="min-h-32"
													aria-label="Selector example input"
												/>
											</SelectorAnchor>
											<SelectorContent className="max-w-xl">
												<SelectorLabel>Suggestions for “ain”</SelectorLabel>
												<SelectorList>
													<SelectorItem active>
														<SelectorItemMedia>
															<ProfileImage
																src={ainoImage}
																alt="Aino Moderator"
																fallback="AM"
																size="sm"
															/>
														</SelectorItemMedia>
														<SelectorItemContent>
															<SelectorItemTitle>
																Aino Moderator
															</SelectorItemTitle>
															<SelectorItemDescription>
																Profile link
															</SelectorItemDescription>
														</SelectorItemContent>
														<SelectorItemMeta>@profile</SelectorItemMeta>
													</SelectorItem>
													<SelectorItem>
														<SelectorItemMedia>
															<div className="rounded-md bg-primary/10 p-2 text-primary">
																<Icon name="messageSquare" size={16} />
															</div>
														</SelectorItemMedia>
														<SelectorItemContent>
															<SelectorItemTitle>
																Saturday route update
															</SelectorItemTitle>
															<SelectorItemDescription>
																Post in the main feed
															</SelectorItemDescription>
														</SelectorItemContent>
														<SelectorItemMeta>#post</SelectorItemMeta>
													</SelectorItem>
													<SelectorItem>
														<SelectorItemMedia>
															<div className="rounded-md bg-muted p-2 text-muted-foreground">
																<Icon name="users" size={16} />
															</div>
														</SelectorItemMedia>
														<SelectorItemContent>
															<SelectorItemTitle>
																Neighborhood Organizers
															</SelectorItemTitle>
															<SelectorItemDescription>
																Group link
															</SelectorItemDescription>
														</SelectorItemContent>
														<SelectorItemMeta>/group</SelectorItemMeta>
													</SelectorItem>
												</SelectorList>
											</SelectorContent>
										</Selector>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-dialog">
								<SectionHeader
									title="Dialog"
									description="Modal surface built on the native HTML dialog element. Use it for blocking flows that need full attention and an explicit close path."
								/>
								<Card>
									<CardContent className="pt-6">
										<Dialog>
											<DialogTrigger>Open dialog</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Invite members</DialogTitle>
													<DialogDescription>
														Use dialog when the task should temporarily take
														over the interface, such as inviting people or
														confirming a destructive action.
													</DialogDescription>
												</DialogHeader>
												<DialogBody>
													<Input
														defaultValue="neighborhood@opengather.test"
														aria-label="Invite email"
													/>
													<Textarea
														defaultValue="We are opening the next planning thread today. Join when you can."
														aria-label="Invite message"
													/>
												</DialogBody>
												<DialogFooter>
													<DialogClose>Close</DialogClose>
													<Button>Send invite</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-popover">
								<SectionHeader
									title="Popover"
									description="Lightweight overlay built on native HTML popover behavior. Use it for secondary context like quick actions, previews, and small helper panels."
								/>
								<Card>
									<CardContent className="pt-6">
										<Popover>
											<PopoverTrigger>Open popover</PopoverTrigger>
											<PopoverContent>
												<PopoverTitle>Quick reactions</PopoverTitle>
												<PopoverDescription>
													This pattern stays lighter than dialog and should not
													carry full workflows.
												</PopoverDescription>
												<div className="mt-4 flex flex-wrap items-center gap-2">
													<IconButton label="Celebrate" variant="outline">
														<Icon name="checkCircle2" size={16} />
													</IconButton>
													<IconButton label="Alert" variant="outline">
														<Icon name="triangleAlert" size={16} />
													</IconButton>
													<IconButton label="Notify" variant="outline">
														<Icon name="bell" size={16} />
													</IconButton>
												</div>
												<div className="mt-4 flex justify-end">
													<PopoverClose>Close</PopoverClose>
												</div>
											</PopoverContent>
										</Popover>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-dropdown">
								<SectionHeader
									title="Dropdown"
									description="Compact action menu for contextual choices. Use it for local actions, quick filters, or secondary commands that should not crowd the surface."
								/>
								<Card>
									<CardContent className="pt-6">
										<Dropdown>
											<DropdownTrigger className="elevation-low inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium">
												Quick actions
												<Icon name="chevronDown" size={16} />
											</DropdownTrigger>
											<DropdownContent>
												<DropdownLabel>Post actions</DropdownLabel>
												<DropdownItem>
													<Icon name="messageSquare" size={16} />
													Reply
												</DropdownItem>
												<DropdownItem>
													<Icon name="bell" size={16} />
													Watch thread
												</DropdownItem>
												<DropdownSeparator />
												<DropdownItem>
													<Icon name="settings" size={16} />
													Moderation settings
												</DropdownItem>
											</DropdownContent>
										</Dropdown>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-spinner">
								<SectionHeader
									title="Spinner"
									description="Loading affordance built on the shared icon system. Use it for in-progress states where the interface needs a lightweight motion cue."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-4 pt-6">
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Spinner size="sm" />
											<span className="text-sm">Small</span>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Spinner size="md" />
											<span className="text-sm">Medium</span>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
											<Spinner size="lg" />
											<span className="text-sm">Large</span>
										</div>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-4" data-testid="style-guide-toast">
								<SectionHeader
									title="Toast"
									description="Presentational notification pattern only in v1. This documents the visual states before an app-wide provider or action integration is introduced."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
										<Toast
											variant="info"
											title="Settings saved locally"
											description="Use the neutral info toast for low-risk confirmation and guidance."
											action={
												<Button size="sm" variant="outline">
													View
												</Button>
											}
										/>
										<Toast
											variant="success"
											title="Post published"
											description="Use success when the requested action completed and the user can keep moving."
										/>
										<Toast
											variant="warning"
											title="Approval still pending"
											description="Use warning when the user should understand a wait state or partial block."
										/>
										<Toast
											variant="error"
											title="Could not create post"
											description="Use error when the action failed and the user needs to retry or change input."
										/>
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-navigation-and-wayfinding"
							title="Navigation And Wayfinding"
							description="Shared structures for moving around the product and understanding where you are."
						>
							<section
								className="space-y-4"
								data-testid="style-guide-navigation"
							>
								<SectionHeader
									title="Navigation"
									description="Primary page-level navigation and smaller sub-navigation patterns. They should be shared, calm, and consistent across major app surfaces."
								/>
								<Card>
									<CardContent className="space-y-6 pt-6">
										<div className="space-y-3">
											<p className="text-sm font-medium">Primary navigation</p>
											<Navigation items={navigationItems} />
										</div>
										<div className="space-y-3">
											<p className="text-sm font-medium">Sub-navigation</p>
											<SubNavigation items={subNavigationItems} />
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-breadcrumb"
							>
								<SectionHeader
									title="Breadcrumb"
									description="Compressed location trail for deeper pages. Use it when the route hierarchy matters and users need a clear path back."
								/>
								<Card>
									<CardContent className="pt-6">
										<Breadcrumb>
											<BreadcrumbList>
												<BreadcrumbItem>
													<BreadcrumbLink to="/feed">Feed</BreadcrumbLink>
												</BreadcrumbItem>
												<BreadcrumbSeparator />
												<BreadcrumbItem>
													<BreadcrumbLink to="/groups">Groups</BreadcrumbLink>
												</BreadcrumbItem>
												<BreadcrumbSeparator />
												<BreadcrumbItem>
													<BreadcrumbCurrent>
														Neighborhood Organizers
													</BreadcrumbCurrent>
												</BreadcrumbItem>
											</BreadcrumbList>
										</Breadcrumb>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-navigation-list"
							>
								<SectionHeader
									title="Navigation List"
									description="Sectioned list pattern with headers and items. Each item can carry an icon or profile image in front, plus optional trailing metadata."
								/>
								<Card>
									<CardContent className="pt-6">
										<NavigationList sections={navigationListSections} />
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-identity-and-media"
							title="Identity And Media"
							description="Visual identity and image-led surfaces for people, groups, and major moments."
						>
							<section
								className="space-y-4"
								data-testid="style-guide-hero-image"
							>
								<SectionHeader
									title="Hero Image"
									description="Large image-led panel for landing moments, group intros, and future editorial sections. It should feel atmospheric without turning into generic marketing chrome."
								/>
								<HeroImage
									imageSrc={heroImage}
									imageAlt="Illustrated community scene"
									title="Give the people already involved a place that feels worth returning to."
									description="A hero surface should feel grounded and specific. It can set atmosphere, but it still needs to read like part of the product rather than a template."
								>
									<Button>Start a space</Button>
									<Button
										variant="outline"
										className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
									>
										Read more
									</Button>
								</HeroImage>
							</section>
							<section
								className="space-y-4"
								data-testid="style-guide-profile-image"
							>
								<SectionHeader
									title="Profile Image"
									description="Image-only profile surface for avatars, leading thumbnails, and compact identity markers. It should scale cleanly across navigation and content contexts."
								/>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-4 pt-6">
										<ProfileImage
											src={ainoImage}
											alt="Aino Moderator"
											fallback="AM"
											size="sm"
										/>
										<ProfileImage
											src={mikaImage}
											alt="Mika Member"
											fallback="MM"
											size="md"
										/>
										<ProfileImage
											src={saraImage}
											alt="Sara Admin"
											fallback="SA"
											size="lg"
										/>
										<ProfileImage
											alt="Fallback profile"
											fallback="OG"
											size="xl"
										/>
									</CardContent>
								</Card>
							</section>
							<section
								className="space-y-4"
								data-testid="style-guide-profile-listing"
							>
								<SectionHeader
									title="Profile Listing"
									description="Image-plus-name identity rows for member lists, search results, and participant pickers. This is the list-ready profile pattern."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<ProfileIdentity
											name="Aino Moderator"
											subtitle="Neighborhood planning lead"
											imageSrc={ainoImage}
											imageAlt="Aino Moderator"
											fallback="AM"
											size="lg"
										/>
										<ProfileIdentity
											name="Mika Member"
											subtitle="Community kitchen volunteer"
											imageSrc={mikaImage}
											imageAlt="Mika Member"
											fallback="MM"
										/>
										<ProfileIdentity
											name="Sara Admin"
											subtitle="Coordinates moderation and onboarding"
											imageSrc={saraImage}
											imageAlt="Sara Admin"
											fallback="SA"
											size="sm"
										/>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-profile-card"
							>
								<SectionHeader
									title="Profile Card"
									description="Small portrait-oriented user card with a 9:16 aspect ratio. Use it when a person needs to feel highlighted rather than just listed."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
										<ProfileCard
											name="Aino Moderator"
											imageSrc={ainoImage}
											imageAlt="Aino Moderator"
											description="Keeps projects moving and members informed."
										/>
										<ProfileCard
											name="Mika Member"
											imageSrc={mikaImage}
											imageAlt="Mika Member"
											description="Helps translate ideas into concrete group work."
										/>
										<ProfileCard
											name="Sara Admin"
											imageSrc={saraImage}
											imageAlt="Sara Admin"
											description="Supports trust, onboarding, and follow-through."
										/>
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-layouts"
							title="Layouts"
							description="Core page arrangements for centered feeds and media-plus-sidebar surfaces."
						>
							<section
								className="space-y-4"
								data-testid="style-guide-layout-centered"
							>
								<SectionHeader
									title="Centered Feed Layout"
									description="Default feed layout with a single centered content column. Use it for posts and other linear reading flows where sidebars would add noise."
								/>
								<Card>
									<CardContent className="pt-6">
										<CenteredLayout className="space-y-4">
											<Card>
												<CardContent className="space-y-3 pt-6">
													<PostHeading
														media={
															<ProfileImage
																src={ainoImage}
																alt="Aino Moderator"
																fallback="AM"
																size="sm"
															/>
														}
														title="Aino Moderator"
														subtitle="Centered feed example"
													/>
													<PostContent
														actions={[{ label: "Comment" }, { label: "Share" }]}
													>
														<p>
															A centered layout keeps the reading column stable
															and lets the content carry the page without extra
															side structure.
														</p>
													</PostContent>
												</CardContent>
											</Card>
											<Card>
												<CardContent className="pt-6">
													<p className="text-sm leading-7 text-muted-foreground">
														Additional feed cards stack in the same width,
														keeping the rhythm consistent down the page.
													</p>
												</CardContent>
											</Card>
										</CenteredLayout>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-layout-right-sidebar"
							>
								<SectionHeader
									title="Right Sidebar Layout"
									description="Wide content area with a narrower sidebar on the right. Use it for modal-like detail views such as large media on the left and comments on the right."
								/>
								<Card>
									<CardContent className="pt-6">
										<RightSidebarLayout>
											<LayoutMain>
												<div className="overflow-hidden rounded-lg border border-border bg-muted">
													<img
														src={heroImage}
														alt="Expanded media example"
														className="aspect-[4/3] w-full object-cover"
													/>
												</div>
											</LayoutMain>
											<LayoutSidebar className="space-y-3">
												<Card>
													<CardContent className="pt-6">
														<PostComments
															comments={sampleComments.slice(0, 2)}
														/>
													</CardContent>
												</Card>
											</LayoutSidebar>
										</RightSidebarLayout>
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<GuideGroup
							id="style-guide-group-posts-and-conversation"
							title="Posts And Conversation"
							description="Higher-level content patterns for posts, comments, and conversational feedback."
						>
							<section
								className="space-y-4"
								data-testid="style-guide-post-heading"
							>
								<SectionHeader
									title="Post Heading"
									description="Composed heading block for posts. It pairs media with a two-line heading stack so person posts and group posts can share the same layout grammar."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
										<div className="rounded-lg border border-border p-4">
											<PostHeading
												media={
													<ProfileImage
														src={ainoImage}
														alt="Aino Moderator"
														fallback="AM"
														size="md"
													/>
												}
												title={
													<span className="flex flex-wrap items-center gap-2">
														<span>Aino Moderator</span>
														<PostLabels moderationStatus="approved" />
													</span>
												}
												subtitle={new Date(
													"2026-03-14T08:30:00.000Z",
												).toLocaleString()}
											/>
										</div>
										<div className="rounded-lg border border-border p-4">
											<PostHeading
												media={
													<ProfileImage
														src={heroImage}
														alt="Neighborhood group"
														fallback="NG"
														size="md"
														className="rounded-md"
													/>
												}
												title={
													<span className="flex flex-wrap items-center gap-2">
														<span>Neighborhood Organizers</span>
														<PostLabels moderationStatus="flagged" isHidden />
													</span>
												}
												subtitle={`Posted by Sara Admin • ${new Date("2026-03-14T11:15:00.000Z").toLocaleString()}`}
											/>
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-composer"
							>
								<SectionHeader
									title="Post Composer"
									description="Composed input surface for creating new posts and writing replies. The large variant is for new content, while the compact variant keeps reply flows light."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<PostComposer variant="post">
											<PostComposerMedia>
												<ProfileImage
													src={ainoImage}
													alt="Aino Moderator"
													fallback="AM"
													size="md"
												/>
											</PostComposerMedia>
											<PostComposerBody>
												<PostComposerSurface>
													<PostComposerField defaultValue="We have enough volunteers for setup. What we still need is one person to document the route changes before Saturday." />
													<PostComposerFooter>
														<div className="flex flex-wrap items-center gap-1">
															<IconButton label="Add image" variant="ghost">
																<Icon name="imagePlus" size={16} />
															</IconButton>
														</div>
														<div className="flex flex-wrap items-center gap-1">
															<IconButton label="Publish post">
																<Icon name="sendHorizontal" size={16} />
															</IconButton>
														</div>
													</PostComposerFooter>
												</PostComposerSurface>
											</PostComposerBody>
										</PostComposer>

										<PostComposer variant="reply">
											<PostComposerMedia>
												<ProfileImage
													src={mikaImage}
													alt="Mika Member"
													fallback="MM"
													size="sm"
												/>
											</PostComposerMedia>
											<PostComposerBody>
												<PostComposerSurface>
													<PostComposerField placeholder="Add a reply to the thread" />
													<PostComposerFooter>
														<div className="flex items-center gap-1">
															<IconButton label="Add image" variant="ghost">
																<Icon name="imagePlus" size={16} />
															</IconButton>
														</div>
														<div className="flex items-center gap-1">
															<IconButton label="Reply">
																<Icon name="sendHorizontal" size={16} />
															</IconButton>
														</div>
													</PostComposerFooter>
												</PostComposerSurface>
											</PostComposerBody>
										</PostComposer>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-content"
							>
								<SectionHeader
									title="Post Content"
									description="Display-only content block for a post body and its metadata. This is the base visual unit for posts before route migrations begin."
								/>
								<Card>
									<CardContent className="space-y-6 pt-6">
										<div className="rounded-lg border border-border p-4">
											<PostHeading
												media={
													<ProfileImage
														src={ainoImage}
														alt="Aino Moderator"
														fallback="AM"
														size="md"
													/>
												}
												title={
													<span className="flex flex-wrap items-center gap-2">
														<span>Aino Moderator</span>
														<PostLabels moderationStatus="approved" />
													</span>
												}
												subtitle={new Date(
													"2026-03-14T08:30:00.000Z",
												).toLocaleString()}
											/>
											<PostContent
												className="mt-4"
												actions={[{ label: "Comment" }, { label: "Share" }]}
											>
												<PostRichTextContent document={richTextExample} />
											</PostContent>
										</div>
										<div className="rounded-lg border border-border p-4">
											<PostHeading
												media={
													<ProfileImage
														src={heroImage}
														alt="Neighborhood group"
														fallback="NG"
														size="md"
														className="rounded-md"
													/>
												}
												title={
													<span className="flex flex-wrap items-center gap-2">
														<span>Neighborhood Organizers</span>
														<PostLabels moderationStatus="flagged" isHidden />
													</span>
												}
												subtitle={`Posted by Sara Admin • ${new Date("2026-03-14T08:42:00.000Z").toLocaleString()}`}
											/>
											<PostContent
												className="mt-4"
												actions={[{ label: "Comment" }, { label: "Share" }]}
											>
												<PostRichTextContent document={richTextExample} />
											</PostContent>
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-rich-text-content"
							>
								<SectionHeader
									title="Rich Text Content"
									description="Structured rich text format intended for storage. It keeps content explicit as blocks and inline nodes, so internal and external links stay typed instead of being stored as raw HTML."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
										<div className="space-y-3 rounded-lg border border-border p-4">
											<h3 className="text-base font-semibold tracking-tight">
												Document model
											</h3>
											<pre className="overflow-x-auto rounded-md bg-muted/60 p-4 text-xs leading-6 text-muted-foreground">
												<code>{JSON.stringify(richTextExample, null, 2)}</code>
											</pre>
										</div>
										<div className="space-y-3 rounded-lg border border-border p-4">
											<h3 className="text-base font-semibold tracking-tight">
												Rendered output
											</h3>
											<RichTextContent document={richTextExample} />
										</div>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-image-content"
							>
								<SectionHeader
									title="Single Image Content"
									description="Single-image post content for one strong visual. Use it when the image itself is the focus rather than part of a larger gallery."
								/>
								<Card>
									<CardContent className="pt-6">
										<PostImageContent
											src={marketImage}
											alt="Saturday market setup"
											caption="A single-image post should stay simple and calm, with the image carrying most of the meaning."
										/>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-image-gallery-content"
							>
								<SectionHeader
									title="Image Gallery Content"
									description="Two-to-five image grid for post galleries. If there are more than five images, the last tile becomes a dimmed overflow action for the fuller gallery view."
								/>
								<Card>
									<CardContent className="space-y-6 pt-6">
										<PostImageGalleryContent
											images={[
												{ src: marketImage, alt: "Saturday market" },
												{ src: gardenImage, alt: "Garden workday" },
												{ src: routeImage, alt: "Route update board" },
											]}
										/>
										<PostImageGalleryContent
											images={[
												{ src: marketImage, alt: "Saturday market" },
												{ src: gardenImage, alt: "Garden workday" },
												{ src: routeImage, alt: "Route update board" },
												{ src: kitchenImage, alt: "Open kitchen" },
												{ src: workshopImage, alt: "Repair workshop" },
												{ src: archiveImage, alt: "Archive notes" },
											]}
										/>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-video-content"
							>
								<SectionHeader
									title="Video Content"
									description="Video post block for recorded updates, walkthroughs, and event clips. It can render a playable video when a source exists or a poster-based preview when only metadata is available."
								/>
								<Card>
									<CardContent className="pt-6">
										<PostVideoContent
											posterSrc={routeImage}
											title="Street access update walkthrough"
											duration="02:48"
										/>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-link-content"
							>
								<SectionHeader
									title="Link Content"
									description="Link preview block for internal or external references. Use it when the link itself is the object being shared rather than a small inline reference in rich text."
								/>
								<Card>
									<CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
										<PostLinkContent
											target={{ type: "post", postId: "post-42" }}
											title="Saturday route update"
											description="Internal post preview that can jump directly into the feed thread."
											imageSrc={routeImage}
										/>
										<PostLinkContent
											target={{
												type: "external",
												href: "https://developer.mozilla.org/en-US/docs/Web/API/Popover_API",
											}}
											title="MDN Popover API"
											description="External reference preview with a clear destination and supporting image."
											imageSrc={archiveImage}
										/>
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-chat-bubble"
							>
								<SectionHeader
									title="Chat Bubble"
									description="Comment pattern with profile image, a message bubble, and lightweight text actions under the content. This is the shared composition for replies, thread actions, and future chat-like surfaces."
								/>
								<Card>
									<CardContent className="space-y-4 pt-6">
										<PostComments comments={sampleComments.slice(0, 1)} />
									</CardContent>
								</Card>
							</section>

							<section
								className="space-y-4"
								data-testid="style-guide-post-comments"
							>
								<SectionHeader
									title="Post Comments"
									description="Threaded comment model for the shared component API, including lightweight actions like reply and share under each comment. The current backend is flatter, but the style guide defines a recursive presentation shape now."
								/>
								<Card>
									<CardContent className="space-y-5 pt-6">
										<div className="rounded-lg border border-border p-4">
											<PostContent createdAt="2026-03-14T09:30:00.000Z">
												<p>
													What should a reliable comment thread feel like when a
													real community starts using it daily?
												</p>
											</PostContent>
										</div>
										<PostComments comments={sampleComments} />
									</CardContent>
								</Card>
							</section>
						</GuideGroup>

						<section
							className="space-y-4"
							data-testid="style-guide-coming-next"
						>
							<SectionHeader
								title="Coming Next"
								description="Additional shared building blocks that surfaced while expanding the first guide page."
							/>
							<Card>
								<CardContent className="pt-6">
									<ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
										<li className="rounded-lg border border-dashed border-border p-4">
											Field wrappers with labels, help text, and validation
											messaging.
										</li>
										<li className="rounded-lg border border-dashed border-border p-4">
											Composer patterns for post creation and reply actions.
										</li>
										<li className="rounded-lg border border-dashed border-border p-4">
											Gallery, media grid, and richer image grouping patterns.
										</li>
										<li className="rounded-lg border border-dashed border-border p-4">
											Empty-state, section-heading, and inline feedback
											patterns.
										</li>
										<li className="rounded-lg border border-dashed border-border p-4">
											State-aware profile actions like follow, invite, and
											message.
										</li>
									</ul>
								</CardContent>
							</Card>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
