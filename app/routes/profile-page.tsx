import { Form, Link } from "react-router";
import { AppShell } from "~/components/app-shell";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Icon } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { ProfileNotificationSection } from "./profile-notification-section";
import type { ProfileActionData, ProfilePageData } from "./profile-page.shared";

function getImageSourceText(
	imageSource: Extract<ProfilePageData, { status: "ok" }>["imageSource"],
) {
	return imageSource === "local_upload"
		? "Using an uploaded image stored on this instance."
		: imageSource === "local_url"
			? "Using an image override saved on this instance."
			: imageSource === "hub"
				? "Using the image from the linked hub account until you upload a local override."
				: imageSource === "generated_default"
					? "Using a default profile image selected for your account."
					: imageSource === "default"
						? "Using your current account image."
						: "No profile image is currently set.";
}

function GuestProfilePage() {
	return (
		<AppShell authUser={null} title="Profile">
			<section className="space-y-3 rounded-md border border-border p-4">
				<p className="text-sm text-muted-foreground">
					Sign in to manage your profile settings.
				</p>
				<div className="flex gap-3">
					<Button asChild>
						<Link to="/login">Sign In</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to="/register">Register</Link>
					</Button>
				</div>
			</section>
		</AppShell>
	);
}

function NotSetupProfilePage(params: {
	data: Extract<ProfilePageData, { status: "not_setup" }>;
}) {
	return (
		<AppShell
			authUser={params.data.authUser}
			title="Profile"
			showServerSettings={false}
		>
			<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				Server setup is not completed yet.
			</div>
		</AppShell>
	);
}

function ProfileErrorPage() {
	return (
		<AppShell authUser={null} title="Profile">
			<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				Failed to load profile settings.
			</div>
		</AppShell>
	);
}

function ProfileImageSection(params: {
	actionData: ProfileActionData;
	data: Extract<ProfilePageData, { status: "ok" }>;
	fallback: string;
}) {
	const { actionData, data, fallback } = params;

	return (
		<section className="rounded-md border border-border p-4 text-sm">
			<div className="flex items-center gap-3">
				<Dialog>
					<div className="relative">
						<ProfileImage
							src={data.image ?? undefined}
							alt={`${data.name} profile image`}
							fallback={fallback}
							size="lg"
						/>
						<DialogTrigger
							className="absolute -right-1 -top-1 h-8 w-8 rounded-full border border-border bg-background p-0 shadow-sm"
							data-testid="profile-image-dialog-trigger"
							aria-label="Change profile image"
						>
							<Icon name="imagePlus" size={16} />
						</DialogTrigger>
					</div>
					<DialogContent data-testid="profile-image-dialog">
						<DialogHeader>
							<DialogTitle>Change image</DialogTitle>
							<DialogDescription>
								{getImageSourceText(data.imageSource)}
							</DialogDescription>
						</DialogHeader>
						<DialogBody>
							<div className="flex items-start gap-4">
								<ProfileImage
									src={data.image ?? undefined}
									alt={`${data.name} profile image`}
									fallback={fallback}
									size="lg"
								/>
								<div className="min-w-0 flex-1 space-y-3">
									{actionData?.section === "image" && actionData.ok ? (
										<p
											className="text-sm text-emerald-700"
											data-testid="profile-image-save-success"
										>
											Saved.
										</p>
									) : null}
									{actionData?.section === "image" &&
									actionData.ok === false ? (
										<p
											className="text-sm text-destructive"
											data-testid="profile-image-save-error"
										>
											{actionData.error}
										</p>
									) : null}
									<Form
										method="post"
										encType="multipart/form-data"
										className="space-y-3"
									>
										<input
											type="hidden"
											name="_action"
											value="upload-profile-image"
										/>
										<input
											type="file"
											name="imageFile"
											accept="image/avif,image/jpeg,image/png,image/webp"
											data-testid="profile-image-upload-input"
											className="block w-full text-sm"
										/>
										<Button
											type="submit"
											variant="outline"
											data-testid="profile-image-upload-button"
										>
											Upload image
										</Button>
									</Form>
									<Form method="post">
										<input
											type="hidden"
											name="_action"
											value="clear-profile-image-override"
										/>
										<Button
											type="submit"
											variant="outline"
											data-testid="profile-image-clear-button"
										>
											Clear image
										</Button>
									</Form>
								</div>
							</div>
						</DialogBody>
					</DialogContent>
				</Dialog>
				<div className="min-w-0 space-y-1">
					<p className="truncate font-medium">{data.name}</p>
					<p className="text-muted-foreground">
						{data.viewerRole} • {data.instanceName}
					</p>
				</div>
			</div>
			{data.summary ? <p className="mt-3 text-sm">{data.summary}</p> : null}
			<p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
				Profile visibility: {data.profileVisibility}
			</p>
		</section>
	);
}

