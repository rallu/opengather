# Observability Runbook

## Metrics Endpoint
- Scrape URL: `GET /metrics`
- Format: Prometheus text exposition (`text/plain; version=0.0.4`)

## Metric Families
- `opengather_instance_up`
- `opengather_instance_uptime_seconds`
- `opengather_database_up`
- `opengather_metrics_scrape_total`
- `opengather_auth_flow_total{flow,outcome}`
- `opengather_posts_events_total{outcome}`

## Suggested Dashboard Queries

Auth flow success rate (5m):
```promql
sum(rate(opengather_auth_flow_total{outcome="success"}[5m]))
/
clamp_min(sum(rate(opengather_auth_flow_total[5m])), 0.0001)
```

Auth failures by flow (5m):
```promql
sum by (flow) (rate(opengather_auth_flow_total{outcome="failure"}[5m]))
```

Auth rate-limited events (5m):
```promql
sum(rate(opengather_auth_flow_total{outcome="rate_limited"}[5m]))
```

Post created throughput (5m):
```promql
sum(rate(opengather_posts_events_total{outcome="created"}[5m]))
```

Post rejection/failure rates (5m):
```promql
sum(rate(opengather_posts_events_total{outcome=~"rejected|failed"}[5m]))
```

Database dependency health:
```promql
opengather_database_up
```

Service liveness:
```promql
opengather_instance_up
```

## Suggested Alert Thresholds

High severity:
- `opengather_database_up == 0` for `2m`
- Auth success rate `< 0.90` for `10m`
- Post failure+rejection rate `> 20%` over `10m`

Medium severity:
- Auth rate-limited events `> 5 req/s` for `10m`
- Post rate-limited events `> 2 req/s` for `10m`

## Error Monitoring

Error monitor captures structured events with:
- `event`, `message`, `stack`
- `request.requestId`, `request.method`, `request.path`
- tags: `environment`, `service`, `release`, `severity`

Config keys in `config` table:
- `error_monitoring_enabled`
- `error_monitoring_webhook_url`
- `error_monitoring_alert_webhook_url`
- `error_monitoring_sample_rate`
- `error_monitoring_dedupe_window_seconds`

Alert routing:
- High-severity events are delivered to `error_monitoring_alert_webhook_url` when set.
- All captured events can be delivered to `error_monitoring_webhook_url`.

Controlled test event (admin only):
```bash
curl -fsS http://localhost:5173/debug/error-monitoring
```
