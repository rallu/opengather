import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
	DEFAULT_RENDER_INTL_CONFIG,
	formatDateTime,
	type RenderIntlConfig,
	resolveBrowserRenderIntlConfig,
} from "./render-intl";

type RenderIntlContextValue = {
	renderIntl: RenderIntlConfig;
	isClientRenderIntlReady: boolean;
};

const RenderIntlContext = createContext<RenderIntlContextValue>({
	renderIntl: DEFAULT_RENDER_INTL_CONFIG,
	isClientRenderIntlReady: false,
});

export function RenderIntlProvider(props: {
	value: RenderIntlConfig;
	children: ReactNode;
}) {
	const serverRenderIntl = props.value;
	const [renderIntl, setRenderIntl] = useState(serverRenderIntl);
	const [isClientRenderIntlReady, setIsClientRenderIntlReady] = useState(false);

	useEffect(() => {
		const next = resolveBrowserRenderIntlConfig(serverRenderIntl);
		setRenderIntl((current) =>
			current.locale === next.locale && current.timeZone === next.timeZone
				? current
				: next,
		);
		setIsClientRenderIntlReady(true);
	}, [serverRenderIntl]);

	return (
		<RenderIntlContext.Provider
			value={{
				renderIntl,
				isClientRenderIntlReady,
			}}
		>
			{props.children}
		</RenderIntlContext.Provider>
	);
}

export function useRenderIntlConfig(): RenderIntlConfig {
	return useContext(RenderIntlContext).renderIntl;
}

export function useRenderIntl() {
	return useContext(RenderIntlContext);
}

export function useFormatDateTime() {
	const renderIntl = useRenderIntlConfig();

	return (value: Date | string | number) => formatDateTime(value, renderIntl);
}
