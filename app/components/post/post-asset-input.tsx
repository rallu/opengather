import * as React from "react";

type PostAssetInputProps = {
	name?: string;
	inputTestId?: string;
};

export function PostAssetInput({
	name = "assets",
	inputTestId,
}: PostAssetInputProps) {
	const [files, setFiles] = React.useState<string[]>([]);

	return (
		<div className="space-y-2 text-sm">
			<label className="flex items-center gap-2 text-foreground" htmlFor={name}>
				<span className="font-medium">Attach media</span>
				<span className="text-muted-foreground">
					up to 10 images or 1 video
				</span>
			</label>
			<input
				id={name}
				name={name}
				type="file"
				accept="image/*,video/*"
				multiple
				data-testid={inputTestId}
				onChange={(event) =>
					setFiles(
						Array.from(event.currentTarget.files ?? []).map(
							(file) => file.name,
						),
					)
				}
				className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium"
			/>
			<p className="text-xs leading-5 text-muted-foreground">
				Images are limited to 10 MB each. Videos are limited to 100 MB and 60
				seconds.
			</p>
			{files.length > 0 ? (
				<p className="text-xs leading-5 text-muted-foreground">
					{files.join(", ")}
				</p>
			) : null}
		</div>
	);
}
