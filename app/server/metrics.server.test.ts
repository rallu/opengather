import assert from "node:assert/strict";
import test from "node:test";
import {
	recordAuthFlowMetric,
	recordPostMetric,
	renderPrometheusMetrics,
	resetMetricsForTest,
} from "./metrics.server.ts";

test("renderPrometheusMetrics exposes auth and post counters", () => {
	resetMetricsForTest();
	recordAuthFlowMetric({ flow: "local_auth", outcome: "success" });
	recordAuthFlowMetric({ flow: "hub_oauth", outcome: "failure" });
	recordPostMetric({ outcome: "created" });

	const output = renderPrometheusMetrics({
		nowMs: 2_000,
		databaseUp: true,
	});

	assert.match(
		output,
		/opengather_auth_flow_total\{flow="local_auth",outcome="success"\} 1/,
	);
	assert.match(
		output,
		/opengather_auth_flow_total\{flow="hub_oauth",outcome="failure"\} 1/,
	);
	assert.match(output, /opengather_posts_events_total\{outcome="created"\} 1/);
	assert.match(output, /opengather_instance_up 1/);
	assert.match(output, /opengather_database_up 1/);
});
