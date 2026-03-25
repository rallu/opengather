import { useEffect, useState } from "react";
import {
	formatDateTime,
	formatTimestampLabel,
	isRelativeTimeCandidate,
} from "~/lib/render-intl";
import { useRenderIntl } from "~/lib/render-intl-context";

type LocalizedTimestampProps = {
	value: Date | string | number;
	className?: string;
};

export function LocalizedTimestamp({
	value,
	className,
}: LocalizedTimestampProps) {
	const { isClientRenderIntlReady, renderIntl } = useRenderIntl();
	const [now, setNow] = useState(() => Date.now());
	const date = value instanceof Date ? value : new Date(value);
	const timeMs = date.getTime();
	const absoluteLabel = formatDateTime(date, renderIntl);
	const label = isClientRenderIntlReady
		? formatTimestampLabel(date, renderIntl, now)
		: absoluteLabel;

	useEffect(() => {
		if (!isClientRenderIntlReady) {
			return;
		}

		if (!isRelativeTimeCandidate(timeMs, now)) {
			return;
		}

		const intervalId = window.setInterval(() => {
			setNow(Date.now());
		}, 60 * 1000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isClientRenderIntlReady, now, timeMs]);

	return (
		<time
			className={className}
			dateTime={date.toISOString()}
			title={absoluteLabel}
		>
			{label}
		</time>
	);
}
