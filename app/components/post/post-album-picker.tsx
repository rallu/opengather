import * as React from "react";

import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

type PostAlbumPickerProps = {
	previousAlbums: string[];
	selectedAlbums: string[];
	inputTestId?: string;
	onSelectedAlbumsChange: (albums: string[]) => void;
};

function normalizeAlbumName(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function hasAlbum(albums: string[], candidate: string): boolean {
	const normalizedCandidate = candidate.toLowerCase();
	return albums.some(
		(albumName) => albumName.toLowerCase() === normalizedCandidate,
	);
}

function addAlbum(albums: string[], candidate: string): string[] {
	const normalizedCandidate = normalizeAlbumName(candidate);
	if (!normalizedCandidate || hasAlbum(albums, normalizedCandidate)) {
		return albums;
	}

	return [...albums, normalizedCandidate];
}

export function PostAlbumPicker({
	previousAlbums,
	selectedAlbums,
	inputTestId,
	onSelectedAlbumsChange,
}: PostAlbumPickerProps) {
	const inputId = React.useId();
	const [draftValue, setDraftValue] = React.useState("");

	const availablePreviousAlbums = previousAlbums.filter(
		(albumName) => !hasAlbum(selectedAlbums, albumName),
	);

	function commitDraftValue() {
		const nextAlbums = addAlbum(selectedAlbums, draftValue);
		if (nextAlbums === selectedAlbums) {
			setDraftValue(normalizeAlbumName(draftValue));
			return;
		}

		onSelectedAlbumsChange(nextAlbums);
		setDraftValue("");
	}

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				<label
					htmlFor={inputId}
					className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
				>
					Albums
				</label>
				<Input
					id={inputId}
					type="text"
					value={draftValue}
					placeholder="Type a new album and press Enter"
					data-testid={inputTestId}
					onChange={(event) => {
						setDraftValue(event.currentTarget.value);
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter") {
							return;
						}

						event.preventDefault();
						commitDraftValue();
					}}
				/>
				<p className="text-xs leading-5 text-muted-foreground">
					Press Enter to turn a new album into a badge, or click one of your
					previous albums to add it.
				</p>
			</div>

			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
					Added albums
				</p>
				{selectedAlbums.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{selectedAlbums.map((albumName) => (
							<Badge
								key={albumName}
								variant="neutral"
								closeLabel={`Remove ${albumName}`}
								onClose={() => {
									onSelectedAlbumsChange(
										selectedAlbums.filter(
											(value) =>
												value.toLowerCase() !== albumName.toLowerCase(),
										),
									);
								}}
							>
								{albumName}
							</Badge>
						))}
					</div>
				) : (
					<p className="text-xs leading-5 text-muted-foreground">
						No albums selected yet.
					</p>
				)}
			</div>

			{availablePreviousAlbums.length > 0 ? (
				<div className="space-y-2">
					<p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
						Your previous albums
					</p>
					<div className="flex flex-wrap gap-2">
						{availablePreviousAlbums.map((albumName) => (
							<Badge
								key={albumName}
								variant="default"
								onClick={() => {
									onSelectedAlbumsChange(addAlbum(selectedAlbums, albumName));
								}}
							>
								{albumName}
							</Badge>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
