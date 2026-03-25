import { Button } from "~/components/ui/button";
import { Breadcrumb, BreadcrumbCurrent, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "~/components/ui/breadcrumb";
import { Card, CardContent } from "~/components/ui/card";
import { ContextBar } from "~/components/ui/context-bar";
import { Navigation, SubNavigation } from "~/components/ui/navigation";
import { NavigationList } from "~/components/ui/navigation-list";
import { navigationItems, navigationListSections, subNavigationItems } from "./data";
import { GuideGroup, SectionHeader } from "./layout";

export function NavigationSection() {
	return (
		<GuideGroup id="style-guide-group-navigation-and-wayfinding" title="Navigation And Wayfinding" description="Shared structures for moving around the product and understanding where you are.">
			<section className="space-y-4" data-testid="style-guide-navigation"><SectionHeader title="Navigation" description="Primary page-level navigation and smaller sub-navigation patterns. They should be shared, calm, and consistent across major app surfaces." /><Card><CardContent className="space-y-6 pt-6"><div className="space-y-3"><p className="text-sm font-medium">Primary navigation</p><Navigation items={navigationItems} /></div><div className="space-y-3"><p className="text-sm font-medium">Sub-navigation</p><SubNavigation items={subNavigationItems} /></div></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-breadcrumb"><SectionHeader title="Breadcrumb" description="Compressed location trail for deeper pages. Use it when the route hierarchy matters and users need a clear path back." /><Card><CardContent className="pt-6"><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink to="/feed">Feed</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink to="/groups">Groups</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbCurrent>Neighborhood Organizers</BreadcrumbCurrent></BreadcrumbItem></BreadcrumbList></Breadcrumb></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-context-bar"><SectionHeader title="Context Bar" description="Top-level subview navigation with one clear way back, a breadcrumb trail, and optional right-side controls." /><Card><CardContent className="pt-6"><ContextBar backTo="/groups" breadcrumbs={[{ label: "Groups", to: "/groups" }, { label: "Neighborhood Organizers", to: "/groups/neighborhood-organizers" }, { label: "Repair workshop schedule" }]} actions={<Button size="sm" variant="outline">Share</Button>} /></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-navigation-list"><SectionHeader title="Navigation List" description="Sectioned list pattern with headers and items. Each item can carry an icon or profile image in front, plus optional trailing metadata." /><Card><CardContent className="pt-6"><NavigationList sections={navigationListSections} /></CardContent></Card></section>
		</GuideGroup>
	);
}
