import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { Textarea } from "~/components/ui/textarea";
import { ainoImage } from "./data";
import { SectionHeader } from "./layout";

export function FormsControlsSection() {
	return (
		<>
			<section
				className="space-y-4"
				id="style-guide-input"
				data-testid="style-guide-input"
			>
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
							<Label htmlFor="style-guide-input-prefix">Prefix icon</Label>
							<Input
								id="style-guide-input-prefix"
								placeholder="Search communities"
								leadingAccessory={<Icon name="search" size={16} />}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="style-guide-input-suffix">Suffix button</Label>
							<Input
								id="style-guide-input-suffix"
								placeholder="Invite by email"
								trailingAccessory={
									<Button size="sm" variant="ghost" className="h-7 px-2">
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
								leadingAccessory={<Icon name="messageSquare" size={16} />}
							/>
						</div>
					</CardContent>
				</Card>
			</section>
			<section
				className="space-y-4"
				id="style-guide-checkbox"
				data-testid="style-guide-checkbox"
			>
				<SectionHeader
					title="Checkbox"
					description="Binary selection control for preference matrices, consent flows, and lightweight settings. Use the shared component instead of browser-default checkboxes so checked, disabled, and focus states stay consistent."
				/>
				<Card>
					<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
						<Checkbox
							defaultChecked
							label="Push notifications"
							description="Receive mentions and replies in the browser on subscribed devices."
						/>
						<Checkbox
							label="Webhook delivery"
							description="Forward notification payloads to an external automation endpoint."
						/>
						<Checkbox
							disabled
							label="Email delivery"
							description="Reserved for a future email sender integration."
						/>
						<div className="space-y-2">
							<Label htmlFor="style-guide-checkbox-matrix">
								Matrix cell treatment
							</Label>
							<div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
								<span className="text-sm text-muted-foreground">
									Mentions via push
								</span>
								<Checkbox
									id="style-guide-checkbox-matrix"
									defaultChecked
									aria-label="Mentions via push"
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			</section>
			<section
				className="space-y-4"
				id="style-guide-label"
				data-testid="style-guide-label"
			>
				<SectionHeader
					title="Label"
					description="Form field label primitive. Keep it quiet, readable, and consistent instead of redefining label styling in each route."
				/>
				<Card>
					<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="style-guide-label-example">Community name</Label>
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
			<section
				className="space-y-4"
				id="style-guide-textarea"
				data-testid="style-guide-textarea"
			>
				<SectionHeader
					title="Textarea"
					description="Multi-line field for posting, setup descriptions, and longer settings content. Use for composition surfaces that need clear vertical rhythm."
				/>
				<Card>
					<CardContent className="grid gap-4 pt-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="style-guide-textarea-default">Default</Label>
							<Textarea
								id="style-guide-textarea-default"
								defaultValue="OpenGather lets a community shape the interface without rewriting the product."
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="style-guide-textarea-disabled">Disabled</Label>
							<Textarea
								id="style-guide-textarea-disabled"
								defaultValue="This content is read-only in this state."
								disabled
							/>
						</div>
					</CardContent>
				</Card>
			</section>
			<section
				className="space-y-4"
				id="style-guide-selector"
				data-testid="style-guide-selector"
			>
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
											<SelectorItemTitle>Aino Moderator</SelectorItemTitle>
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
		</>
	);
}
