import { PostComments } from "~/components/post/post-comments";
import { PostContent } from "~/components/post/post-content";
import { PostImageContent } from "~/components/post/post-image-content";
import { PostImageGalleryContent } from "~/components/post/post-image-gallery-content";
import { PostLinkContent } from "~/components/post/post-link-content";
import { PostVideoContent } from "~/components/post/post-video-content";
import { Card, CardContent } from "~/components/ui/card";
import {
	archiveImage,
	gardenImage,
	kitchenImage,
	marketImage,
	routeImage,
	sampleComments,
	workshopImage,
} from "./data";
import { SectionHeader } from "./layout";

export function PostsMediaSection() {
	return (
		<>
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
			<section className="space-y-4" data-testid="style-guide-chat-bubble">
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
			<section className="space-y-4" data-testid="style-guide-post-comments">
				<SectionHeader
					title="Post Comments"
					description="Threaded comment model for the shared component API, including lightweight actions like reply and share under each comment. The current backend is flatter, but the style guide defines a recursive presentation shape now."
				/>
				<Card>
					<CardContent className="space-y-5 pt-6">
						<div className="rounded-lg border border-border p-4">
							<PostContent createdAt="2026-03-14T09:30:00.000Z">
								<p>
									What should a reliable comment thread feel like when a real
									community starts using it daily?
								</p>
							</PostContent>
						</div>
						<PostComments comments={sampleComments} />
					</CardContent>
				</Card>
			</section>
		</>
	);
}
