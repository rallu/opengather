export function SectionHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
			<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
				{description}
			</p>
		</div>
	);
}

export function GuideGroup({
	id,
	title,
	description,
	children,
}: {
	id: string;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className="space-y-6 scroll-mt-24" data-testid={id}>
			<div className="space-y-2 border-b border-border pb-4">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
					{description}
				</p>
			</div>
			<div className="space-y-10">{children}</div>
		</section>
	);
}
