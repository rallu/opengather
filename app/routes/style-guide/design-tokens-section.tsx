import { Card, CardContent } from "~/components/ui/card";
import { GuideGroup, SectionHeader } from "./layout";

export function DesignTokensSection() {
	return (
		<GuideGroup id="style-guide-group-design-tokens" title="Design Tokens" description="Foundational values for color, typography, spacing, and shape. These define the visual baseline before component-specific decisions begin.">
			<section className="space-y-4" data-testid="style-guide-tokens-colors">
				<SectionHeader title="Colors" description="Semantic color roles should be used through tokens rather than hard-coded values in routes or one-off components." />
				<Card><CardContent className="grid gap-3 pt-6 md:grid-cols-3 xl:grid-cols-6">{[{ label: "Background", swatch: "bg-background", text: "hsl(var(--background))", border: "border-border" }, { label: "Foreground", swatch: "bg-foreground", text: "hsl(var(--foreground))", border: "border-border" }, { label: "Primary", swatch: "bg-primary", text: "hsl(var(--primary))", border: "border-border" }, { label: "Muted", swatch: "bg-muted", text: "hsl(var(--muted))", border: "border-border" }, { label: "Accent", swatch: "bg-accent", text: "hsl(var(--accent))", border: "border-border" }, { label: "Info", swatch: "bg-info", text: "hsl(var(--info))", border: "border-info/50" }, { label: "Approved", swatch: "bg-success", text: "hsl(var(--success))", border: "border-success/50" }, { label: "Flagged", swatch: "bg-warning", text: "hsl(var(--warning))", border: "border-warning/50" }, { label: "Destructive", swatch: "bg-destructive", text: "hsl(var(--destructive))", border: "border-destructive/30" }].map((token) => <div key={token.label} className="space-y-3 rounded-lg border border-border p-3"><div className={`h-14 rounded-md border ${token.border} ${token.swatch}`} /><div className="space-y-1"><p className="text-sm font-medium">{token.label}</p><p className="text-xs text-muted-foreground">{token.text}</p></div></div>)}</CardContent></Card>
			</section>
			<section className="space-y-4" data-testid="style-guide-tokens-fonts">
				<SectionHeader title="Fonts" description="The system currently uses a single sans family. Weight and size changes should do more work than adding unrelated font pairings." />
				<Card><CardContent className="space-y-4 pt-6"><div className="rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">Sans family</p><p className="mt-2 text-2xl font-semibold tracking-tight">Inter, ui-sans-serif, system-ui, sans-serif</p></div></CardContent></Card>
			</section>
			<section className="space-y-4" data-testid="style-guide-tokens-headings">
				<SectionHeader title="Headings" description="The typography token scale should stay simple: a display heading plus H2 through H4. Component-specific titles belong in components, not in the token layer." />
				<Card><CardContent className="space-y-4 pt-6"><div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">Display H1</p><p className="text-4xl font-semibold tracking-tight">OpenGather style guide display</p></div><div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">H2</p><p className="text-2xl font-semibold tracking-tight">Primary content heading</p></div><div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">H3</p><p className="text-lg font-semibold tracking-tight">Supporting content heading</p></div><div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">H4</p><p className="text-base font-semibold tracking-tight">Compact interface heading</p></div></CardContent></Card>
			</section>
			<section className="space-y-4" data-testid="style-guide-tokens-body-text">
				<SectionHeader title="Body Text" description="Body copy should stay readable and calm, with line-height tuned for product scanning rather than editorial drift." />
				<Card><CardContent className="space-y-4 pt-6"><p className="max-w-3xl text-base leading-7 text-foreground">Body text in OpenGather should read clearly on both dense product screens and longer content surfaces. It should feel stable and useful rather than promotional.</p><p className="max-w-3xl text-sm leading-6 text-muted-foreground">Secondary body text carries support content, metadata, and explanatory UI copy without competing with the primary information.</p></CardContent></Card>
			</section>
			<section className="space-y-4" data-testid="style-guide-tokens-spacing">
				<SectionHeader title="Spacing" description="Spacing should stay systematic and restrained. The system should prefer a few repeatable gaps over many custom offsets." />
				<Card><CardContent className="space-y-4 pt-6"><div className="flex items-end gap-4">{[{ label: "4", className: "h-4 w-12" }, { label: "8", className: "h-8 w-12" }, { label: "12", className: "h-12 w-12" }, { label: "16", className: "h-16 w-12" }, { label: "24", className: "h-24 w-12" }].map((space) => <div key={space.label} className="space-y-2 text-center"><div className={`rounded-sm bg-primary/12 ${space.className}`} /><p className="text-xs text-muted-foreground">{space.label}</p></div>)}</div></CardContent></Card>
			</section>
			<section className="space-y-4" data-testid="style-guide-tokens-radius">
				<SectionHeader title="Corner Radius" description="Corner radius should stay moderate. Most surfaces should feel precise rather than overly soft." />
				<Card><CardContent className="grid gap-4 pt-6 md:grid-cols-3"><div className="space-y-2"><p className="text-sm font-medium">Tight</p><div className="h-16 rounded-sm border border-border bg-muted/50" /></div><div className="space-y-2"><p className="text-sm font-medium">Default</p><div className="h-16 rounded-md border border-border bg-muted/50" /></div><div className="space-y-2"><p className="text-sm font-medium">Surface</p><div className="h-16 rounded-lg border border-border bg-muted/50" /></div></CardContent></Card>
			</section>
		</GuideGroup>
	);
}
