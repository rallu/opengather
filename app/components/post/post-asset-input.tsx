import * as React from "react";

import { PostAlbumPicker } from "~/components/post/post-album-picker";
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
import { Icon } from "~/components/ui/icon";
import { IconButton } from "~/components/ui/icon-button";
import { cn } from "~/lib/utils";

type PostAssetInputProps = {
	name?: string;
	albumFieldName?: string;
	previousAlbums?: string[];
	inputTestId?: string;
	albumInputTestId?: string;
	imageInputTestId?: string;
	videoInputTestId?: string;
	imageButtonTestId?: string;
	videoButtonTestId?: string;
	resetKey?: string | number | null;
};

type FileSelection = {
	imageFiles: string[];
	videoFiles: string[];
};

function summarizeSelection(selection: FileSelection) {
	if (selection.videoFiles.length > 0) {
		return selection.videoFiles[0];
	}

	if (selection.imageFiles.length === 0) {
		return null;
	}

	if (selection.imageFiles.length === 1) {
		return selection.imageFiles[0];
	}

	return `${selection.imageFiles.length} images ready`;
}

export function PostAssetInput({
	name = "assets",
	albumFieldName = "assetAlbums",
	previousAlbums = [],
	inputTestId,
	albumInputTestId,
	imageInputTestId,
	videoInputTestId,
	imageButtonTestId,
	videoButtonTestId,
	resetKey,
}: PostAssetInputProps) {
	const imageInputRef = React.useRef<HTMLInputElement>(null);
	const videoInputRef = React.useRef<HTMLInputElement>(null);
	const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
	const [videoDialogOpen, setVideoDialogOpen] = React.useState(false);
	const [albumPickerResetKey, setAlbumPickerResetKey] = React.useState(0);
	const [selection, setSelection] = React.useState<FileSelection>({
		imageFiles: [],
		videoFiles: [],
	});
	const [selectedAlbums, setSelectedAlbums] = React.useState<string[]>([]);
	const summary = summarizeSelection(selection);
	const resolvedImageInputTestId = imageInputTestId ?? inputTestId;

	React.useEffect(() => {
		if (resetKey === undefined) {
			return;
		}

		setImageDialogOpen(false);
		setVideoDialogOpen(false);
		setSelection({
			imageFiles: [],
			videoFiles: [],
		});
		setSelectedAlbums([]);
		setAlbumPickerResetKey((value) => value + 1);
		if (imageInputRef.current) {
			imageInputRef.current.value = "";
		}
		if (videoInputRef.current) {
			videoInputRef.current.value = "";
		}
	}, [resetKey]);

	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			<input
				type="hidden"
				name={albumFieldName}
				value={selectedAlbums.join(", ")}
			/>

			<Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
				<DialogTrigger
					asChild
					className="border-border bg-background text-foreground hover:bg-accent"
					data-testid={imageButtonTestId}
				>
					<IconButton
						type="button"
						label="Add images"
						className={cn(
							"h-8 w-8 rounded-full border border-border bg-background text-foreground hover:bg-accent",
							selection.imageFiles.length > 0 && "border-primary text-primary",
						)}
					>
						<Icon name="imagePlus" />
					</IconButton>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add images</DialogTitle>
						<DialogDescription>
							Choose up to 10 images for one post. Selecting images clears any
							video already attached.
						</DialogDescription>
					</DialogHeader>
					<DialogBody>
						<input
							ref={imageInputRef}
							id={`${name}-images`}
							name={name}
							type="file"
							accept="image/*"
							multiple
							data-testid={resolvedImageInputTestId}
							onChange={(event) => {
								const imageFiles = Array.from(
									event.currentTarget.files ?? [],
								).map((file) => file.name);
								setSelection({
									imageFiles,
									videoFiles: [],
								});
								if (videoInputRef.current) {
									videoInputRef.current.value = "";
								}
								setImageDialogOpen(false);
							}}
							className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium"
						/>
						<p className="text-xs leading-5 text-muted-foreground">
							Images are limited to 10 MB each.
						</p>
						<PostAlbumPicker
							key={albumPickerResetKey}
							previousAlbums={previousAlbums}
							selectedAlbums={selectedAlbums}
							inputTestId={albumInputTestId}
							onSelectedAlbumsChange={setSelectedAlbums}
						/>
						{selection.imageFiles.length > 0 ? (
							<p className="text-xs leading-5 text-muted-foreground">
								{selection.imageFiles.join(", ")}
							</p>
						) : null}
					</DialogBody>
					<DialogFooter>
						<DialogClose>Done</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
				<DialogTrigger
					asChild
					className="border-border bg-background text-foreground hover:bg-accent"
					data-testid={videoButtonTestId}
				>
					<IconButton
						type="button"
						label="Add video"
						className={cn(
							"h-8 w-8 rounded-full border border-border bg-background text-foreground hover:bg-accent",
							selection.videoFiles.length > 0 && "border-primary text-primary",
						)}
					>
						<Icon name="video" />
					</IconButton>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add a video</DialogTitle>
						<DialogDescription>
							Choose one video up to 100 MB and 60 seconds. Selecting a video
							clears any images already attached.
						</DialogDescription>
					</DialogHeader>
					<DialogBody>
						<input
							ref={videoInputRef}
							id={`${name}-video`}
							name={name}
							type="file"
							accept="video/*"
							data-testid={videoInputTestId}
							onChange={(event) => {
								const videoFiles = Array.from(
									event.currentTarget.files ?? [],
								).map((file) => file.name);
								setSelection({
									imageFiles: [],
									videoFiles,
								});
								setSelectedAlbums([]);
								setAlbumPickerResetKey((value) => value + 1);
								if (imageInputRef.current) {
									imageInputRef.current.value = "";
								}
								setVideoDialogOpen(false);
							}}
							className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium"
						/>
						<p className="text-xs leading-5 text-muted-foreground">
							Videos are limited to 100 MB and 60 seconds.
						</p>
						{selection.videoFiles.length > 0 ? (
							<p className="text-xs leading-5 text-muted-foreground">
								{selection.videoFiles[0]}
							</p>
						) : null}
					</DialogBody>
					<DialogFooter>
						<DialogClose>Done</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{summary ? (
				<span className="truncate text-xs leading-5 text-muted-foreground">
					{summary}
				</span>
			) : null}
		</div>
	);
}
