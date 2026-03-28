import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	decodeVapidPublicKey,
	isServiceWorkerSupported,
	registerAppServiceWorker,
} from "~/lib/service-worker.client";

type PushDeviceControlsProps = {
	pushChannelEnabled: boolean;
	pushConfigured: boolean;
	pushSubscriptionCount: number;
	vapidPublicKey: string;
};

type DevicePushState = {
	busy: boolean;
	error: string;
	permission: NotificationPermission | "checking" | "unsupported";
	subscribed: boolean;
};

const initialState: DevicePushState = {
	busy: false,
	error: "",
	permission: "checking",
	subscribed: false,
};

export function PushDeviceControls(props: PushDeviceControlsProps) {
	const [state, setState] = useState<DevicePushState>(initialState);
	const [subscriptionCount, setSubscriptionCount] = useState(
		props.pushSubscriptionCount,
	);

	useEffect(() => {
		setSubscriptionCount(props.pushSubscriptionCount);
	}, [props.pushSubscriptionCount]);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			if (!props.pushConfigured || !props.vapidPublicKey) {
				if (!cancelled) {
					setState((current) => ({
						...current,
						permission: isServiceWorkerSupported()
							? Notification.permission
							: "unsupported",
					}));
				}
				return;
			}

			if (!isServiceWorkerSupported()) {
				if (!cancelled) {
					setState({
						busy: false,
						error: "",
						permission: "unsupported",
						subscribed: false,
					});
				}
				return;
			}

			const registration = await registerAppServiceWorker();
			const subscription = await registration?.pushManager.getSubscription();
			if (!cancelled) {
				setState({
					busy: false,
					error: "",
					permission: Notification.permission,
					subscribed: Boolean(subscription),
				});
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [props.pushConfigured, props.vapidPublicKey]);

	async function enablePushOnDevice() {
		setState((current) => ({ ...current, busy: true, error: "" }));

		try {
			if (!props.pushConfigured || !props.vapidPublicKey) {
				throw new Error(
					"Push notifications are not configured on this server yet.",
				);
			}

			if (!isServiceWorkerSupported()) {
				throw new Error("This browser does not support web push.");
			}

			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setState((current) => ({
					...current,
					busy: false,
					permission,
					subscribed: false,
					error:
						permission === "denied"
							? "Browser notifications are blocked for this site."
							: "Browser notification permission was not granted.",
				}));
				return;
			}

			const registration = await registerAppServiceWorker();
			if (!registration) {
				throw new Error(
					"Service worker registration is unavailable. Build or deploy the app first.",
				);
			}

			const existingSubscription =
				await registration.pushManager.getSubscription();
			const subscription =
				existingSubscription ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: decodeVapidPublicKey(props.vapidPublicKey),
				}));

			const response = await fetch("/api/notifications/push-subscriptions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					subscription: subscription.toJSON(),
				}),
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(
					body?.error || "Failed to store the browser subscription.",
				);
			}

			setState({
				busy: false,
				error: "",
				permission,
				subscribed: true,
			});
			if (!existingSubscription) {
				setSubscriptionCount((current) => current + 1);
			}
		} catch (error) {
			setState((current) => ({
				...current,
				busy: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to enable browser push notifications.",
			}));
		}
	}

	async function disablePushOnDevice() {
		setState((current) => ({ ...current, busy: true, error: "" }));

		try {
			if (!isServiceWorkerSupported()) {
				setState({
					busy: false,
					error: "",
					permission: "unsupported",
					subscribed: false,
				});
				return;
			}

			const registration = await registerAppServiceWorker();
			const subscription = await registration?.pushManager.getSubscription();
			if (subscription) {
				const endpoint = subscription.endpoint;
				await subscription.unsubscribe();
				const response = await fetch("/api/notifications/push-subscriptions", {
					method: "DELETE",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ endpoint }),
				});
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as {
						error?: string;
					} | null;
					throw new Error(
						body?.error || "Failed to remove the browser subscription.",
					);
				}
				setSubscriptionCount((current) => Math.max(0, current - 1));
			}

			setState({
				busy: false,
				error: "",
				permission:
					typeof Notification === "undefined"
						? "unsupported"
						: Notification.permission,
				subscribed: false,
			});
		} catch (error) {
			setState((current) => ({
				...current,
				busy: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to disable browser push notifications.",
			}));
		}
	}

	if (!props.pushConfigured) {
		return (
			<div className="space-y-2 text-sm">
				<p className="font-medium">Browser push on this device</p>
				<p className="text-muted-foreground">
					This server does not have VAPID keys configured yet, so browser push
					subscriptions are disabled.
				</p>
			</div>
		);
	}

	if (state.permission === "unsupported") {
		return (
			<div className="space-y-2 text-sm">
				<p className="font-medium">Browser push on this device</p>
				<p className="text-muted-foreground">
					This browser does not support service-worker-based web push.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 text-sm">
			<div className="space-y-1">
				<p className="font-medium">Browser push on this device</p>
				<p className="text-muted-foreground">
					Account subscriptions registered: {subscriptionCount}
				</p>
				<p className="text-muted-foreground">
					Status:{" "}
					{state.subscribed
						? "This device is subscribed."
						: "This device is not subscribed."}
				</p>
				<p className="text-muted-foreground">
					Permission:{" "}
					{state.permission === "checking"
						? "Checking browser support..."
						: state.permission}
				</p>
				{!props.pushChannelEnabled ? (
					<p className="text-muted-foreground">
						At least one <span className="font-medium">Push</span> checkbox in
						the notification matrix above must stay enabled, or no web pushes
						will be sent.
					</p>
				) : null}
			</div>
			{state.error ? (
				<p className="text-sm text-destructive">{state.error}</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => void enablePushOnDevice()}
					disabled={state.busy || state.subscribed}
				>
					Enable on this device
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => void disablePushOnDevice()}
					disabled={state.busy || !state.subscribed}
				>
					Disable on this device
				</Button>
			</div>
		</div>
	);
}
