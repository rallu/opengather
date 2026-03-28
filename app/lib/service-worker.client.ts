let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
	null;

export function isServiceWorkerSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		window.isSecureContext &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!isServiceWorkerSupported()) {
		return null;
	}

	if (serviceWorkerRegistrationPromise) {
		return serviceWorkerRegistrationPromise;
	}

	serviceWorkerRegistrationPromise = (async () => {
		try {
			const response = await fetch("/service-worker.js", {
				method: "HEAD",
				cache: "no-store",
			});
			if (!response.ok) {
				return null;
			}

			return await navigator.serviceWorker.register("/service-worker.js");
		} catch {
			return null;
		}
	})();

	return serviceWorkerRegistrationPromise;
}

export function decodeVapidPublicKey(publicKey: string): ArrayBuffer {
	const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
	const normalized = (publicKey + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const raw = window.atob(normalized);
	const bytes = Uint8Array.from(
		Array.from(raw, (character) => character.charCodeAt(0)),
	);
	const buffer = new ArrayBuffer(bytes.length);

	new Uint8Array(buffer).set(bytes);
	return buffer;
}
