# Inbox

Drop prod dumps from infra here. Expected file names:

```
contest-prod-dump-YYYYMMDD-HHMM.sql
contest-prod-dump-YYYYMMDD-HHMM.sql.gz
```

Apply with:

```bash
bash scripts/sync-from-prod/apply-inbox.sh
```

(See `../README.md` for the full sync workflow.)
