import { PostComments } from "~/components/post/post-comments";
import { PostContent } from "~/components/post/post-content";
import { PostHeading } from "~/components/post/post-heading";
import { ProfileImage } from "~/components/profile/profile-image";
import { Card, CardContent } from "~/components/ui/card";
import { CenteredLayout, LayoutMain, LayoutSidebar, RightSidebarLayout } from "~/components/ui/layouts";
import { ainoImage, heroImage, sampleComments } from "./data";
import { GuideGroup, SectionHeader } from "./layout";

export function LayoutsSection() {
	return (
		<GuideGroup id="style-guide-group-layouts" title="Layouts" description="Core page arrangements for centered feeds and media-plus-sidebar surfaces.">
			<section className="space-y-4" data-testid="style-guide-layout-centered"><SectionHeader title="Centered Feed Layout" description="Default feed layout with a single centered content column. Use it for posts and other linear reading flows where sidebars would add noise." /><Card><CardContent className="pt-6"><CenteredLayout className="space-y-4"><Card><CardContent className="space-y-3 pt-6"><PostHeading media={<ProfileImage src={ainoImage} alt="Aino Moderator" fallback="AM" size="sm" />} title="Aino Moderator" subtitle="Centered feed example" /><PostContent actions={[{ label: "Comment" }, { label: "Share" }]}><p>A centered layout keeps the reading column stable and lets the content carry the page without extra side structure.</p></PostContent></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm leading-7 text-muted-foreground">Additional feed cards stack in the same width, keeping the rhythm consistent down the page.</p></CardContent></Card></CenteredLayout></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-layout-right-sidebar"><SectionHeader title="Right Sidebar Layout" description="Wide content area with a narrower sidebar on the right. Use it for modal-like detail views such as large media on the left and comments on the right." /><Card><CardContent className="pt-6"><RightSidebarLayout><LayoutMain><div className="overflow-hidden rounded-lg border border-border bg-muted"><img src={heroImage} alt="Expanded media example" className="aspect-[4/3] w-full object-cover" /></div></LayoutMain><LayoutSidebar className="space-y-3"><Card><CardContent className="pt-6"><PostComments comments={sampleComments.slice(0, 2)} /></CardContent></Card></LayoutSidebar></RightSidebarLayout></CardContent></Card></section>
		</GuideGroup>
	);
}
