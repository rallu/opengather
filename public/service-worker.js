self.skipWaiting();
self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	if (!event.data) {
		return;
	}

	let payload = null;
	try {
		payload = event.data.json();
	} catch {
		payload = {
			title: "OpenGather notification",
			body: event.data.text(),
			url: "/notifications",
		};
	}

	const title =
		typeof payload?.title === "string" && payload.title
			? payload.title
			: "OpenGather notification";
	const body =
		typeof payload?.body === "string" && payload.body ? payload.body : "";
	const url =
		typeof payload?.url === "string" && payload.url
			? payload.url
			: "/notifications";
	const tag =
		typeof payload?.tag === "string" && payload.tag ? payload.tag : undefined;

	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			tag,
			data: {
				url,
			},
			icon: "/favicon.ico",
			badge: "/favicon.ico",
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const targetUrl =
		typeof event.notification.data?.url === "string" &&
		event.notification.data.url
			? new URL(event.notification.data.url, self.location.origin).toString()
			: new URL("/notifications", self.location.origin).toString();

	event.waitUntil(
		self.clients
			.matchAll({ includeUncontrolled: true, type: "window" })
			.then((clients) => {
				for (const client of clients) {
					if ("focus" in client && client.url === targetUrl) {
						return client.focus();
					}
				}

				const matchingClient = clients.find((client) =>
					client.url.startsWith(self.location.origin),
				);
				if (
					matchingClient &&
					"focus" in matchingClient &&
					"navigate" in matchingClient
				) {
					return matchingClient
						.navigate(targetUrl)
						.then(() => matchingClient.focus());
				}

				if (self.clients.openWindow) {
					return self.clients.openWindow(targetUrl);
				}

				return undefined;
			}),
	);
});
