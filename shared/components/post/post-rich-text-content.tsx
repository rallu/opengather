import type { RichTextDocument } from "../../../app/lib/rich-text";
import { RichTextContent } from "./rich-text-content";

type PostRichTextContentProps = {
	className?: string;
	document: RichTextDocument;
};

export function PostRichTextContent({
	className,
	document,
}: PostRichTextContentProps) {
	return <RichTextContent document={document} className={className} />;
}
