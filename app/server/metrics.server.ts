type LabelValue = string | number | boolean;

type LabelSet = Record<string, LabelValue>;

type MetricDefinition = {
	type: "counter" | "gauge";
	help: string;
};

const processStartedAtMs = Date.now();

const metricDefinitions: Record<string, MetricDefinition> = {
	opengather_metrics_scrape_total: {
		type: "counter",
		help: "Number of metrics endpoint scrapes.",
	},
	opengather_auth_flow_total: {
		type: "counter",
		help: "Auth flow outcomes by flow and outcome label.",
	},
	opengather_posts_events_total: {
		type: "counter",
		help: "Post action outcomes.",
	},
};

const counterValues = new Map<string, number>();

function makeSeriesKey(name: string, labels: LabelSet): string {
	const entries = Object.entries(labels).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	const labelString = entries.map(([key, value]) => `${key}=${String(value)}`).join(",");
	return `${name}|${labelString}`;
}

function parseSeriesKey(key: string): { name: string; labels: LabelSet } {
	const [name, labelPart] = key.split("|", 2);
	if (!labelPart) {
		return { name, labels: {} };
	}
	const labels: LabelSet = {};
	for (const pair of labelPart.split(",")) {
		if (!pair) {
			continue;
		}
		const [rawKey, ...rest] = pair.split("=");
		if (!rawKey) {
			continue;
		}
		labels[rawKey] = rest.join("=");
	}
	return { name, labels };
}

function formatLabels(labels: LabelSet): string {
	const entries = Object.entries(labels);
	if (entries.length === 0) {
		return "";
	}
	const rendered = entries
		.map(([key, value]) => {
			const escaped = String(value)
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\n/g, "\\n");
			return `${key}="${escaped}"`;
		})
		.join(",");
	return `{${rendered}}`;
}

export function incrementCounter(params: {
	name: keyof typeof metricDefinitions;
	labels?: LabelSet;
	amount?: number;
}): void {
	const labels = params.labels ?? {};
	const amount = params.amount ?? 1;
	const key = makeSeriesKey(params.name, labels);
	counterValues.set(key, (counterValues.get(key) ?? 0) + amount);
}

export function recordAuthFlowMetric(params: {
	flow: "hub_oauth" | "local_auth";
	outcome: "success" | "failure" | "rate_limited";
}): void {
	incrementCounter({
		name: "opengather_auth_flow_total",
		labels: {
			flow: params.flow,
			outcome: params.outcome,
		},
	});
}

export function recordPostMetric(params: {
	outcome: "created" | "rejected" | "rate_limited" | "failed";
}): void {
	incrementCounter({
		name: "opengather_posts_events_total",
		labels: {
			outcome: params.outcome,
		},
	});
}

export function renderPrometheusMetrics(params: {
	nowMs?: number;
	databaseUp: boolean;
}): string {
	const nowMs = params.nowMs ?? Date.now();
	const lines: string[] = [];

	const metricNames = Object.keys(metricDefinitions).sort();
	for (const metricName of metricNames) {
		const definition = metricDefinitions[metricName];
		lines.push(`# HELP ${metricName} ${definition.help}`);
		lines.push(`# TYPE ${metricName} ${definition.type}`);

		for (const [seriesKey, value] of counterValues.entries()) {
			const parsed = parseSeriesKey(seriesKey);
			if (parsed.name !== metricName) {
				continue;
			}
			lines.push(`${metricName}${formatLabels(parsed.labels)} ${value}`);
		}
	}

	lines.push("# HELP opengather_instance_up Service liveness state (1=up). ");
	lines.push("# TYPE opengather_instance_up gauge");
	lines.push("opengather_instance_up 1");

	lines.push("# HELP opengather_instance_uptime_seconds Process uptime in seconds.");
	lines.push("# TYPE opengather_instance_uptime_seconds gauge");
	lines.push(`opengather_instance_uptime_seconds ${Math.floor((nowMs - processStartedAtMs) / 1000)}`);

	lines.push("# HELP opengather_database_up Database dependency health (1=up, 0=down).");
	lines.push("# TYPE opengather_database_up gauge");
	lines.push(`opengather_database_up ${params.databaseUp ? 1 : 0}`);

	return `${lines.join("\n")}\n`;
}

export async function getMetricsSnapshot(): Promise<string> {
	incrementCounter({ name: "opengather_metrics_scrape_total" });

	let databaseUp = false;
	try {
		const { getDb } = await import("./db.server.ts");
		await getDb().$queryRaw`SELECT 1`;
		databaseUp = true;
	} catch {
		databaseUp = false;
	}

	return renderPrometheusMetrics({ databaseUp });
}

export function resetMetricsForTest(): void {
	counterValues.clear();
}
