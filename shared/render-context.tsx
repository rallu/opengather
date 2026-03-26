import * as React from "react";

export type OpenGatherLinkComponentProps = {
	children: React.ReactNode;
	className?: string;
	to: string;
};

export type OpenGatherTimestampFormatResult = {
	label: string;
	title?: string;
};

export type OpenGatherTimestampFormatter = (
	value: Date | string | number,
) => OpenGatherTimestampFormatResult | string;

type OpenGatherRenderContextValue = {
	LinkComponent: React.ComponentType<OpenGatherLinkComponentProps>;
	formatTimestamp: OpenGatherTimestampFormatter;
};

export type OpenGatherSharedProviderProps = {
	children: React.ReactNode;
	formatTimestamp?: OpenGatherTimestampFormatter;
	LinkComponent?: React.ComponentType<OpenGatherLinkComponentProps>;
};

function DefaultLink({
	children,
	className,
	to,
}: OpenGatherLinkComponentProps) {
	return (
		<a className={className} href={to}>
			{children}
		</a>
	);
}

function defaultFormatTimestamp(
	value: Date | string | number,
): OpenGatherTimestampFormatResult {
	const date = value instanceof Date ? value : new Date(value);
	const label = date.toLocaleString();
	return { label, title: label };
}

const OpenGatherRenderContext =
	React.createContext<OpenGatherRenderContextValue>({
		LinkComponent: DefaultLink,
		formatTimestamp: defaultFormatTimestamp,
	});

export function OpenGatherSharedProvider({
	children,
	formatTimestamp,
	LinkComponent = DefaultLink,
}: OpenGatherSharedProviderProps) {
	const value = React.useMemo(
		() => ({
			LinkComponent,
			formatTimestamp: formatTimestamp ?? defaultFormatTimestamp,
		}),
		[LinkComponent, formatTimestamp],
	);

	return (
		<OpenGatherRenderContext.Provider value={value}>
			{children}
		</OpenGatherRenderContext.Provider>
	);
}

export function useOpenGatherLinkComponent() {
	return React.useContext(OpenGatherRenderContext).LinkComponent;
}

export function useOpenGatherTimestampFormatter() {
	return React.useContext(OpenGatherRenderContext).formatTimestamp;
}
