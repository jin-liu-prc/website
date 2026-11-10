// Store city/day counts only. Do not add request, header, IP or user-agent logging.
const ORIGINS = new Map([
  ['https://www.jinliu.org', 'www.jinliu.org'],
  ['https://www-jinliu-org.translate.goog', 'www-jinliu-org.translate.goog'],
]);
const DAY_MS = 86_400_000;
const RETAINED_DAYS = 180;
const dayFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const UPSERT_SQL = `
  INSERT INTO daily_city_views (day, country_code, region, city, hostname, views)
  VALUES (?1, ?2, ?3, ?4, ?5, 1)
  ON CONFLICT (day, country_code, region, city, hostname)
  DO UPDATE SET views = daily_city_views.views + 1
`;
export const CLEANUP_SQL = `DELETE FROM daily_city_views WHERE day < ?1`;

export function melbourneDay(time = Date.now()) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(time))
    .map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function retentionCutoff(time = Date.now()) {
  // Civil dates avoid daylight-saving shifts: keep today and the preceding 179 days.
  const today = Date.parse(`${melbourneDay(time)}T00:00:00Z`);
  return new Date(today - (RETAINED_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
}

function locationName(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 128) : 'Unknown';
}

function countryCode(value) {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : 'Unknown';
}

function response(status, origin, extraHeaders = {}) {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin', ...extraHeaders });
  if (ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(null, { status, headers });
}

async function isPageview(request) {
  // Limit the body before buffering it, even when Content-Length is absent or forged.
  if (!request.body) return false;
  const expected = new TextEncoder().encode('pageview');
  const reader = request.body.getReader();
  let position = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return position === expected.length;
      for (const byte of value) {
        if (position >= expected.length || byte !== expected[position++]) {
          await reader.cancel();
          return false;
        }
      }
    }
  } catch (_) {
    return false;
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (new URL(request.url).pathname !== '/collect') return response(404, origin);
    if (!['POST', 'OPTIONS'].includes(request.method)) {
      return response(405, origin, { Allow: 'POST, OPTIONS' });
    }
    if (!ORIGINS.has(origin)) return response(403, origin);

    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== 'POST') {
        return response(405, origin, { Allow: 'POST, OPTIONS' });
      }
      return response(204, origin, {
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      });
    }
    if (!(await isPageview(request))) return response(400, origin);

    // Only these platform-provided location fields and the allowlisted origin are persisted.
    const cf = request.cf || {};
    try {
      const result = await env.DB.prepare(UPSERT_SQL).bind(
        melbourneDay(), countryCode(cf.country), locationName(cf.region),
        locationName(cf.city), ORIGINS.get(origin),
      ).run();
      if (!result.success) return response(503, origin);
      return response(204, origin);
    } catch (_) {
      // No exception/request logging: respond without revealing database details.
      return response(503, origin);
    }
  },

  async scheduled(controller, env) {
    await env.DB.prepare(CLEANUP_SQL).bind(retentionCutoff(controller.scheduledTime)).run();
  },
};
