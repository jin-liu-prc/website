-- One aggregate row per Melbourne day, geographic area and website hostname.
-- No individual visit records, IP addresses or identifiers are stored.
CREATE TABLE IF NOT EXISTS daily_city_views (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  country_code TEXT NOT NULL CHECK (country_code = 'Unknown' OR country_code GLOB '[A-Z][A-Z]'),
  region TEXT NOT NULL CHECK (length(region) BETWEEN 1 AND 128),
  city TEXT NOT NULL CHECK (length(city) BETWEEN 1 AND 128),
  hostname TEXT NOT NULL CHECK (hostname IN ('www.jinliu.org', 'www-jinliu-org.translate.goog')),
  views INTEGER NOT NULL CHECK (typeof(views) = 'integer' AND views > 0),
  PRIMARY KEY (day, country_code, region, city, hostname)
) WITHOUT ROWID;

CREATE VIEW IF NOT EXISTS city_report AS
SELECT country_code, region, city,
  SUM(views) AS total_views,
  SUM(CASE WHEN hostname = 'www.jinliu.org' THEN views ELSE 0 END) AS original_views,
  SUM(CASE WHEN hostname = 'www-jinliu-org.translate.goog' THEN views ELSE 0 END) AS translated_views,
  MIN(day) AS first_day,
  MAX(day) AS last_day
FROM daily_city_views
GROUP BY country_code, region, city
ORDER BY total_views DESC, country_code, region, city;
