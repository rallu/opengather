import { RichTextContent } from "~/components/ui/rich-text-content";
import type { RichTextDocument } from "~/lib/rich-text";

type PostRichTextContentProps = {
	document: RichTextDocument;
	className?: string;
};

export function PostRichTextContent({
	document,
	className,
}: PostRichTextContentProps) {
	return <RichTextContent document={document} className={className} />;
}
