# Backup and Recovery Runbook

## Objectives
- Recovery Point Objective (RPO): <= 24h (nightly backup minimum)
- Recovery Time Objective (RTO): <= 30m for single-instance restore

## Backup Strategy
- Backup type: PostgreSQL custom-format dump (`pg_dump --format=custom`)
- Backup script: `scripts/backup-db.sh`
- Default backup location: `backups/postgres/`
- Integrity: SHA-256 checksum per backup (`.sha256` file)
- Retention: 14 days by default (`RETENTION_DAYS`, configurable)

## Automated Backup Scheduling

Example cron (daily at 03:15 UTC):
```cron
15 3 * * * cd /path/to/opengather && DATABASE_URL="postgres://..." RETENTION_DAYS=14 npm run backup:db >> /var/log/opengather-backup.log 2>&1
```

Optional every 6 hours:
```cron
0 */6 * * * cd /path/to/opengather && DATABASE_URL="postgres://..." npm run backup:db >> /var/log/opengather-backup.log 2>&1
```

## Manual Backup
```bash
cd opengather
DATABASE_URL="postgres://opengather:opengather@localhost:5432/opengather" npm run backup:db
```

## Restore Procedure

1. Choose backup file (`*.dump`) and verify checksum if available.
2. Restore into target database.

```bash
cd opengather
BACKUP_FILE="$(pwd)/backups/postgres/opengather-YYYYMMDDTHHMMSSZ.dump" \
TARGET_DATABASE_URL="postgres://opengather:opengather@localhost:5432/opengather" \
  npm run restore:db
```

Equivalent direct script call:
```bash
TARGET_DATABASE_URL="postgres://opengather:opengather@localhost:5432/opengather" \
  scripts/restore-db.sh "$(pwd)/backups/postgres/opengather-YYYYMMDDTHHMMSSZ.dump"
```

## Restore Validation Procedure

Automated validation in isolated temporary DB:
```bash
cd opengather
DATABASE_URL="postgres://opengather:opengather@localhost:5432/opengather" \
  scripts/verify-restore.sh "$(pwd)/backups/postgres/opengather-YYYYMMDDTHHMMSSZ.dump"
```

Validation checks:
- Restore completes without `pg_restore` errors
- Required tables exist (`config`, `instance_membership`, `post`, `notification`, `audit_log`)
- Public schema contains tables
- Reports restore duration in seconds

## Disaster Recovery Steps

1. Incident declaration:
- Declare DB incident and assign incident lead.
- Freeze writes if partial corruption is suspected.

2. Triage:
- Confirm blast radius (single DB vs infrastructure-wide).
- Identify latest valid backup and corresponding checksum.

3. Recovery:
- Provision/confirm target DB availability.
- Run restore procedure with latest validated backup.
- Run restore validation checks.

4. Cutover:
- Point `DATABASE_URL` to restored DB if new target used.
- Restart app and verify health endpoints/pages (`/feed`, `/metrics`).

5. Post-recovery verification:
- Confirm auth works, posting works, and audit logs are readable.
- Confirm metrics and error monitoring resumed.

6. Post-incident review:
- Record actual RTO/RPO achieved.
- Log follow-up actions for gaps and automation improvements.

## Alerting Expectations
- Backup job should fail loudly in scheduler logs.
- Missing backup for >24h should alert on-call.
- Failed restore validation in CI or ops workflow should block promotion.
