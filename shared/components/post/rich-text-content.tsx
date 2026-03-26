import {
	type RichTextDocument,
	resolveRichTextLinkTarget,
} from "../../../app/lib/rich-text";
import { cn } from "../../../app/lib/utils";
import { useOpenGatherLinkComponent } from "../../render-context";

type RichTextContentProps = {
	className?: string;
	document: RichTextDocument;
};

function getInlineSignature(
	documentNode: RichTextDocument["blocks"][number]["children"][number],
) {
	if (documentNode.type === "text") {
		return `text:${documentNode.text}`;
	}

	return `link:${documentNode.text}:${resolveRichTextLinkTarget(documentNode.target)}`;
}

function getParagraphSignature(block: RichTextDocument["blocks"][number]) {
	return `${block.type}:${block.children.map(getInlineSignature).join("|")}`;
}

export function RichTextContent({ className, document }: RichTextContentProps) {
	const LinkComponent = useOpenGatherLinkComponent();

	return (
		<div
			className={cn(
				"space-y-4 text-sm leading-7 text-foreground [&_p]:whitespace-pre-wrap",
				className,
			)}
		>
			{document.blocks.map((block) => {
				if (block.type !== "paragraph") {
					return null;
				}

				const seenInlineKeys = new Map<string, number>();

				return (
					<p key={getParagraphSignature(block)}>
						{block.children.map((node) => {
							const signature = getInlineSignature(node);
							const occurrence = (seenInlineKeys.get(signature) ?? 0) + 1;
							seenInlineKeys.set(signature, occurrence);
							const key = `${signature}:${occurrence}`;

							if (node.type === "text") {
								return <span key={key}>{node.text}</span>;
							}

							const target = resolveRichTextLinkTarget(node.target);

							if (node.target.type === "external") {
								return (
									<a
										key={key}
										href={target}
										target="_blank"
										rel="noreferrer"
										className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
									>
										{node.text}
									</a>
								);
							}

							return (
								<LinkComponent
									key={key}
									to={target}
									className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
								>
									{node.text}
								</LinkComponent>
							);
						})}
					</p>
				);
			})}
		</div>
	);
}