function ProfilePrivacySection(params: {
	actionData: ProfileActionData;
	data: Extract<ProfilePageData, { status: "ok" }>;
}) {
	const { actionData, data } = params;

	return (
		<section className="space-y-3 rounded-md border border-border p-4">
			<h2 className="text-base font-semibold">Profile privacy</h2>
			{actionData?.section === "profile" ? (
				<p
					className="text-sm text-emerald-700"
					data-testid="settings-profile-saved"
				>
					Saved.
				</p>
			) : null}
			<Form method="post" className="space-y-3">
				<input type="hidden" name="_action" value="save-profile-visibility" />
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="profile-visibility">
						Who can view your profile activity
					</label>
					{data.profileVisibility !== "public" &&
					data.profileVisibilityOptions.every(
						(option) => option.value !== "public",
					) ? (
						<p className="text-sm text-muted-foreground">
							Public profiles are unavailable because this instance is not
							public.
						</p>
					) : null}
					<select
						id="profile-visibility"
						name="profileVisibility"
						defaultValue={data.profileVisibility}
						data-testid="settings-profile-visibility"
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{data.profileVisibilityOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<Button
					type="submit"
					variant="outline"
					data-testid="settings-profile-save"
				>
					Save profile privacy
				</Button>
			</Form>
		</section>
	);
}

export function ProfilePageView(params: {
	actionData: ProfileActionData;
	data: ProfilePageData;
}) {
	const { actionData, data } = params;

	if (data.status === "unauthenticated") {
		return <GuestProfilePage />;
	}

	if (data.status === "not_setup") {
		return <NotSetupProfilePage data={data} />;
	}

	if (data.status === "error") {
		return <ProfileErrorPage />;
	}

	const fallback = data.name.trim().slice(0, 1).toUpperCase() || "?";

	return (
		<AppShell
			authUser={data.authUser}
			title="Profile"
			showServerSettings={data.viewerRole === "admin"}
		>
			<ProfileImageSection
				actionData={actionData}
				data={data}
				fallback={fallback}
			/>

			<section className="space-y-3 rounded-md border border-border p-4">
				<div className="space-y-2 text-sm">
					<p>
						<span className="text-muted-foreground">Name:</span> {data.name}
					</p>
					<p>
						<span className="text-muted-foreground">Email:</span> {data.email}
					</p>
					<p>
						<span className="text-muted-foreground">Current role:</span>{" "}
						{data.viewerRole}
					</p>
				</div>
			</section>

			<section className="space-y-3 rounded-md border border-border p-4">
				<div className="flex flex-wrap gap-3">
					<Button variant="outline" asChild>
						<Link to={data.publicProfilePath}>Open public profile</Link>
					</Button>
					{data.viewerRole === "admin" ? (
						<>
							<Button variant="outline" asChild>
								<Link to="/server-settings">Server Settings</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/audit-logs">Audit Logs</Link>
							</Button>
						</>
					) : null}
				</div>
			</section>

			<section className="rounded-md border border-border p-4">
				<h2 className="text-base font-semibold">Profile details</h2>
				{actionData?.section === "details" && actionData.ok ? (
					<p
						className="mt-3 text-sm text-emerald-700"
						data-testid="profile-save-success"
					>
						Saved.
					</p>
				) : null}
				{actionData?.section === "details" && actionData.ok === false ? (
					<p
						className="mt-3 text-sm text-destructive"
						data-testid="profile-save-error"
					>
						{actionData.error}
					</p>
				) : null}
				<Form method="post" className="mt-3 space-y-3">
					<input type="hidden" name="_action" value="save-profile-details" />
					<Input
						name="name"
						defaultValue={data.name}
						maxLength={80}
						placeholder="Name"
						data-testid="profile-name-input"
					/>
					<Textarea
						name="summary"
						defaultValue={data.summary ?? ""}
						maxLength={300}
						placeholder="Short description (max 300 characters)"
						data-testid="profile-summary-input"
					/>
					<Button
						type="submit"
						variant="outline"
						data-testid="profile-save-button"
					>
						Save profile details
					</Button>
				</Form>
			</section>

			<ProfilePrivacySection actionData={actionData} data={data} />
			<ProfileNotificationSection actionData={actionData} data={data} />
		</AppShell>
	);
}
