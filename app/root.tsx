import type { ReactNode } from "react";
import {
	Links,
	type LoaderFunctionArgs,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";

import "./tailwind.css";
import { DEFAULT_RENDER_INTL_CONFIG } from "~/lib/render-intl";
import { RenderIntlProvider } from "~/lib/render-intl-context";
import { getRenderIntlConfig } from "~/server/config.service.server";
import { hasDatabaseConfig } from "~/server/env.server.ts";

export async function loader(_args: LoaderFunctionArgs) {
	if (!hasDatabaseConfig()) {
		return {
			renderIntl: DEFAULT_RENDER_INTL_CONFIG,
		};
	}

	try {
		return {
			renderIntl: await getRenderIntlConfig(),
		};
	} catch {
		return {
			renderIntl: DEFAULT_RENDER_INTL_CONFIG,
		};
	}
}

function useRootRenderIntl() {
	const data = useLoaderData<typeof loader>();
	return data?.renderIntl ?? DEFAULT_RENDER_INTL_CONFIG;
}

export function Layout({ children }: { children: ReactNode }) {
	const renderIntl = useRootRenderIntl();

	return (
		<html lang={renderIntl.locale}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body
				className="min-h-screen bg-background font-sans antialiased"
				data-render-time-zone={renderIntl.timeZone}
			>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	const renderIntl = useRootRenderIntl();

	return (
		<RenderIntlProvider value={renderIntl}>
			<Outlet />
		</RenderIntlProvider>
	);
}
