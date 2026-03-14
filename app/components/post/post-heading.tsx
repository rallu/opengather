import {
	MediaHeading,
	MediaHeadingContent,
	MediaHeadingMedia,
	MediaHeadingSubtitle,
	MediaHeadingTitle,
} from "~/components/ui/media-heading";

type PostHeadingProps = {
	media: React.ReactNode;
	title: string;
	subtitle: string;
};

export function PostHeading({ media, title, subtitle }: PostHeadingProps) {
	return (
		<MediaHeading>
			<MediaHeadingMedia>{media}</MediaHeadingMedia>
			<MediaHeadingContent>
				<MediaHeadingTitle>{title}</MediaHeadingTitle>
				<MediaHeadingSubtitle>{subtitle}</MediaHeadingSubtitle>
			</MediaHeadingContent>
		</MediaHeading>
	);
}
