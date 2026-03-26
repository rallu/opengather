import type { PostCommentData } from "~/components/post/post-comments";
import { ProfileImage } from "~/components/profile/profile-image";
import { Icon } from "~/components/ui/icon";
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
			<text x="320" y="900" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" letter-spacing="8">${params.label}</text>
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
			<text x="120" y="980" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="white" letter-spacing="4">${params.label}</text>
		</svg>
	`;

	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const heroImage = createHeroArt();
export const ainoImage = createProfileArt({
	backgroundStart: "#1d4ed8",
	backgroundEnd: "#0f172a",
	accent: "#93c5fd",
	label: "AINO",
});
export const mikaImage = createProfileArt({
	backgroundStart: "#7c3aed",
	backgroundEnd: "#1f2937",
	accent: "#c4b5fd",
	label: "MIKA",
});
export const saraImage = createProfileArt({
	backgroundStart: "#0f766e",
	backgroundEnd: "#134e4a",
	accent: "#99f6e4",
	label: "SARA",
});
export const marketImage = createPostMediaArt({
	backgroundStart: "#234B47",
	backgroundEnd: "#0f172a",
	accent: "#8ed1c7",
	label: "SATURDAY MARKET",
});
export const gardenImage = createPostMediaArt({
	backgroundStart: "#365314",
	backgroundEnd: "#1f2937",
	accent: "#bef264",
	label: "COMMUNITY GARDEN",
});
export const routeImage = createPostMediaArt({
	backgroundStart: "#1d4ed8",
	backgroundEnd: "#172554",
	accent: "#93c5fd",
	label: "ROUTE UPDATE",
});
export const kitchenImage = createPostMediaArt({
	backgroundStart: "#7c2d12",
	backgroundEnd: "#1f2937",
	accent: "#fdba74",
	label: "OPEN KITCHEN",
});
export const workshopImage = createPostMediaArt({
	backgroundStart: "#7c3aed",
	backgroundEnd: "#312e81",
	accent: "#c4b5fd",
	label: "REPAIR WORKSHOP",
});
export const archiveImage = createPostMediaArt({
	backgroundStart: "#334155",
	backgroundEnd: "#0f172a",
	accent: "#cbd5e1",
	label: "ARCHIVE NOTES",
});

export const sampleComments: PostCommentData[] = [
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

export const navigationItems = [
	{ label: "Feed", to: "/feed", active: true },
	{ label: "Groups", to: "/groups" },
	{ label: "Notifications", to: "/notifications" },
	{ label: "Profile", to: "/profiles/me" },
];
export const subNavigationItems = [
	{ label: "Overview", to: "/profile", active: true },
	{ label: "Members", to: "/profile" },
	{ label: "Posts", to: "/profile" },
	{ label: "Files", to: "/profile" },
];
export const navigationListSections = [
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

export const richTextExample: RichTextDocument = {
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
				{ type: "text", text: ", jump to " },
				{
					type: "link",
					text: "a feed post",
					target: { type: "post", postId: "post-42" },
				},
				{ type: "text", text: ", or open " },
				{
					type: "link",
					text: "an external reference",
					target: {
						type: "external",
						href: "https://developer.mozilla.org/en-US/docs/Web/API/Popover_API",
					},
				},
				{ type: "text", text: "." },
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

export const styleGuideGroups = [
	{
		title: "Design Tokens",
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
		items: [
			{ id: "style-guide-button", title: "Button" },
			{ id: "style-guide-button-group", title: "Button Group" },
			{ id: "style-guide-icon", title: "Icon" },
			{ id: "style-guide-icon-button", title: "Icon Button" },
			{ id: "style-guide-badge", title: "Badge" },
			{ id: "style-guide-container", title: "Container" },
			{ id: "style-guide-card", title: "Card" },
			{ id: "style-guide-elevation", title: "Elevation" },
		],
	},
	{
		title: "Forms And Actions",
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
		items: [
			{ id: "style-guide-navigation", title: "Navigation" },
			{ id: "style-guide-breadcrumb", title: "Breadcrumb" },
			{ id: "style-guide-context-bar", title: "Context Bar" },
			{ id: "style-guide-navigation-list", title: "Navigation List" },
		],
	},
	{
		title: "Identity And Media",
		items: [
			{ id: "style-guide-hero-image", title: "Hero Image" },
			{ id: "style-guide-profile-image", title: "Profile Image" },
			{ id: "style-guide-profile-listing", title: "Profile Listing" },
			{ id: "style-guide-profile-card", title: "Profile Card" },
		],
	},
	{
		title: "Layouts",
		items: [
			{ id: "style-guide-layout-centered", title: "Centered Feed Layout" },
			{ id: "style-guide-layout-right-sidebar", title: "Right Sidebar Layout" },
		],
	},
	{
		title: "Posts And Conversation",
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
