import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { styleGuideGroups } from "./data";
import { DesignTokensSection } from "./design-tokens-section";
import { FormsControlsSection } from "./forms-controls-section";
import { FormsFeedbackSection } from "./forms-feedback-section";
import { FoundationsSection } from "./foundations-section";
import { IdentityAndMediaSection } from "./identity-and-media-section";
import { LayoutsSection } from "./layouts-section";
import { NavigationSection } from "./navigation-section";
import { PostsFoundationsSection } from "./posts-foundations-section";
import { PostsMediaSection } from "./posts-media-section";
import { GuideGroup, SectionHeader } from "./layout";

export function StyleGuidePage() {
	return (
		<div className="min-h-screen bg-background" data-testid="style-guide-full-layout">
			<header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
				<div className="flex w-full items-center justify-between gap-4 px-6 py-4 lg:px-8">
					<div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Style Guide - OpenGather</h1></div>
					<Button asChild variant="outline"><Link to="/feed">Back to feed</Link></Button>
				</div>
			</header>
			<div className="space-y-10 px-6 py-8 lg:px-8" data-testid="style-guide-page">
				<div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
					<aside className="hidden lg:block">
						<div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto pr-3" data-testid="style-guide-side-nav">
							<nav className="space-y-5">
								{styleGuideGroups.map((group) => (
									<div key={group.title} className="space-y-2">
										<a href={`#style-guide-group-${group.title.toLowerCase().replaceAll(" ", "-")}`} className="block text-sm font-medium text-foreground transition-colors hover:text-primary">{group.title}</a>
										<div className="space-y-1">
											{group.items.map((item) => <a key={item.id} href={`#${item.id}`} className="block text-sm text-muted-foreground transition-colors hover:text-foreground">{item.title}</a>)}
										</div>
									</div>
								))}
							</nav>
						</div>
					</aside>
					<div className="space-y-10">
						<DesignTokensSection />
						<FoundationsSection />
						<GuideGroup id="style-guide-group-forms-and-actions" title="Forms And Actions" description="Form controls, menus, and compact feedback patterns used while interacting with the product.">
							<FormsControlsSection />
							<FormsFeedbackSection />
						</GuideGroup>
						<NavigationSection />
						<IdentityAndMediaSection />
						<LayoutsSection />
						<GuideGroup id="style-guide-group-posts-and-conversation" title="Posts And Conversation" description="Higher-level content patterns for posts, comments, and conversational feedback.">
							<PostsFoundationsSection />
							<PostsMediaSection />
						</GuideGroup>
						<section className="space-y-4" data-testid="style-guide-coming-next">
							<SectionHeader title="Coming Next" description="Additional shared building blocks that surfaced while expanding the first guide page." />
							<Card><CardContent className="pt-6"><ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2"><li className="rounded-lg border border-dashed border-border p-4">Field wrappers with labels, help text, and validation messaging.</li><li className="rounded-lg border border-dashed border-border p-4">Composer patterns for post creation and reply actions.</li><li className="rounded-lg border border-dashed border-border p-4">Gallery, media grid, and richer image grouping patterns.</li><li className="rounded-lg border border-dashed border-border p-4">Empty-state, section-heading, and inline feedback patterns.</li><li className="rounded-lg border border-dashed border-border p-4">State-aware profile actions like follow, invite, and message.</li></ul></CardContent></Card>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
