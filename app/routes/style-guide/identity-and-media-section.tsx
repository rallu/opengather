import { ProfileCard } from "~/components/profile/profile-card";
import { ProfileIdentity } from "~/components/profile/profile-identity";
import { ProfileImage } from "~/components/profile/profile-image";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { HeroImage } from "~/components/ui/hero-image";
import { ainoImage, heroImage, mikaImage, saraImage } from "./data";
import { GuideGroup, SectionHeader } from "./layout";

export function IdentityAndMediaSection() {
	return (
		<GuideGroup id="style-guide-group-identity-and-media" title="Identity And Media" description="Visual identity and image-led surfaces for people, groups, and major moments.">
			<section className="space-y-4" data-testid="style-guide-hero-image"><SectionHeader title="Hero Image" description="Large image-led panel for landing moments, group intros, and future editorial sections. It should feel atmospheric without turning into generic marketing chrome." /><HeroImage imageSrc={heroImage} imageAlt="Illustrated community scene" title="Give the people already involved a place that feels worth returning to." description="A hero surface should feel grounded and specific. It can set atmosphere, but it still needs to read like part of the product rather than a template."><Button>Start a space</Button><Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Read more</Button></HeroImage></section>
			<section className="space-y-4" data-testid="style-guide-profile-image"><SectionHeader title="Profile Image" description="Image-only profile surface for avatars, leading thumbnails, and compact identity markers. It should scale cleanly across navigation and content contexts." /><Card><CardContent className="flex flex-wrap items-center gap-4 pt-6"><ProfileImage src={ainoImage} alt="Aino Moderator" fallback="AM" size="sm" /><ProfileImage src={mikaImage} alt="Mika Member" fallback="MM" size="md" /><ProfileImage src={saraImage} alt="Sara Admin" fallback="SA" size="lg" /><ProfileImage alt="Fallback profile" fallback="OG" size="xl" /></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-profile-listing"><SectionHeader title="Profile Listing" description="Image-plus-name identity rows for member lists, search results, and participant pickers. This is the list-ready profile pattern." /><Card><CardContent className="space-y-4 pt-6"><ProfileIdentity name="Aino Moderator" subtitle="Neighborhood planning lead" imageSrc={ainoImage} imageAlt="Aino Moderator" fallback="AM" size="lg" /><ProfileIdentity name="Mika Member" subtitle="Community kitchen volunteer" imageSrc={mikaImage} imageAlt="Mika Member" fallback="MM" /><ProfileIdentity name="Sara Admin" subtitle="Coordinates moderation and onboarding" imageSrc={saraImage} imageAlt="Sara Admin" fallback="SA" size="sm" /></CardContent></Card></section>
			<section className="space-y-4" data-testid="style-guide-profile-card"><SectionHeader title="Profile Card" description="Small portrait-oriented user card with a 9:16 aspect ratio. Use it when a person needs to feel highlighted rather than just listed." /><Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3"><ProfileCard name="Aino Moderator" imageSrc={ainoImage} imageAlt="Aino Moderator" description="Keeps projects moving and members informed." /><ProfileCard name="Mika Member" imageSrc={mikaImage} imageAlt="Mika Member" description="Helps translate ideas into concrete group work." /><ProfileCard name="Sara Admin" imageSrc={saraImage} imageAlt="Sara Admin" description="Supports trust, onboarding, and follow-through." /></CardContent></Card></section>
		</GuideGroup>
	);
}
