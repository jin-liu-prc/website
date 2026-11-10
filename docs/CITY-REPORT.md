# Private city report

The city report is a separate, small Cloudflare Worker and D1 database in Jin's existing Cloudflare account. It does not add a city setting to Cloudflare Web Analytics. The website remains on GitHub Pages; Name.com continues to manage registration and DNS. The collector uses its own `workers.dev` address and needs no domain or nameserver changes.

## Deployed resources

The Worker and database were deployed and verified on 10 November 2026:

- Collector: `https://jinliu-city-report.jin-liu-prc.workers.dev/collect`.
- Worker: `jinliu-city-report`; initial verified version `c187bb19-3efb-4e33-9bbe-0cbe5f1b963a`.
- D1 database: `jinliu-city-report`, ID `ad7d0a48-fb6a-423c-8888-5d5a8c843ea7`, placement region `OC`.
- D1 binding: `DB`; daily Cron: `30 14 * * *` (UTC).

These are public resource identifiers, not credentials. The deployment passed five HTTP validation cases, and its private SQL view returned the single controlled setup increment. That exact setup row was removed before website activation, leaving zero rows. Production collection starts when the website's configured endpoint is published; there is no historical backfill.

## Data and privacy

The browser sends only the exact text `pageview` to `POST /collect`, after the website's existing own-browser exclusion has been checked. The preferences page and development previews must not send this request. The Worker accepts these exact browser origins:

- `https://www.jinliu.org`
- `https://www-jinliu-org.translate.goog`

The Worker gets city, first-level region and national-level region code from Cloudflare's request metadata. The database stores only `day`, `country_code`, `region`, `city`, `hostname` and an aggregate `views` count. Missing locations become `Unknown`. Dates use Australia/Melbourne; there are no per-visit timestamps, IP addresses, visitor IDs, user agents, referrers, page URLs or individual event records. Worker logging and Logpush are disabled in the configuration; application code does not log requests or errors. Keep those settings disabled. Credentials are never included in browser code or this repository.

These are approximate **pageview totals**, not unique people or verified identities. Reloads count again. IP geolocation can be missing or inaccurate and can reflect a VPN or proxy. The collector does not reproduce Cloudflare Web Analytics' bot filtering, so its totals can differ. Origin checks restrict ordinary browser collection but are not proof of a human visitor; software can forge an Origin header. The report only covers requests received after setup and cannot reconstruct earlier cities from existing Web Analytics totals.

## Private access

Sign in to [Cloudflare](https://dash.cloudflare.com/), select the existing account containing the Worker, and open **Storage & databases → D1 SQL database → jinliu-city-report**. Depending on the dashboard version, open **Studio**, **Console** or the table/query interface and run:

```sql
SELECT * FROM city_report
ORDER BY total_views DESC, country_code, region, city;
```

The report includes city/region, `total_views`, `original_views`, `translated_views`, `first_day` and `last_day`. The stored field `country_code` identifies the national-level region without exposing an IP address. For daily totals, inspect `daily_city_views`. All access is through the authenticated Cloudflare account; the Worker has no public report or read endpoint. Do not add an unauthenticated query endpoint or publish database exports to the public website repository.

The daily Cron runs at 14:30 UTC (00:30 or 01:30 in Melbourne), removing days older than the current Melbourne day plus its previous 179 days. Data therefore covers at most 180 calendar days after daily cleanup, with expired rows potentially remaining until that run. Cloudflare's own database backups may retain older aggregate snapshots according to its platform policy; no raw IP data is written to them by this application.

## Setup and deployment

Keep the account on **Workers Free**. The free allowances currently include 100,000 Worker requests/day and D1's 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Free-tier limits stop further requests/queries rather than silently enabling a paid plan. Do not enable a paid Workers plan, paid logging or other paid services for this report.

The database ID and collector URL are already configured. For later Worker updates, use an authenticated Wrangler session from `cloudflare/city-report/`:

1. Run the local checks below.
2. Apply any new schema migrations with `wrangler d1 migrations apply jinliu-city-report --remote`. Do not recreate the deployed database.
3. Deploy with `wrangler deploy`. Preserve the existing database ID, `DB` binding, Worker name, Cron, disabled logging and free account plan.
4. Keep the production website endpoint set to `https://jinliu-city-report.jin-liu-prc.workers.dev/collect`. The client must honor `jinliu.analytics.exclude`, send only `pageview`, omit credentials and avoid retries that would double-count a view.
5. Verify that the excluded browser sends no collector request. A collector `POST` used for testing adds a real count; avoid adding test traffic after activation or deleting existing visitor totals to tidy up a test.

Use a descriptive, honest user agent for command-line HTTP checks, such as `JinLiuCityReportSetup/1.0`. Cloudflare's Browser Integrity Check can block default Python library user agents with error 1010 before the Worker runs; this is a platform rejection rather than the collector's response. The restriction and remedy are documented in [Cloudflare's workers.dev guide](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#browser-integrity-check-on-workersdev).

With an allowed `Origin` header, `GET /collect` returns 405 without adding a row. A request without an allowed Origin is rejected with 403. For example, this read-only check uses the approved origin and does not submit a pageview:

```sh
curl --include --user-agent 'JinLiuCityReportSetup/1.0' \
  --header 'Origin: https://www.jinliu.org' \
  'https://jinliu-city-report.jin-liu-prc.workers.dev/collect'
```

The Worker has no public report route. No account ID, API token or secret belongs in this repository. Wrangler credentials remain in the operator's authenticated environment. Deploying the Worker is separate from publishing GitHub Pages; the checks workflow never deploys either service.

## Local checks

From the repository root:

```sh
node --test cloudflare/city-report/worker.test.mjs
python3 cloudflare/city-report/schema_test.py
```

The tests cover allowed and rejected origins, exact/oversized request bodies, metadata minimization, CORS, database failures, lack of public read routes, Melbourne daylight-saving boundaries, atomic increments, report aggregation and 180-day cleanup. They do not need credentials or cloud resources. Cloudflare does not supply production `request.cf` metadata in dashboard/Playground previews; deployed verification is needed for real geography.

## Official references

- [Worker request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [D1 dashboard and deployment setup](https://developers.cloudflare.com/d1/get-started/)
- [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing and free-tier limits](https://developers.cloudflare.com/d1/platform/pricing/)
- [workers.dev without domain onboarding](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [IP geolocation limits](https://developers.cloudflare.com/network/ip-geolocation/)
