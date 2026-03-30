import { useOpenGatherTimestampFormatter } from "../../render-context";

type FormattedTimestampProps = {
	className?: string;
	value: Date | string | number;
};

export function FormattedTimestamp({
	className,
	value,
}: FormattedTimestampProps) {
	const formatTimestamp = useOpenGatherTimestampFormatter();
	const formatted = formatTimestamp(value);
	const date = value instanceof Date ? value : new Date(value);
	const label = typeof formatted === "string" ? formatted : formatted.label;
	const title =
		typeof formatted === "string"
			? date.toLocaleString()
			: (formatted.title ?? formatted.label);

	return (
		<time className={className} dateTime={date.toISOString()} title={title}>
			{label}
		</time>
	);
}
