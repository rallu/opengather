import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Toast } from "~/components/ui/toast";
import { SectionHeader } from "./layout";

export function FormsFeedbackSection() {
	return (
		<>
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
										Use dialog when the task should temporarily take over the
										interface, such as inviting people or confirming a
										destructive action.
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
									This pattern stays lighter than dialog and should not carry
									full workflows.
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
		</>
	);
}
