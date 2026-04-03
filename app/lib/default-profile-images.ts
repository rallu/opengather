function createProfileArt(params: {
	backgroundStart: string;
	backgroundEnd: string;
	accent: string;
	label: string;
}) {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 960">
			<defs>
				<linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
					<stop offset="0%" stop-color="${params.backgroundStart}" />
					<stop offset="100%" stop-color="${params.backgroundEnd}" />
				</linearGradient>
			</defs>
			<rect width="640" height="960" fill="url(#bg)" />
			<circle cx="320" cy="300" r="150" fill="${params.accent}" opacity="0.95" />
			<rect x="160" y="500" width="320" height="230" rx="120" fill="${params.accent}" opacity="0.92" />
			<circle cx="120" cy="180" r="70" fill="white" opacity="0.14" />
			<circle cx="520" cy="740" r="110" fill="white" opacity="0.12" />
			<text x="320" y="900" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" letter-spacing="8">${params.label}</text>
		</svg>
	`;

	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const ainoImage = createProfileArt({
	backgroundStart: "#1d4ed8",
	backgroundEnd: "#0f172a",
	accent: "#93c5fd",
	label: "AINO",
});

export const mikaImage = createProfileArt({
	backgroundStart: "#7c3aed",
	backgroundEnd: "#1f2937",
	accent: "#c4b5fd",
	label: "MIKA",
});

export const saraImage = createProfileArt({
	backgroundStart: "#0f766e",
	backgroundEnd: "#134e4a",
	accent: "#99f6e4",
	label: "SARA",
});

export const DEFAULT_PROFILE_IMAGES = [
	ainoImage,
	mikaImage,
	saraImage,
] as const;

function hashSeed(seed: string): number {
	let hash = 0;
	for (const char of seed) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return hash;
}

export function getDefaultProfileImage(params: {
	seed?: string | null;
}): string {
	const seed = params.seed?.trim() || "opengather-default-avatar";
	const index = hashSeed(seed) % DEFAULT_PROFILE_IMAGES.length;
	return DEFAULT_PROFILE_IMAGES[index] ?? ainoImage;
}

export function getDefaultProfileImageForUser(params: {
	id?: string | null;
	email?: string | null;
	name?: string | null;
}): string {
	return getDefaultProfileImage({
		seed: params.id ?? params.email ?? params.name ?? null,
	});
}
